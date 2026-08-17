"""Auth routes: request OTP, verify OTP, redeem code, refresh, logout."""
from __future__ import annotations

import logging
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
from services.sessions import issue_session
from services.extra_formatters import format_purchase_receipt

log = logging.getLogger("semex.auth")

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _client_ip(request: Request) -> str:
    """Best-effort client IP: prefer the first X-Forwarded-For hop (Railway /
    reverse proxy), fall back to the direct peer."""
    fwd = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    if fwd:
        return fwd
    return request.client.host if request.client else ""


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
        # Consistency: the OTP row was already inserted — revoke it so a code
        # the user never received can't be used later (and doesn't count as an
        # "active OTP" blocking fresh requests).
        try:
            await db.otps.update_one({"_id": _insert_task.inserted_id}, {"$set": {"used": True}})
        except Exception:
            pass
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

    # Atomically claim the OTP: only the request that flips used False→True
    # proceeds. Prevents two concurrent valid verifies from minting two
    # sessions off the same code.
    claimed = await db.otps.find_one_and_update(
        {"_id": otp_doc["_id"], "used": False},
        {"$set": {"used": True}},
    )
    if not claimed:
        raise HTTPException(400, "OTP already used — request a new one.")

    # Load user
    user_doc = await db.users.find_one({"telegram_id": body.telegram_id})
    if not user_doc:
        raise HTTPException(400, "User not found — request OTP first.")
    user = User.from_mongo(user_doc)
    if user.is_banned:
        raise HTTPException(403, f"Banned: {user.banned_reason or 'no reason'}")

    # Session issuance is shared with the Telegram deep-link login path
    # (services/sessions.py) so device-limit + minting logic can't drift.
    issued = await issue_session(
        db,
        body.telegram_id,
        body.fingerprint,
        device_info=body.device_info,
        ip_address=_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    session_id = issued["sessionId"]
    access = issued["accessToken"]
    refresh = issued["refreshToken"]

    # Fire off welcome (fresh users only — skip existing sessions)
    if issued["isFirstSession"]:
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

    # Accounts created via Telegram deep-link login start LOCKED
    # (requires_redeem=True) until they redeem an invite code; everyone who
    # already had an account keeps full access.
    requires_redeem = bool(getattr(user, "requires_redeem", False))
    has_access = not requires_redeem

    return {
        "success": True,
        "accessToken": access,
        "refreshToken": refresh,
        "sessionId": session_id,
        "hasAccess": has_access,
        "requiresRedeem": requires_redeem,
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

    # Atomically claim the code BEFORE granting entitlement. Only the request
    # that flips used→True wins; a concurrent duplicate gets None and is
    # rejected, so a single code can never extend two accounts (or one twice).
    claimed = await db.redeem_codes.find_one_and_update(
        {"_id": doc["_id"], "used": {"$ne": True}},
        {"$set": {"used": True, "used_by": user.telegram_id, "used_at": now}},
    )
    if not claimed:
        raise HTTPException(400, "Code already redeemed.")
    try:
        await db.users.update_one(
            {"telegram_id": user.telegram_id},
            {"$set": {"plan": plan_tag, "plan_expires_at": new_expiry, "expired_notified": False, "expiry_alerts_sent": {}, "requires_redeem": False}},
        )
    except Exception:
        # v2.9.3: never burn a valid code — if the entitlement write fails
        # (Mongo blip/timeout), roll the claim back so the user can retry.
        try:
            await db.redeem_codes.update_one(
                {"_id": doc["_id"]},
                {"$set": {"used": False}, "$unset": {"used_by": "", "used_at": ""}},
            )
        except Exception:
            log.error("redeem rollback ALSO failed for code %s — manual fix needed", doc.get("code_preview"))
        raise HTTPException(500, "Redemption failed — please try again. Your code was NOT used.")

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
    requires_redeem = bool(getattr(user, "requires_redeem", False))
    has_access = not requires_redeem
    return {
        "valid": True,
        "hasAccess": has_access,
        "requiresRedeem": requires_redeem,
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


# ─── Telegram deep-link login ────────────────────────────────────────────────
# Flow: extension calls /start → opens t.me/<bot>?start=login_<token> → bot
# binds the token to the first Telegram account that opens it and sends an
# Authorize/Deny card → on Authorize the bot mints the session and stores the
# auth payload on the token doc → extension polls /status until authorized.
TELEGRAM_LOGIN_TTL_SECONDS = 300  # 5 min, same as OTP


class TelegramLoginStartBody(BaseModel):
    fingerprint: str
    device_info: Optional[dict] = Field(default=None, alias="deviceInfo")

    model_config = {"populate_by_name": True}


@router.post("/telegram-login/start")
async def telegram_login_start(body: TelegramLoginStartBody, request: Request):
    ip = _client_ip(request)
    await rate_limit(f"tglogin-start:{ip or body.fingerprint}", settings.LOGIN_RATE_LIMIT_PER_HOUR * 2)

    db = get_db()
    now = datetime.now(timezone.utc)
    token = "login_" + secrets.token_urlsafe(24)
    await db.telegram_login_tokens.insert_one({
        "token": token,
        "status": "pending",  # pending → authorized | denied | expired
        "fingerprint": body.fingerprint,
        "device_info": body.device_info or {},
        "ip": ip,
        "user_agent": request.headers.get("user-agent", ""),
        "telegram_id": None,   # bound when someone opens the deep link
        "auth_payload": None,  # filled by the bot on authorize
        "created_at": now,
        "expires_at": now + timedelta(seconds=TELEGRAM_LOGIN_TTL_SECONDS),
    })
    # Best-effort sweep of ancient tokens so the collection can't grow forever.
    try:
        await db.telegram_login_tokens.delete_many(
            {"expires_at": {"$lt": now - timedelta(hours=1)}}
        )
    except Exception:
        pass

    return {
        "success": True,
        "token": token,
        "botUsername": settings.TELEGRAM_BOT_USERNAME,
        "deepLink": f"https://t.me/{settings.TELEGRAM_BOT_USERNAME}?start={token}",
        "expiresIn": TELEGRAM_LOGIN_TTL_SECONDS,
    }


@router.get("/telegram-login/status")
async def telegram_login_status(token: str = ""):
    """Polled by the extension's background worker while the user authorizes
    in Telegram. Short-lived bearer token; polling cost is trivial."""
    if not token or len(token) > 80:
        raise HTTPException(400, "Invalid token.")
    db = get_db()
    doc = await db.telegram_login_tokens.find_one({"token": token})
    if not doc:
        raise HTTPException(404, "Unknown login token.")
    now = datetime.now(timezone.utc)
    exp = doc.get("expires_at")
    if exp and exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    status = doc.get("status", "pending")
    if status == "pending" and exp and exp < now:
        await db.telegram_login_tokens.update_one(
            {"_id": doc["_id"]}, {"$set": {"status": "expired"}}
        )
        status = "expired"
    if status == "authorized" and doc.get("auth_payload"):
        payload = dict(doc["auth_payload"])
        payload["status"] = "authorized"
        return payload
    return {"status": status}
