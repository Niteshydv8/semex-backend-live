"""Background task — monitors group membership expiry.

Runs every hour and:
  • Sends a reminder at 3 days before expiry (once)
  • Sends daily reminders at 2 days and 1 day before expiry
  • Kicks expired members and notifies them

Must be started from server.py lifespan alongside the other background tasks.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

log = logging.getLogger("semex.group_scheduler")

INTERVAL_SECONDS = 60 * 60  # check every hour

_task: Optional[asyncio.Task] = None


async def _check_group_memberships() -> None:
    from db import get_db
    from config import settings
    from services.telegram import send_message
    from services.group_manager import kick_member

    db = get_db()
    now = datetime.now(timezone.utc)
    default_group_id = int(getattr(settings, "PREMIUM_GROUP_ID", 0) or 0)

    cursor = db.group_memberships.find({"kicked": False})
    async for doc in cursor:
        tid = doc.get("telegram_id")
        expires_at = doc.get("expires_at")
        if not tid or not expires_at:
            continue
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)

        remaining_secs = (expires_at - now).total_seconds()
        remaining_days = remaining_secs / 86400

        # ── EXPIRED ──────────────────────────────────────────────────────────
        if remaining_secs <= 0:
            if doc.get("reminded_expired"):
                continue  # already processed
            # Notify the user
            try:
                await send_message(
                    tid,
                    "⏰ <b>SEMEX Private Group — Subscription Expired</b>\n"
                    "━━━━━━━━━━━━━━━━━━━━\n\n"
                    "Your access has ended and you have been removed from the group.\n\n"
                    "Use /buy to get a new subscription and rejoin. 🔄",
                )
            except Exception as e:
                log.warning("expired DM failed for %s: %s", tid, e)
            # Kick from group
            group_id = doc.get("group_id") or default_group_id
            try:
                await kick_member(group_id, tid)
            except Exception as e:
                log.warning("kick failed for %s in group %s: %s", tid, group_id, e)
            # Mark done
            try:
                await db.group_memberships.update_one(
                    {"_id": doc["_id"]},
                    {"$set": {"kicked": True, "kicked_at": now, "reminded_expired": True}},
                )
            except Exception as e:
                log.warning("membership expiry update failed for %s: %s", tid, e)
            continue

        # ── 3-DAY WARNING (sent once) ─────────────────────────────────────
        if remaining_days <= 3 and not doc.get("reminded_3d"):
            days_left = max(1, int(remaining_days) + 1)
            try:
                await send_message(
                    tid,
                    f"⚠️ <b>SEMEX Group — {days_left} day{'s' if days_left != 1 else ''} left</b>\n"
                    "━━━━━━━━━━━━━━━━━━━━\n\n"
                    f"Your private group access expires on "
                    f"<b>{expires_at:%Y-%m-%d %H:%M} UTC</b>.\n\n"
                    "Renew with /buy to keep access uninterrupted. 🔄",
                )
                await db.group_memberships.update_one(
                    {"_id": doc["_id"]}, {"$set": {"reminded_3d": True}}
                )
            except Exception as e:
                log.warning("3d reminder failed for %s: %s", tid, e)

        # ── 2-DAY DAILY REMINDER ─────────────────────────────────────────
        if remaining_days <= 2 and not doc.get("reminded_2d"):
            try:
                await send_message(
                    tid,
                    "⚠️ <b>SEMEX Group — 2 days left</b>\n"
                    "━━━━━━━━━━━━━━━━━━━━\n\n"
                    f"Expires: <b>{expires_at:%Y-%m-%d %H:%M} UTC</b>\n\n"
                    "Renew with /buy before you lose access. 🔄",
                )
                await db.group_memberships.update_one(
                    {"_id": doc["_id"]}, {"$set": {"reminded_2d": True}}
                )
            except Exception as e:
                log.warning("2d reminder failed for %s: %s", tid, e)

        # ── 1-DAY FINAL REMINDER ─────────────────────────────────────────
        if remaining_days <= 1 and not doc.get("reminded_1d"):
            try:
                await send_message(
                    tid,
                    "🚨 <b>SEMEX Group — Last day!</b>\n"
                    "━━━━━━━━━━━━━━━━━━━━\n\n"
                    f"Expires: <b>{expires_at:%Y-%m-%d %H:%M} UTC</b>\n\n"
                    "⚡ Renew NOW with /buy — access ends in hours!",
                )
                await db.group_memberships.update_one(
                    {"_id": doc["_id"]}, {"$set": {"reminded_1d": True}}
                )
            except Exception as e:
                log.warning("1d reminder failed for %s: %s", tid, e)


async def _loop() -> None:
    await asyncio.sleep(15)  # brief startup delay
    while True:
        try:
            await _check_group_memberships()
        except Exception as e:
            log.exception("group scheduler loop error: %s", e)
        await asyncio.sleep(INTERVAL_SECONDS)


def start_group_scheduler() -> None:
    global _task
    if _task is None or _task.done():
        _task = asyncio.create_task(_loop())
        log.info("group membership scheduler started (interval=%ss)", INTERVAL_SECONDS)


def stop_group_scheduler() -> None:
    global _task
    if _task is not None and not _task.done():
        _task.cancel()
    _task = None
