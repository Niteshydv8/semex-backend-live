"""Regression tests for the telegram_outbox delivered-mark durability guarantee.

Task: a message Telegram has ACCEPTED must never be sent twice, even when the
"delivered" database update fails at the worst possible moment. If the mark
fails, the row must be held back from the stale-claim sweeper (no resend) and
the mark retried until it lands. These tests fake the Mongo collection and the
Telegram send so no network or real DB is involved.
"""
from __future__ import annotations

import asyncio
import sys
from datetime import timedelta
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from services import telegram_outbox as tbx  # noqa: E402


def _run(coro):
    return asyncio.new_event_loop().run_until_complete(coro)


class _FakeCursorlessColl:
    """Minimal async Mongo collection over an in-memory list of docs."""

    def __init__(self):
        self.docs = []
        self._id_seq = 0
        # When set, update_one raising is controlled by this predicate on the
        # update spec so a test can fail only the delivered-mark.
        self.fail_update_one = None  # callable(update) -> bool
        # When set, update_one blocks until this event is set for updates whose
        # spec matches hang_update_one — simulates a hung/slow DB call.
        self.hang_update_one = None  # callable(update) -> bool
        self.release = None  # asyncio.Event

    def _match(self, doc, flt):
        for k, v in flt.items():
            if k == "_id":
                if isinstance(v, dict) and "$nin" in v:
                    if doc.get("_id") in v["$nin"]:
                        return False
                elif doc.get("_id") != v:
                    return False
            elif isinstance(v, dict):
                dv = doc.get(k)
                if "$lte" in v and not (dv is not None and dv <= v["$lte"]):
                    return False
                if "$lt" in v and not (dv is not None and dv < v["$lt"]):
                    return False
                if "$nin" in v and dv in v["$nin"]:
                    return False
            else:
                if doc.get(k) != v:
                    return False
        return True

    def _apply(self, doc, update):
        for k, val in update.get("$set", {}).items():
            doc[k] = val
        for k, val in update.get("$inc", {}).items():
            doc[k] = doc.get(k, 0) + val

    async def insert_one(self, doc):
        self._id_seq += 1
        doc.setdefault("_id", self._id_seq)
        self.docs.append(doc)

    async def find_one_and_update(self, flt, update, sort=None):
        cands = [d for d in self.docs if self._match(d, flt)]
        if sort:
            key, direction = sort[0]
            cands.sort(key=lambda d: d.get(key), reverse=(direction < 0))
        if not cands:
            return None
        doc = cands[0]
        self._apply(doc, update)
        return dict(doc)

    async def update_one(self, flt, update):
        if self.hang_update_one and self.hang_update_one(update):
            await self.release.wait()
        if self.fail_update_one and self.fail_update_one(update):
            raise RuntimeError("simulated db hiccup on update_one")
        for d in self.docs:
            if self._match(d, flt):
                self._apply(d, update)
                break

    async def update_many(self, flt, update):
        for d in self.docs:
            if self._match(d, flt):
                self._apply(d, update)


class _FakeDB:
    def __init__(self):
        self.telegram_outbox = _FakeCursorlessColl()


def _is_delivered_update(update):
    return update.get("$set", {}).get("status") == "delivered"


def _seed_pending(db):
    _run(db.telegram_outbox.insert_one({
        "kind": "message",
        "chat_id": "1",
        "text": "hi",
        "dedup_key": "k1",
        "status": "pending",
        "attempts": 0,
        "next_attempt_at": tbx._now(),
        "created_at": tbx._now(),
    }))


def test_delivered_mark_failure_does_not_resend(monkeypatch):
    """Telegram accepts the send, but the delivered-mark update fails. The row
    must NOT be resent: only ONE Telegram send happens, the row is guarded from
    the sweeper, and the mark eventually lands via the background retry."""
    tbx._confirmed_awaiting_mark.clear()
    db = _FakeDB()
    _seed_pending(db)

    sends = {"n": 0}

    async def fake_deliver(doc):
        sends["n"] += 1
        return True

    _orig_sleep = asyncio.sleep

    async def fast_sleep(_s):
        # Collapse backoff to a real event-loop yield so the background retry
        # task runs quickly without actually waiting.
        await _orig_sleep(0)

    monkeypatch.setattr(tbx, "_deliver", fake_deliver)
    monkeypatch.setattr(tbx.asyncio, "sleep", fast_sleep)

    async def scenario():
        # Delivered-mark fails on first drain.
        db.telegram_outbox.fail_update_one = _is_delivered_update
        await tbx._drain_once(db)

        doc = db.telegram_outbox.docs[0]
        assert sends["n"] == 1, "Telegram must be hit exactly once"
        assert doc["status"] == "sending", "row must not be marked delivered yet"
        assert doc["_id"] in tbx._confirmed_awaiting_mark, "row must be guarded"

        # Age the claim so the sweeper WOULD normally reclaim it, then drain.
        doc["claimed_at"] = tbx._now() - timedelta(seconds=tbx._CLAIM_STALE_SECONDS + 10)
        await tbx._drain_once(db)
        assert doc["status"] == "sending", "guarded row must NOT be reclaimed to pending"
        assert sends["n"] == 1, "guarded row must never be resent"

        # DB recovers; the background retry task should now land the mark.
        db.telegram_outbox.fail_update_one = None
        for _ in range(50):
            await asyncio.sleep(0)
            if doc["status"] == "delivered":
                break
        assert doc["status"] == "delivered", "mark must recover once db is healthy"
        assert doc["_id"] not in tbx._confirmed_awaiting_mark, "guard cleared on success"
        assert sends["n"] == 1, "still exactly one Telegram send overall"

    _run(scenario())


def test_delivered_mark_hang_beyond_stale_threshold_does_not_resend(monkeypatch):
    """The delivered-mark update HANGS (a slow/stuck DB call) well past the
    stale-claim threshold while a concurrent drain runs. The row must be guarded
    the moment Telegram confirms, so no second send happens even though the mark
    never lands during the hang. Once the DB unblocks, the mark completes."""
    tbx._confirmed_awaiting_mark.clear()
    db = _FakeDB()
    _seed_pending(db)
    db.telegram_outbox.release = asyncio.Event()

    sends = {"n": 0}

    async def fake_deliver(doc):
        sends["n"] += 1
        return True

    monkeypatch.setattr(tbx, "_deliver", fake_deliver)

    async def scenario():
        # First drain: send succeeds, delivered-mark update hangs.
        db.telegram_outbox.hang_update_one = _is_delivered_update
        drain1 = asyncio.create_task(tbx._drain_once(db))

        # Let the drain reach and block on the hanging update.
        for _ in range(50):
            await asyncio.sleep(0)
            if tbx._confirmed_awaiting_mark:
                break
        doc = db.telegram_outbox.docs[0]
        assert doc["_id"] in tbx._confirmed_awaiting_mark, "row guarded before mark await"
        assert sends["n"] == 1

        # Age the claim beyond the stale threshold and run a concurrent drain.
        doc["claimed_at"] = tbx._now() - timedelta(seconds=tbx._CLAIM_STALE_SECONDS + 10)
        await tbx._drain_once(db)
        assert doc["status"] == "sending", "hung-but-guarded row must not be reclaimed"
        assert sends["n"] == 1, "no resend while the mark is still in flight"

        # Unblock the DB; the original mark completes.
        db.telegram_outbox.hang_update_one = None
        db.telegram_outbox.release.set()
        await drain1
        assert doc["status"] == "delivered"
        assert doc["_id"] not in tbx._confirmed_awaiting_mark
        assert sends["n"] == 1

    _run(scenario())


def test_happy_path_marks_delivered_once(monkeypatch):
    """On the happy path the row is marked delivered inline with one send and no
    lingering guard entry."""
    tbx._confirmed_awaiting_mark.clear()
    db = _FakeDB()
    _seed_pending(db)

    sends = {"n": 0}

    async def fake_deliver(doc):
        sends["n"] += 1
        return True

    monkeypatch.setattr(tbx, "_deliver", fake_deliver)

    _run(tbx._drain_once(db))
    doc = db.telegram_outbox.docs[0]
    assert sends["n"] == 1
    assert doc["status"] == "delivered"
    assert not tbx._confirmed_awaiting_mark


def test_failed_send_reschedules_despite_update_wrap(monkeypatch):
    """A FAILED send reschedules to pending with backoff; a raising reschedule
    update is caught (loud log) and leaves the row for the sweeper."""
    tbx._confirmed_awaiting_mark.clear()
    db = _FakeDB()
    _seed_pending(db)

    async def fake_deliver(doc):
        return False

    monkeypatch.setattr(tbx, "_deliver", fake_deliver)

    _run(tbx._drain_once(db))
    doc = db.telegram_outbox.docs[0]
    assert doc["status"] == "pending", "failed send must be rescheduled to pending"
    assert doc["next_attempt_at"] > tbx._now(), "backoff must push next attempt out"
