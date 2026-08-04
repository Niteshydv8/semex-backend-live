"""BIN lookup — proxied through bin.hex-unit.com, cached in-memory AND in Mongo.

Returns a normalised dict:
    {
      "bin": "44304400",
      "brand": "visa",           # lowercase
      "cardType": "debit",       # credit | debit | prepaid | charge
      "level": "classic",        # classic | gold | platinum | business | ...
      "bank": "PNC BANK...",
      "country": "UNITED STATES",
      "countryCode": "US",       # ISO alpha-2
      "flag": "🇺🇸",
    }

Missing fields are omitted (None), never raised.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx

from config import settings
from db import get_db

log = logging.getLogger("semex.bin")

_mem_cache: dict[str, dict] = {}
CACHE_TTL = timedelta(days=30)


def _local_brand(bin_digits: str) -> Optional[str]:
    """Fast local brand detection from digit prefix — no network call."""
    if not bin_digits:
        return None
    first2 = bin_digits[:2]
    first4 = bin_digits[:4]
    if bin_digits.startswith("4"):
        return "visa"
    if first2 in ("34", "37"):
        return "amex"
    if first2 in ("51", "52", "53", "54", "55") or (
        first4.isdigit() and 2221 <= int(first4) <= 2720
    ):
        return "mastercard"
    if bin_digits.startswith(("6011", "644", "645", "646", "647", "648", "649", "65")):
        return "discover"
    if first4.isdigit() and 3528 <= int(first4) <= 3589:
        return "jcb"
    if first2 in ("36", "30", "38", "39"):
        return "diners"
    if bin_digits.startswith("62"):
        return "unionpay"
    if first2 in ("50", "56", "57", "58", "63", "67"):
        return "maestro"
    return None


def _normalise(raw: dict, bin_code: str) -> dict:
    """Convert bin.hex-unit.com response to our normalised shape.

    Includes BOTH new keys (brand/cardType/level/bank/country/countryCode/flag)
    and the legacy keys (type/country_name/country_flag) that routes/data.py
    already uses, so nothing downstream breaks.
    """
    if not raw:
        return {"bin": bin_code, "brand": _local_brand(bin_code)}
    brand = (raw.get("brand") or "").lower() or _local_brand(bin_code)
    card_type = (raw.get("type") or "").lower() or None
    level = (raw.get("level") or "").lower() or None
    bank = raw.get("bank") or None
    country_name = raw.get("country_name") or None
    country_code = raw.get("country") or None
    flag = raw.get("country_flag") or None
    return {
        "bin": bin_code,
        # normalised (new) keys
        "brand": brand,
        "cardType": card_type,
        "level": level,
        "bank": bank,
        "country": country_name,
        "countryCode": country_code,
        "flag": flag,
        # legacy keys used by routes/data.py
        "type": card_type,
        "country_name": country_name,
        "country_flag": flag,
    }


async def lookup_bin(bin_code: str) -> Optional[dict]:
    """Returns normalised metadata for a BIN. Always safe."""
    bin_code = "".join(c for c in (bin_code or "") if c.isdigit())[:8]
    if len(bin_code) < 6:
        return {"bin": bin_code, "brand": _local_brand(bin_code)} if bin_code else None

    # In-memory cache
    if bin_code in _mem_cache:
        return _mem_cache[bin_code]

    # Mongo cache
    try:
        db = get_db()
        cached = await db.bin_cache.find_one({"bin": bin_code})
        if cached and cached.get("fetched_at"):
            ft = cached["fetched_at"]
            if ft.tzinfo is None:
                ft = ft.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) - ft < CACHE_TTL:
                brand = cached.get("brand") or _local_brand(bin_code)
                card_type = cached.get("card_type")
                country_name = cached.get("country")
                flag = cached.get("flag")
                meta = {
                    "bin": bin_code,
                    "brand": brand,
                    "cardType": card_type,
                    "level": cached.get("level"),
                    "bank": cached.get("bank"),
                    "country": country_name,
                    "countryCode": cached.get("country_code"),
                    "flag": flag,
                    # legacy keys for routes/data.py
                    "type": card_type,
                    "country_name": country_name,
                    "country_flag": flag,
                }
                _mem_cache[bin_code] = meta
                return meta
    except Exception as e:
        log.warning("bin_cache read failed: %s", e)

    # Live fetch
    url = f"{settings.BIN_LOOKUP_URL}/{bin_code}"
    meta: dict = {"bin": bin_code, "brand": _local_brand(bin_code)}
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            r = await client.get(url)
            if r.status_code == 200:
                meta = _normalise(r.json() or {}, bin_code)
    except Exception as e:
        log.warning("BIN lookup failed for %s: %s", bin_code, e)

    _mem_cache[bin_code] = meta

    # Persist to Mongo cache (best-effort)
    try:
        db = get_db()
        await db.bin_cache.update_one(
            {"bin": bin_code},
            {
                "$set": {
                    "bin": bin_code,
                    "brand": meta.get("brand"),
                    "card_type": meta.get("cardType"),
                    "level": meta.get("level"),
                    "bank": meta.get("bank"),
                    "country": meta.get("country"),
                    "country_code": meta.get("countryCode"),
                    "flag": meta.get("flag"),
                    "fetched_at": datetime.now(timezone.utc),
                }
            },
            upsert=True,
        )
    except Exception as e:
        log.warning("bin_cache write failed: %s", e)

    return meta
