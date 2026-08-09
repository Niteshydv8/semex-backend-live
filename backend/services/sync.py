"""In-process SSE sync manager — publishes state-change events to live dashboard clients.

Each authenticated SSE connection (GET /api/user/stream) registers an asyncio.Queue here.
Backend mutators (save_settings, add_bin, submit_status, put_user_state …) call
sync_manager.publish() after committing to MongoDB so all open dashboards update within
~1 s without any polling.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Dict, List

log = logging.getLogger("semex.sync")


class SyncManager:
    """Thread-safe (single event-loop) queue registry keyed by telegram_id."""

    def __init__(self) -> None:
        self._subs: Dict[int, List[asyncio.Queue]] = {}

    # ── subscription lifecycle ──────────────────────────────────────────────

    def subscribe(self, telegram_id: int, queue: "asyncio.Queue[dict]") -> None:
        self._subs.setdefault(telegram_id, []).append(queue)
        log.debug("SSE +sub tid=%s total=%s", telegram_id, len(self._subs[telegram_id]))

    def unsubscribe(self, telegram_id: int, queue: "asyncio.Queue[dict]") -> None:
        lst = self._subs.get(telegram_id)
        if lst:
            try:
                lst.remove(queue)
            except ValueError:
                pass
            if not lst:
                self._subs.pop(telegram_id, None)
        log.debug("SSE -sub tid=%s", telegram_id)

    # ── publishing ──────────────────────────────────────────────────────────

    def publish(self, telegram_id: int, event_type: str, data: dict | None = None) -> int:
        """Enqueue an event for every SSE subscriber of *telegram_id*.

        Returns the number of queues that were notified (0 if nobody is connected).
        Silently drops the event for any queue that is already full (maxsize=50)
        rather than blocking the calling coroutine.
        """
        queues = self._subs.get(telegram_id, [])
        sent = 0
        for q in list(queues):
            try:
                q.put_nowait({"type": event_type, "data": data or {}})
                sent += 1
            except asyncio.QueueFull:
                log.warning("SSE queue full tid=%s — dropping %s", telegram_id, event_type)
        return sent

    @property
    def connected_count(self) -> int:
        return sum(len(v) for v in self._subs.values())


# Single process-wide instance imported by all routes
sync_manager = SyncManager()
