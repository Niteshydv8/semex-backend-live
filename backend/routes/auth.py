"""Auth routes: request OTP, verify OTP, redeem code, refresh, logout."""
from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field

from config import settings
from db import get_db
from deps import get_current_session_id, get_current_user, get_current_user_allow_expired, rate_limit
from models import OTP, RedeemCode, Session, User
from security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_otp,
    hash_otp,
    hash_redeem_code,
    verify_otp,
)
from services.telegram import (
    get_chat,
    get_user_photo_url,
    send_message,
    send_otp,
    send_welcome,
)
from services.extra_formatters import format_purchase_receipt

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RequestOTPBody(BaseModel):
    telegram_id: int = Field(alias="telegramId")
    fingerprint: Optional[str] = None

    model_config = {"populate_by_name": True}


class VerifyOTPBody(BaseModel):
    telegram_id: int = Field(alias="telegramId")
    otp: str
    fingerprint: str
    device_info: Optional[dict] = Field(default=None, alias="deviceInfo")

    model_config = {"populate_by_name": True}


class RedeemBody(BaseModel):
    code: str


class RefreshBody(BaseModel):
    refresh_token: str = Field(alias="refreshToken")

    model_config = {"populate_by_name": True}


PLAN_TAG_BY_DAYS = {
    1: "TRIAL",
    3: "TRIAL",
    7: "WEEKLY",
    10: "PLUS",
    14: "PLUS",
    30: "MONTHLY",
    90: "MONTHLY",
    180: "MONTHLY",
    365: "YEARLY",
}


def _plan_for_days(days: int) -> str:
    if days < 0:
        return "VIP"
    if days in PLAN_TAG_BY_DAYS:
        return PLAN_TAG_BY_DAYS[days]
    if days >= 365:
        return "YEARLY"
    if days >= 30:
        return "MONTHLY"
    if days >= 7:
        return "WEEKLY"
    return "TRIAL"


@router.post("/request-otp")
async def request_otp(body: RequestOTPBody, request: Request):
    await rate_limit(f"otp:{body.telegram_id}", settings.OTP_RATE_LIMIT_PER_HOUR)

    db = get_db()

    # Speed: run getChat + getUserProfilePhotos + user-doc-lookup in parallel
    # (was sequential — 3× Telegram round-trips added ~2s before OTP send).
    import asyncio
    chat, photo_url, existing = await asyncio.gather(
        get_chat(body.telegram_id),
        get_user_photo_url(body.telegram_id),
        db.users.find_one({"telegram_id": body.telegram_id}),
    )
    if not chat:
        raise HTTPException(
            400,
            f"Cannot reach your Telegram — please DM @{settings.TELEGRAM_BOT_USERNAME} first, then try again.",
        )

    # Replace raw Telegram file URL with our proxy URL (hides bot token)
    proxy_photo = f"/api/user-photo/{body.telegram_id}" if photo_url else None
    now = datetime.now(timezone.utc)

    if existing:
        await db.users.update_one(
            {"telegram_id": body.telegram_id},
            {
                "$set": {
                    "telegram_username": chat.get("username"),
                    "telegram_first_name": chat.get("first_name"),
                    "telegram_last_name": chat.get("last_name"),
                    "telegram_photo_url": proxy_photo,
                    "last_seen_at": now,
                }
            },
        )
        user_doc = await db.users.find_one({"telegram_id": body.telegram_id})
    else:
        # First-time — is this the admin? Give admin flag and VIP plan.
        is_admin = body.telegram_id == settings.ADMIN_TELEGRAM_ID
        new_user = User(
            telegram_id=body.telegram_id,
            telegram_username=chat.get("username"),
            telegram_first_name=chat.get("first_name"),
            telegram_last_name=chat.get("last_name"),
            telegram_photo_url=proxy_photo,
            is_admin=is_admin,
            plan="VIP" if is_admin else "TRIAL",
            plan_expires_at=None if is_admin else None,  # trial user has no code yet
            fingerprint=body.fingerprint,
            last_seen_at=now,
        )
        await db.users.insert_one(new_user.to_mongo())
        user_doc = await db.users.find_one({"telegram_id": body.telegram_id})

    user = User.from_mongo(user_doc)
    if user.is_banned:
        raise HTTPException(403, f"Banned: {user.banned_reason or 'no reason'}")

    # Generate + persist OTP.
    # NOTE: invalidate MUST complete before insert — running them in parallel
    # races the update_many across the fresh insert and can mark the new OTP
    # as `used=True` immediately, causing verify to return "No active OTP".
    otp_plain = generate_otp()
    otp_doc = OTP(
        telegram_id=body.telegram_id,
        code_hash=hash_otp(otp_plain),
        expires_at=now + timedelta(minutes=settings.OTP_TTL_MINUTES),
    )
    await db.otps.update_many(
        {"telegram_id": body.telegram_id, "used": False},
        {"$set": {"used": True}},
    )
    # Insert the new OTP + send it via Telegram in parallel (safe: they touch
    # disjoint resources).
    _insert_task, delivered = await asyncio.gather(
        db.otps.insert_one(otp_doc.to_mongo()),
        send_otp(body.telegram_id, otp_plain, settings.OTP_TTL_MINUTES),
    )
    if not delivered:
        raise HTTPException(502, "Failed to send OTP via Telegram")

    return {
        "success": True,
        "message": f"OTP sent to Telegram via @{settings.TELEGRAM_BOT_USERNAME}. Check your Telegram.",
        "expires_in": settings.OTP_TTL_MINUTES * 60,
    }


@router.post("/verify-otp")
async def verify_otp_endpoint(body: VerifyOTPBody, request: Request):
    await rate_limit(f"login:{body.telegram_id}", settings.LOGIN_RATE_LIMIT_PER_HOUR)

    db = get_db()

    # Find most recent unused, unexpired OTP
    now = datetime.now(timezone.utc)
    otp_doc = await db.otps.find_one(
        {
            "telegram_id": body.telegram_id,
            "used": False,
            "expires_at": {"$gt": now},
        },
        sort=[("created_at", -1)],
    )
    if not otp_doc:
        raise HTTPException(400, "No active OTP — request a new one.")
    if otp_doc.get("attempts", 0) >= 5:
        await db.otps.update_one({"_id": otp_doc["_id"]}, {"$set": {"used": True}})
        raise HTTPException(400, "Too many attempts. Request a new OTP.")
    if not verify_otp(body.otp, otp_doc["code_hash"]):
        await db.otps.update_one({"_id": otp_doc["_id"]}, {"$inc": {"attempts": 1}})
        raise HTTPException(400, "Invalid OTP.")

    # Mark OTP used
    await db.otps.update_one({"_id": otp_doc["_id"]}, {"$set": {"used": True}})

    # Load user
    user_doc = await db.users.find_one({"telegram_id": body.telegram_id})
    if not user_doc:
        raise HTTPException(400, "User not found — request OTP first.")
    user = User.from_mongo(user_doc)
    if user.is_banned:
        raise HTTPException(403, f"Banned: {user.banned_reason or 'no reason'}")

    # Enforce 4-device concurrent session limit (FIFO kick oldest)
    active_sessions = await db.sessions.count_documents(
        {"telegram_id": body.telegram_id, "revoked": False}
    )
    if active_sessions >= settings.MAX_DEVICES_PER_USER:
        # Revoke oldest active
        oldest = await db.sessions.find_one(
            {"telegram_id": body.telegram_id, "revoked": False},
            sort=[("last_used_at", 1)],
        )
        if oldest:
            await db.sessions.update_one(
                {"_id": oldest["_id"]}, {"$set": {"revoked": True}}
            )

    # Create new session
    session_id = secrets.token_urlsafe(24)
    session = Session(
        session_id=session_id,
        telegram_id=body.telegram_id,
        fingerprint=body.fingerprint,
        device_info=body.device_info or {},
        created_at=now,
        last_used_at=now,
        expires_at=now + timedelta(days=settings.REFRESH_TOKEN_TTL_DAYS),
    )
    await db.sessions.insert_one(session.to_mongo())

    access = create_access_token(session_id, body.telegram_id, body.fingerprint)
    refresh = create_refresh_token(session_id, body.telegram_id, body.fingerprint)

    # Fire off welcome (fresh users only — skip existing sessions)
    if active_sessions == 0:
        try:
            await send_welcome(body.telegram_id, user.telegram_username)
        except Exception:
            pass

    # Compute access status for client
    plan_expires_iso = None
    if user.plan_expires_at:
        pe = user.plan_expires_at
        if pe.tzinfo is None:
            pe = pe.replace(tzinfo=timezone.utc)
        plan_expires_iso = pe.isoformat()

    # Extension is FREE — everyone gets full access on login.
    has_access = True

    return {
        "success": True,
        "accessToken": access,
        "refreshToken": refresh,
        "sessionId": session_id,
        "hasAccess": has_access,
        "requiresRedeem": False,
        "user": {
            "telegramId": user.telegram_id,
            "username": user.telegram_username,
            "firstName": user.telegram_first_name,
            "lastName": user.telegram_last_name,
            "photoUrl": user.telegram_photo_url,
            "photoFileId": user.telegram_id if user.telegram_photo_url else None,
            "name": " ".join(filter(None, [user.telegram_first_name, user.telegram_last_name])) or user.telegram_username,
            "plan": user.plan,
            "planExpiresAt": plan_expires_iso,
            "isAdmin": user.is_admin,
            "status": "active",
            "is_banned": False,
        },
    }


@router.post("/redeem")
async def redeem(body: RedeemBody, user: User = Depends(get_current_user_allow_expired)):
    db = get_db()
    code_h = hash_redeem_code(body.code.strip().upper())
    doc = await db.redeem_codes.find_one({"code_hash": code_h})
    if not doc:
        raise HTTPException(400, "Invalid code.")
    if doc.get("used"):
        raise HTTPException(400, "Code already redeemed.")

    now = datetime.now(timezone.utc)
    duration_days = int(doc.get("duration_days", 0))
    plan_tag = doc.get("plan_tag") or _plan_for_days(duration_days)

    # Compute new expiry (stack onto existing if any)
    existing_expiry = user.plan_expires_at
    if existing_expiry and existing_expiry.tzinfo is None:
        existing_expiry = existing_expiry.replace(tzinfo=timezone.utc)
    base = existing_expiry if (existing_expiry and existing_expiry > now) else now

    if duration_days < 0:
        new_expiry = None  # lifetime
        plan_tag = "VIP"
    else:
        new_expiry = base + timedelta(days=duration_days)

    await db.users.update_one(
        {"telegram_id": user.telegram_id},
        {"$set": {"plan": plan_tag, "plan_expires_at": new_expiry, "expired_notified": False, "expiry_alerts_sent": {}}},
    )
    await db.redeem_codes.update_one(
        {"_id": doc["_id"]},
        {"$set": {"used": True, "used_by": user.telegram_id, "used_at": now}},
    )

    # Send purchase receipt to user via Telegram
    try:
        user_dict = user.model_dump()
        receipt = format_purchase_receipt(
            user_dict, plan_tag, duration_days, new_expiry, doc.get("code_preview", "SEMEX-****")
        )
        await send_message(user.telegram_id, receipt)
    except Exception:
        pass

    return {
        "success": True,
        "plan": plan_tag,
        "planExpiresAt": new_expiry.isoformat() if new_expiry else None,
        "durationDays": duration_days,
    }


@router.post("/refresh")
async def refresh_token(body: RefreshBody):
    payload = decode_token(body.refresh_token)
    if not payload or payload.get("typ") != "refresh":
        raise HTTPException(401, "Invalid refresh token.")

    session_id = payload.get("sid")
    telegram_id = payload.get("tid")
    fp = payload.get("fp")

    db = get_db()
    sess = await db.sessions.find_one({"session_id": session_id})
    if not sess or sess.get("revoked"):
        raise HTTPException(401, "Session revoked.")

    now = datetime.now(timezone.utc)
    await db.sessions.update_one(
        {"session_id": session_id}, {"$set": {"last_used_at": now}}
    )
    return {
        "accessToken": create_access_token(session_id, telegram_id, fp),
    }


@router.post("/logout")
async def logout(session_id: str = Depends(get_current_session_id)):
    db = get_db()
    await db.sessions.update_one(
        {"session_id": session_id}, {"$set": {"revoked": True}}
    )
    return {"success": True}


@router.get("/session")
async def get_session(user: User = Depends(get_current_user_allow_expired)):
    """Verify current token — used by extension on startup.

    Uses the allow-expired dependency so an expired user STAYS logged in (session
    persists) and simply sees requiresRedeem=true, instead of being forced back to
    the OTP login screen.
    """
    plan_expires_iso = None
    if user.plan_expires_at:
        pe = user.plan_expires_at
        if pe.tzinfo is None:
            pe = pe.replace(tzinfo=timezone.utc)
        plan_expires_iso = pe.isoformat()
    # Extension is FREE — every logged-in user has full access.
    has_access = True
    return {
        "valid": True,
        "hasAccess": has_access,
        "requiresRedeem": False,
        "user": {
            "telegramId": user.telegram_id,
            "username": user.telegram_username,
            "firstName": user.telegram_first_name,
            "lastName": user.telegram_last_name,
            "photoUrl": user.telegram_photo_url,
            "photoFileId": user.telegram_id if user.telegram_photo_url else None,
            "name": " ".join(filter(None, [user.telegram_first_name, user.telegram_last_name])) or user.telegram_username,
            "plan": user.plan,
            "planExpiresAt": plan_expires_iso,
            "isAdmin": user.is_admin,
            "status": "active",
            "is_banned": False,
        },
    }
