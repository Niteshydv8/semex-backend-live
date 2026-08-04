"""Common dependencies — request auth, HMAC verify, admin gate, rate limiting."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, Header, HTTPException, Request

from config import settings
from db import get_db
from models import Session, User
from security import decode_token, verify_hmac

log = logging.getLogger("semex.deps")


async def _get_bearer(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1].strip()


async def get_current_user(
    request: Request,
    authorization: Optional[str] = Header(default=None),
    x_fingerprint: Optional[str] = Header(default=None, alias="X-Fingerprint"),
) -> User:
    """Decode access token, ensure session valid, return user."""
    token = await _get_bearer(authorization)
    if not token:
        raise HTTPException(401, "Missing bearer token")
    payload = decode_token(token)
    if not payload or payload.get("typ") != "access":
        raise HTTPException(401, "Invalid token")

    session_id = payload.get("sid")
    telegram_id = payload.get("tid")
    fp = payload.get("fp")
    if not session_id or not telegram_id:
        raise HTTPException(401, "Malformed token")

    if x_fingerprint and fp and x_fingerprint != fp:
        # Soft check: the signed JWT + a valid (non-revoked) session already
        # authenticate this request strongly. A fingerprint mismatch used to hard
        # 401 here, which silently dropped hit submissions when the popup and the
        # background service worker derived slightly different fingerprints. Log it
        # instead of rejecting so hits are never lost over this secondary binding.
        log.warning("fingerprint mismatch (soft) sid=%s tid=%s", session_id, telegram_id)

    db = get_db()
    sess_doc = await db.sessions.find_one({"session_id": session_id})
    if not sess_doc or sess_doc.get("revoked"):
        raise HTTPException(401, "Session revoked")

    user_doc = await db.users.find_one({"telegram_id": telegram_id})
    if not user_doc:
        raise HTTPException(401, "User not found")
    user = User.from_mongo(user_doc)
    if user.is_banned:
        raise HTTPException(403, f"Banned: {user.banned_reason or 'no reason given'}")

    # Extension is FREE for all users — plan expiry check disabled.
    # (Admin panel access is still gated by is_admin via require_admin/require_owner.)
    # Update session last_used
    await db.sessions.update_one(
        {"session_id": session_id},
        {"$set": {"last_used_at": datetime.now(timezone.utc)}},
    )
    return user


async def get_current_user_allow_expired(
    request: Request,
    authorization: Optional[str] = Header(default=None),
    x_fingerprint: Optional[str] = Header(default=None, alias="X-Fingerprint"),
) -> User:
    """Same as get_current_user but does NOT reject expired plans.

    Used by /api/auth/redeem so an expired user can redeem a new code to renew
    (otherwise get_current_user's 402 makes renewal impossible = catch-22).
    """
    token = await _get_bearer(authorization)
    if not token:
        raise HTTPException(401, "Missing bearer token")
    payload = decode_token(token)
    if not payload or payload.get("typ") != "access":
        raise HTTPException(401, "Invalid token")

    session_id = payload.get("sid")
    telegram_id = payload.get("tid")
    fp = payload.get("fp")
    if not session_id or not telegram_id:
        raise HTTPException(401, "Malformed token")
    if x_fingerprint and fp and x_fingerprint != fp:
        log.warning("fingerprint mismatch (soft, allow-expired) sid=%s tid=%s", session_id, telegram_id)

    db = get_db()
    sess_doc = await db.sessions.find_one({"session_id": session_id})
    if not sess_doc or sess_doc.get("revoked"):
        raise HTTPException(401, "Session revoked")

    user_doc = await db.users.find_one({"telegram_id": telegram_id})
    if not user_doc:
        raise HTTPException(401, "User not found")
    user = User.from_mongo(user_doc)
    if user.is_banned:
        raise HTTPException(403, f"Banned: {user.banned_reason or 'no reason given'}")

    await db.sessions.update_one(
        {"session_id": session_id},
        {"$set": {"last_used_at": datetime.now(timezone.utc)}},
    )
    return user


async def get_current_session_id(
    authorization: Optional[str] = Header(default=None),
) -> str:
    token = await _get_bearer(authorization)
    if not token:
        raise HTTPException(401, "Missing bearer token")
    payload = decode_token(token)
    if not payload:
        raise HTTPException(401, "Invalid token")
    sid = payload.get("sid")
    if not sid:
        raise HTTPException(401, "Malformed token")
    return sid


async def require_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin and user.telegram_id != settings.ADMIN_TELEGRAM_ID:
        raise HTTPException(403, "Admin only")
    return user


async def require_owner(user: User = Depends(get_current_user)) -> User:
    """Only the primary owner (ADMIN_TELEGRAM_ID in .env) — not promoted admins.

    Used for high-risk operations like promoting/demoting other users to admin.
    """
    if user.telegram_id != settings.ADMIN_TELEGRAM_ID:
        raise HTTPException(403, "Owner only")
    return user


# ---------- Rate limiting ----------

async def rate_limit(key: str, max_per_hour: int) -> None:
    """Sliding-hour rate limit via Mongo. Raises 429 when exceeded."""
    db = get_db()
    now = datetime.now(timezone.utc)
    window_start = now.replace(minute=0, second=0, microsecond=0)
    expires_at = window_start + timedelta(hours=2)  # keep 2h so TTL cleanup catches later
    doc = await db.rate_limits.find_one_and_update(
        {"key": key, "window": window_start},
        {"$inc": {"count": 1}, "$setOnInsert": {"expires_at": expires_at}},
        upsert=True,
        return_document=True,
    )
    if doc and doc.get("count", 0) > max_per_hour:
        raise HTTPException(429, f"Rate limit exceeded ({max_per_hour}/hr)")
