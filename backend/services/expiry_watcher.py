"""Background task — checks for users whose access is about to expire (24h/12h/1h)
and sends them a Telegram reminder. Also flags fully-expired users.
Runs every 30 minutes via asyncio.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from db import get_db
from services.extra_formatters import format_expired, format_expiry_alert
from services.telegram import send_message

log = logging.getLogger("semex.expiry")

# Notification windows (hours before expiry)
ALERT_WINDOWS = [24, 12, 1]

# How often we run the check
INTERVAL_SECONDS = 30 * 60  # 30 minutes


async def _check_and_alert():
    db = get_db()
    now = datetime.now(timezone.utc)

    # For each alert window, find users whose expiry falls in [now + window, now + window + interval]
    # and who haven't been notified for this window yet.
    for hours in ALERT_WINDOWS:
        window_start = now + timedelta(hours=hours) - timedelta(seconds=INTERVAL_SECONDS / 2)
        window_end = now + timedelta(hours=hours) + timedelta(seconds=INTERVAL_SECONDS / 2)
        cursor = db.users.find(
            {
                "is_admin": {"$ne": True},
                "is_banned": {"$ne": True},
                "plan_expires_at": {"$gt": window_start, "$lt": window_end},
                f"expiry_alerts_sent.{hours}": {"$ne": True},
            }
        )
        async for user_doc in cursor:
            try:
                text = format_expiry_alert(user_doc, hours)
                r = await send_message(user_doc["telegram_id"], text)
                if r and r.get("ok"):
                    await db.users.update_one(
                        {"_id": user_doc["_id"]},
                        {"$set": {f"expiry_alerts_sent.{hours}": True}},
                    )
            except Exception as e:
                log.warning("expiry alert failed for %s: %s", user_doc.get("telegram_id"), e)

    # Fully expired — send one-time "expired" notification & set plan to *Dead*
    expired_cursor = db.users.find(
        {
            "is_admin": {"$ne": True},
            "is_banned": {"$ne": True},
            "plan_expires_at": {"$lt": now},
            "expired_notified": {"$ne": True},
        }
    )
    async for user_doc in expired_cursor:
        try:
            text = format_expired(user_doc)
            r = await send_message(user_doc["telegram_id"], text)
            if r and r.get("ok"):
                await db.users.update_one(
                    {"_id": user_doc["_id"]},
                    {"$set": {"expired_notified": True, "plan": "*Dead*"}},
                )
        except Exception as e:
            log.warning("expired notify failed for %s: %s", user_doc.get("telegram_id"), e)


async def _loop():
    # small startup delay so DB indexes finish
    await asyncio.sleep(10)
    while True:
        try:
            await _check_and_alert()
        except Exception as e:
            log.exception("expiry loop error: %s", e)
        await asyncio.sleep(INTERVAL_SECONDS)


_task: Optional[asyncio.Task] = None


def start_expiry_task() -> None:
    global _task
    if _task is None or _task.done():
        _task = asyncio.create_task(_loop())
        log.info("expiry task started (interval=%ss)", INTERVAL_SECONDS)


def stop_expiry_task() -> None:
    global _task
    if _task is not None and not _task.done():
        _task.cancel()
        _task = None
