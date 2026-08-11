"""Durable Telegram outbox — guarantees every intended forward eventually
reaches Telegram, even across a process crash / redeploy / network outage.

Each intended forward (user DM, admin log, owner mirror, public showcase) is
persisted as a `telegram_outbox` document at hit time BEFORE any network send is
attempted. A background worker (mirroring the expiry_watcher startup pattern)
drains pending documents, delivers them via the existing send_message /
send_photo helpers, marks them delivered on success, and retries with
exponential backoff on failure. Because the document is persisted first,
delivery survives a restart: pending items are re-picked up on boot.

Delivery contract: AT-LEAST-ONCE. Every document carries a unique `dedup_key`
(unique index), so the same intended forward can never be *enqueued* twice, and a
document is only picked up while `status == "pending"` — once marked `delivered`
it is never sent again. Sends are claimed atomically (find_one_and_update) so two
worker passes can't send the same document concurrently. The one unavoidable
duplicate window is a crash AFTER Telegram accepts a send but BEFORE the
`delivered` update lands: on restart the stale claim is reclaimed and the send is
retried, so a rare duplicate is possible. The Telegram Bot API exposes no
idempotency key, so we accept at-least-once and prefer a rare duplicate over a
lost hit.

Durability: a document is NEVER terminally abandoned. Failed sends retry forever
with capped exponential backoff (so a prolonged Telegram/network outage or a
remediable misconfiguration is ridden out, not dropped). `attempts` and
`last_error` are recorded for operator visibility.
"""
from __future__ import annotations

import asyncio
import base64
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from db import get_db
from services.telegram import send_message, send_photo, pin_message

log = logging.getLogger("semex.outbox")

# How often the worker polls for due work.
POLL_INTERVAL_SECONDS = 3.0
# How many due documents to process per pass.
BATCH_SIZE = 20
# Exponential backoff schedule (seconds) indexed by attempt count. The last
# value repeats for further attempts, so retries continue forever at a capped
# interval — a document is never terminally abandoned.
_BACKOFF_SCHEDULE = [5, 15, 60, 300, 900, 3600]
# A document claimed for sending but not resolved within this window is
# considered stale (worker crashed mid-send) and is returned to the pending
# pool on the next pass.
_CLAIM_STALE_SECONDS = 90


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _backoff(attempts: int) -> float:
    idx = min(max(attempts - 1, 0), len(_BACKOFF_SCHEDULE) - 1)
    return float(_BACKOFF_SCHEDULE[idx])


async def enqueue_message(
    db,
    chat_id: int | str,
    text: str,
    *,
    pin: bool = False,
    dedup_key: str,
) -> None:
    """Persist a pending text forward. Safe to call repeatedly — the unique
    dedup_key makes duplicate enqueues a no-op."""
    doc = {
        "kind": "message",
        "chat_id": str(chat_id),
        "text": text,
        "pin": bool(pin),
        "dedup_key": dedup_key,
        "status": "pending",
        "attempts": 0,
        "next_attempt_at": _now(),
        "created_at": _now(),
    }
    await _insert(db, doc)


async def enqueue_photo(
    db,
    chat_id: int | str,
    screenshot_b64: str,
    caption: str,
    *,
    pin: bool = False,
    dedup_key: str,
) -> None:
    """Persist a pending photo forward (base64 JPEG + caption)."""
    doc = {
        "kind": "photo",
        "chat_id": str(chat_id),
        "screenshot_b64": screenshot_b64,
        "text": caption,
        "pin": bool(pin),
        "dedup_key": dedup_key,
        "status": "pending",
        "attempts": 0,
        "next_attempt_at": _now(),
        "created_at": _now(),
    }
    await _insert(db, doc)


async def _insert(db, doc: dict) -> None:
    from pymongo.errors import DuplicateKeyError
    try:
        await db.telegram_outbox.insert_one(doc)
    except DuplicateKeyError:
        # Already enqueued (e.g. duplicate submission / retry) — idempotent.
        log.debug("outbox enqueue skipped, duplicate dedup_key=%s", doc.get("dedup_key"))
    except Exception as e:
        # Never let an outbox failure abort the hit request.
        log.warning("outbox enqueue failed (dedup_key=%s): %s", doc.get("dedup_key"), e)


async def _deliver(doc: dict) -> bool:
    """Send a single outbox document via the existing Telegram helpers.
    Returns True on confirmed delivery (Telegram ok=True)."""
    chat_id = doc["chat_id"]
    text = doc.get("text") or ""
    try:
        chat = int(chat_id)
    except (TypeError, ValueError):
        chat = chat_id  # keep as-is if not numeric
    if doc.get("kind") == "photo":
        img = base64.b64decode(doc["screenshot_b64"])
        res = await send_photo(chat, img, text)
    else:
        res = await send_message(chat, text)
    if not (res and res.get("ok")):
        return False
    if doc.get("pin"):
        try:
            mid = (res.get("result") or {}).get("message_id")
            if mid:
                await pin_message(chat, mid, disable_notification=True)
        except Exception as e:
            log.warning("outbox pin failed (dedup_key=%s): %s", doc.get("dedup_key"), e)
    return True


async def _drain_once(db) -> int:
    """Process one batch of due documents. Returns number delivered."""
    now = _now()
    # Reclaim stale claims (worker crashed mid-send) back to pending.
    try:
        await db.telegram_outbox.update_many(
            {"status": "sending", "claimed_at": {"$lt": now - timedelta(seconds=_CLAIM_STALE_SECONDS)}},
            {"$set": {"status": "pending"}},
        )
    except Exception as e:
        log.debug("outbox stale-claim reclaim failed: %s", e)

    delivered = 0
    for _ in range(BATCH_SIZE):
        # Atomically claim the next due pending document.
        doc = await db.telegram_outbox.find_one_and_update(
            {"status": "pending", "next_attempt_at": {"$lte": _now()}},
            {"$set": {"status": "sending", "claimed_at": _now()}},
            sort=[("next_attempt_at", 1)],
        )
        if not doc:
            break
        last_error = None
        try:
            ok = await _deliver(doc)
        except Exception as e:
            last_error = f"{e.__class__.__name__}: {e}"
            log.warning("outbox delivery raised (dedup_key=%s): %s", doc.get("dedup_key"), e)
            ok = False

        if ok:
            await db.telegram_outbox.update_one(
                {"_id": doc["_id"]},
                {"$set": {"status": "delivered", "delivered_at": _now()},
                 "$inc": {"attempts": 1}},
            )
            delivered += 1
        else:
            # NEVER give up: reschedule with capped exponential backoff so a
            # prolonged outage or remediable failure is ridden out, not dropped.
            attempts = int(doc.get("attempts", 0)) + 1
            update = {
                "status": "pending",
                "next_attempt_at": _now() + timedelta(seconds=_backoff(attempts)),
            }
            if last_error is not None:
                update["last_error"] = last_error[:500]
            if attempts % 12 == 0:
                log.error("outbox still undelivered after %d attempts (dedup_key=%s)",
                          attempts, doc.get("dedup_key"))
            await db.telegram_outbox.update_one(
                {"_id": doc["_id"]},
                {"$set": update, "$inc": {"attempts": 1}},
            )
    return delivered


def kick() -> None:
    """Trigger an immediate drain pass (near-instant delivery for the happy
    path) without waiting for the next poll tick. Fire-and-forget."""
    try:
        asyncio.create_task(_drain_once(get_db()))
    except Exception as e:
        log.debug("outbox kick failed: %s", e)


async def _loop():
    # Small startup delay so DB indexes finish (mirrors expiry_watcher).
    await asyncio.sleep(5)
    while True:
        try:
            await _drain_once(get_db())
        except Exception as e:
            log.exception("outbox loop error: %s", e)
        await asyncio.sleep(POLL_INTERVAL_SECONDS)


_task: Optional[asyncio.Task] = None


def start_outbox_task() -> None:
    global _task
    if _task is None or _task.done():
        _task = asyncio.create_task(_loop())
        log.info("telegram outbox worker started (interval=%ss)", POLL_INTERVAL_SECONDS)


def stop_outbox_task() -> None:
    global _task
    if _task is not None and not _task.done():
        _task.cancel()
        _task = None
