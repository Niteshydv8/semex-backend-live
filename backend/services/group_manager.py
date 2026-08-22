"""Telegram group membership management — invite links, kicks, upsert logic.

The bot must be admin with 'Invite Users' and 'Ban Members' permissions in
PREMIUM_GROUP_ID for any of these to work.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from services.telegram import _post

log = logging.getLogger("semex.group_manager")


# ─── Telegram API helpers ────────────────────────────────────────────────────

async def create_one_time_invite_link(group_id: int) -> Optional[str]:
    """Create a one-time-use invite link (member_limit=1, expires in 2 hours).

    Returns the invite URL string, or None if the API call fails (e.g. bot
    lacks admin rights or group_id is wrong).
    """
    if not group_id:
        log.warning("create_one_time_invite_link called with empty group_id")
        return None
    expire_date = int((datetime.now(timezone.utc) + timedelta(hours=2)).timestamp())
    r = await _post("createChatInviteLink", {
        "chat_id": group_id,
        "member_limit": 1,
        "expire_date": expire_date,
    })
    if r and r.get("ok"):
        link = (r.get("result") or {}).get("invite_link")
        if link:
            return link
    log.warning("createChatInviteLink failed for group %s: %s", group_id, r)
    return None


async def kick_member(group_id: int, telegram_id: int) -> bool:
    """Remove a user from the group.

    Bans then immediately unbans so they are removed but can re-join later
    with a new invite link if they renew their subscription.
    Returns True on success, False on failure.
    """
    if not group_id or not telegram_id:
        return False
    ban_r = await _post("banChatMember", {
        "chat_id": group_id,
        "user_id": telegram_id,
    })
    if not (ban_r and ban_r.get("ok")):
        log.warning("banChatMember failed for user %s in group %s: %s", telegram_id, group_id, ban_r)
        return False
    # Unban immediately so a future invite link works for them.
    await _post("unbanChatMember", {
        "chat_id": group_id,
        "user_id": telegram_id,
        "only_if_banned": True,
    })
    log.info("kicked user %s from group %s", telegram_id, group_id)
    return True


# ─── Membership CRUD ─────────────────────────────────────────────────────────

async def get_active_membership(telegram_id: int) -> Optional[dict]:
    """Return the user's active (non-expired, non-kicked) group membership doc."""
    from db import get_db
    now = datetime.now(timezone.utc)
    return await get_db().group_memberships.find_one({
        "telegram_id": telegram_id,
        "expires_at": {"$gt": now},
        "kicked": False,
    })


async def upsert_group_membership(
    *,
    telegram_id: int,
    username: Optional[str],
    group_id: int,
    plan: str,           # "7d" | "14d" | "30d"
    payment_method: str, # "stars" | "usdt_crypto" | "manual"
    payment_ref: Optional[str] = None,
) -> tuple[dict, str]:
    """Create a new group membership or extend an existing one.

    Returns (membership_doc, action) where action is:
    - "renewed"  — user is still in the group; expiry was pushed forward
    - "rejoin"   — subscription had lapsed but they weren't kicked yet; reset
    - "created"  — brand-new member (or previously kicked)
    """
    from db import get_db
    db = get_db()
    plan_days = {"7d": 7, "14d": 14, "30d": 30}.get(plan, 7)
    now = datetime.now(timezone.utc)

    # Look for ANY non-kicked record (active or recently lapsed)
    existing = await db.group_memberships.find_one({
        "telegram_id": telegram_id,
        "kicked": False,
    })

    if existing:
        expires_at = existing.get("expires_at")
        if expires_at and expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        is_active = bool(expires_at and expires_at > now)
        base = expires_at if is_active else now
        new_expiry = base + timedelta(days=plan_days)
        action = "renewed" if is_active else "rejoin"

        await db.group_memberships.update_one(
            {"_id": existing["_id"]},
            {"$set": {
                "expires_at": new_expiry,
                "plan": plan,
                "telegram_username": username,
                "payment_method": payment_method,
                "payment_ref": payment_ref,
                "kicked": False,
                "kicked_at": None,
                "reminded_3d": False,
                "reminded_2d": False,
                "reminded_1d": False,
                "reminded_expired": False,
                **({"started_at": now} if not is_active else {}),
            }},
        )
        return {**existing, "expires_at": new_expiry, "plan": plan}, action
    else:
        # Brand-new member (or was previously kicked — kicked records stay in DB)
        new_expiry = now + timedelta(days=plan_days)
        doc = {
            "telegram_id": telegram_id,
            "telegram_username": username,
            "group_id": group_id,
            "plan": plan,
            "started_at": now,
            "expires_at": new_expiry,
            "invite_link": None,
            "payment_method": payment_method,
            "payment_ref": payment_ref,
            "kicked": False,
            "kicked_at": None,
            "reminded_3d": False,
            "reminded_2d": False,
            "reminded_1d": False,
            "reminded_expired": False,
        }
        result = await db.group_memberships.insert_one(doc)
        doc["_id"] = result.inserted_id
        return doc, "created"
