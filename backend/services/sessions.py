"""Shared session issuance for every login path (OTP verify, Telegram
deep-link authorize). Single source of truth so the device-limit and
token-minting logic can't drift between paths."""
from __future__ import annotations

import asyncio
import secrets
from datetime import datetime, timedelta, timezone

from config import settings
from models import Session
from security import create_access_token, create_refresh_token

# Per-user locks serialize session creation: concurrent logins could otherwise
# both observe "below limit" and exceed MAX_DEVICES_PER_USER.
_session_locks: dict = {}


def _get_session_lock(telegram_id) -> asyncio.Lock:
    lock = _session_locks.get(telegram_id)
    if lock is None:
        lock = asyncio.Lock()
        _session_locks[telegram_id] = lock
        if len(_session_locks) > 10000:  # bound memory; holders keep their ref
            _session_locks.clear()
            _session_locks[telegram_id] = lock
    return lock


async def issue_session(
    db,
    telegram_id: int,
    fingerprint: str,
    device_info: dict | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> dict:
    """Enforce the concurrent-device limit (FIFO: revoke oldest), create a new
    session and mint its token pair.

    Returns {sessionId, accessToken, refreshToken, isFirstSession}.
    """
    now = datetime.now(timezone.utc)
    async with _get_session_lock(telegram_id):
        active_sessions = await db.sessions.count_documents(
            {"telegram_id": telegram_id, "revoked": False}
        )
        if active_sessions >= settings.MAX_DEVICES_PER_USER:
            oldest = await db.sessions.find_one(
                {"telegram_id": telegram_id, "revoked": False},
                sort=[("last_used_at", 1)],
            )
            if oldest:
                await db.sessions.update_one(
                    {"_id": oldest["_id"]}, {"$set": {"revoked": True}}
                )

        session_id = secrets.token_urlsafe(24)
        session = Session(
            session_id=session_id,
            telegram_id=telegram_id,
            fingerprint=fingerprint or "",
            device_info=device_info or {},
            ip_address=ip_address,
            user_agent=user_agent,
            created_at=now,
            last_used_at=now,
            expires_at=now + timedelta(days=settings.REFRESH_TOKEN_TTL_DAYS),
        )
        await db.sessions.insert_one(session.to_mongo())

    return {
        "sessionId": session_id,
        "accessToken": create_access_token(session_id, telegram_id, fingerprint),
        "refreshToken": create_refresh_token(session_id, telegram_id, fingerprint),
        "isFirstSession": active_sessions == 0,
    }
