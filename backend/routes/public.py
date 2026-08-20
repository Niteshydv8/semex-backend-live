"""Public endpoints — bot info, site config, news, BIN lookup."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request

from config import settings
from db import get_db
from services.bin_lookup import lookup_bin

router = APIRouter(tags=["public"])


@router.get("/api/public/bot")
async def get_bot_info():
    return {
        "username": settings.TELEGRAM_BOT_USERNAME,
        "link": f"https://t.me/{settings.TELEGRAM_BOT_USERNAME}",
    }


def _parse_semver(v: str) -> tuple:
    """Parse an extension version like '2.3.0' into a comparable tuple.
    Bad/malformed versions sort as (0,) so they're always considered outdated."""
    if not v:
        return (0, 0, 0, 0)
    try:
        parts = [int("".join(ch for ch in p if ch.isdigit()) or "0") for p in str(v).split(".")[:4]]
        while len(parts) < 4:
            parts.append(0)
        return tuple(parts[:4])
    except Exception:
        return (0, 0, 0, 0)


@router.get("/api/public/version")
async def public_version_info():
    """Extension bootstrap — returns the currently-latest published version, the
    MINIMUM required version (older than this is force-upgraded), and where to
    download the new build. Called by the extension on popup open.
    Falls back to hardcoded defaults if no release has been published yet.

    Corrupt/invalid version rows in the DB (e.g. bare "3") are skipped so a
    typo can't paywall every real build against itself.
    """
    import re as _re
    _semver_rx = _re.compile(r"^\d+\.\d+(?:\.\d+)?(?:\.\d+)?$")
    db = get_db()
    bot_handle = settings.TELEGRAM_BOT_USERNAME
    # SAFE floor when the DB has no publishable rows. Kept in sync with
    # _FALLBACK_MIN_VERSION in data.py. All extensions below this are force-upgraded.
    default_min = "2.5.0"

    async def _find_valid(filt: dict) -> str | None:
        cursor = db.extension_releases.find(filt).sort("published_at", -1).limit(5)
        async for doc in cursor:
            v = str(doc.get("version") or "").strip()
            if _semver_rx.match(v):
                return v
        return None

    try:
        latest_version = await _find_valid({"is_latest": True})
        min_version = await _find_valid({"is_minimum": True})
    except Exception:
        # DB hiccup must not 500 the bootstrap — outdated clients still need
        # to learn where to upgrade. Fall back to the safe floor.
        latest_version = None
        min_version = None

    # Sanity: if only "latest" exists, treat latest as also the minimum required.
    if not min_version and latest_version:
        min_version = latest_version
    if not min_version:
        min_version = default_min
    if not latest_version:
        latest_version = min_version

    # Invariant: never advertise minVersion > latestVersion, which would tell a
    # client to upgrade to a build the gate then rejects. If an admin published
    # contradictory metadata, raise latest up to the minimum.
    if _parse_semver(min_version) > _parse_semver(latest_version):
        latest_version = min_version

    return {
        "latestVersion": latest_version,
        "minVersion": min_version,
        "downloadUrl": f"{str(settings.BASE_URL or '').rstrip('/')}/api/telegram/download/extension" if getattr(settings, "BASE_URL", None) else "/api/telegram/download/extension",
        "botCommand": "/get",
        "botDownloadCommand": "/get",  # legacy alias
        "botLink": f"https://t.me/{bot_handle}",
        "botUsername": bot_handle,
        "message": f"Please update to the latest version ({latest_version}) from @{bot_handle} — run /get in the bot or click the download link.",
    }




@router.get("/api/site-config")
async def site_config():
    """Static config the extension reads on startup: default selectors, redirect params, etc."""
    return {
        "brand": "SEMEX",
        "removeParams": [
            "payment_user_agent",
            "payment_method_data[payment_user_agent]",
            "source_data[payment_user_agent]",
            "pasted_fields",
            "payment_method_data[pasted_fields]",
            "source_data[pasted_fields]",
            "card[pasted_fields]",
            "billing_details[pasted_fields]",
            "time_on_page",
            "payment_method_data[time_on_page]",
            "source_data[time_on_page]",
            "muid",
            "sid",
            "guid",
            "zip",
            "postal_code",
            "zip_code",
            "postal",
            "address_zip",
            "card[address_zip]",
            "card[postal_code]",
            "card[zip]",
            "billing_details[address][postal_code]",
            "billing_details[address][zip]",
            "billing_details[address][zip_code]",
            "payment_method_data[billing_details][address][postal_code]",
            "payment_method_data[billing_details][address][zip]",
            "owner[address][postal_code]",
        ],
        "selectors": {
            "cardNumber": 'input[name="cardNumber"], input[id="Field-numberInput"], input[id="cardNumber"], .CardNumberField, #checkout-frames-card-number',
            "expiry": 'input[name="expiry"], input[id="expiry"], .ExpiryField, #checkout-frames-expiry-date',
            "cvv": 'input[name="cvc"], input[id="cvc"], .CvcField',
            "zip": '[name="postalCode"], [id="postalCode"], .PostalCodeField',
            "firstName": '[name="firstName"], [id="firstName"], .FirstNameField',
            "lastName": '[name="lastName"], [id="lastName"], .LastNameField',
            "address": '[name="addressLine1"], [id="addressLine1"], .AddressField',
            "city": '[name="city"], [id="city"], .CityField',
            "state": '[name="state"], [id="state"], .StateField, select[name="state"]',
            "phone": '[name="phone"], [id="phone"], .PhoneField',
            "email": 'input[type="email"], input[name="email"], input[autocomplete="email"], input[name="aPayment[strEmail]"]',
        },
        "delays": {"input": 50, "submit": 1000},
    }


@router.get("/api/news")
async def news(limit: int = 20):
    db = get_db()
    cursor = db.news.find({}).sort("created_at", -1).limit(min(limit, 50))
    items = []
    async for doc in cursor:
        doc["id"] = str(doc.pop("_id"))
        if "created_at" in doc and hasattr(doc["created_at"], "isoformat"):
            doc["created_at"] = doc["created_at"].isoformat()
        items.append(doc)
    return {"items": items}


@router.get("/api/bin/{bin_code}")
async def bin_lookup(bin_code: str):
    data = await lookup_bin(bin_code)
    if not data:
        raise HTTPException(404, "BIN not found")
    return data


@router.get("/api/health")
async def health():
    return {"ok": True, "brand": "SEMEX"}


@router.get("/api/user-photo/{telegram_id}")
@router.get("/api/auth/photo/{telegram_id}")
async def user_photo(telegram_id: int):
    """Proxy a user's Telegram photo through backend so the bot token stays private."""
    from fastapi.responses import Response
    from services.telegram import get_user_photo_url
    import httpx
    photo_url = await get_user_photo_url(telegram_id)
    if not photo_url:
        raise HTTPException(404, "No photo")
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            r = await client.get(photo_url)
            if r.status_code != 200:
                raise HTTPException(404, "Photo fetch failed")
            return Response(
                content=r.content,
                media_type=r.headers.get("content-type", "image/jpeg"),
                headers={"Cache-Control": "public, max-age=3600"},
            )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(500, "Photo fetch error")
