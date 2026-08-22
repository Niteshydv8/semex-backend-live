"""Pending USDT payment records.

Created when a user initiates a Binance Pay or on-chain transfer.
Consumed (fulfilled) by gmail_watcher (Binance Pay) or txid_verifier (TRC20/BEP20).

Each pending payment has a unique SEMEX-XXXXXXXX code that the user includes in
the Binance Pay memo so we can match the email back to the right subscriber.
"""
from __future__ import annotations

import secrets
import string
from datetime import datetime, timedelta, timezone

from db import get_db

_CODE_CHARS = string.ascii_lowercase + string.digits
_CODE_LEN = 8
_TTL_HOURS = 24


def _generate_code() -> str:
    return "SEMEX-" + "".join(secrets.choice(_CODE_CHARS) for _ in range(_CODE_LEN))


async def create_pending(
    *,
    telegram_id: int,
    username: str | None,
    product: str,
    payment_method: str,   # "binance_pay" | "trc20" | "bep20"
    amount_usdt: str,
) -> dict:
    """Create and persist a new pending payment document, returning it."""
    db = get_db()
    code = _generate_code()
    now = datetime.now(timezone.utc)
    doc = {
        "code": code,
        "telegram_id": telegram_id,
        "username": username or "",
        "product": product,
        "payment_method": payment_method,
        "amount_usdt": amount_usdt,
        "created_at": now,
        "expires_at": now + timedelta(hours=_TTL_HOURS),
        "fulfilled": False,
        "txid": None,
    }
    await db.pending_payments.insert_one(doc)
    return doc


async def find_by_code(code: str) -> dict | None:
    """Look up an unfulfilled, unexpired payment by its SEMEX-XXXXXXXX code."""
    db = get_db()
    now = datetime.now(timezone.utc)
    return await db.pending_payments.find_one({
        "code": {"$regex": f"^{code}$", "$options": "i"},
        "fulfilled": False,
        "expires_at": {"$gt": now},
    })


async def find_latest_pending_onchain(telegram_id: int) -> dict | None:
    """Most recent unfulfilled on-chain pending payment for a user (any chain)."""
    db = get_db()
    now = datetime.now(timezone.utc)
    return await db.pending_payments.find_one(
        {
            "telegram_id": telegram_id,
            "payment_method": {"$in": ["trc20", "bep20"]},
            "fulfilled": False,
            "expires_at": {"$gt": now},
        },
        sort=[("created_at", -1)],
    )


async def mark_fulfilled(code: str, txid: str | None = None) -> None:
    db = get_db()
    await db.pending_payments.update_one(
        {"code": {"$regex": f"^{code}$", "$options": "i"}},
        {"$set": {
            "fulfilled": True,
            "txid": txid,
            "fulfilled_at": datetime.now(timezone.utc),
        }},
    )


async def cancel_pending_onchain(telegram_id: int, product: str) -> None:
    """Cancel any existing unfulfilled on-chain pending for this user+product
    so they can start a fresh one without confusion."""
    db = get_db()
    await db.pending_payments.update_many(
        {
            "telegram_id": telegram_id,
            "product": product,
            "payment_method": {"$in": ["trc20", "bep20"]},
            "fulfilled": False,
        },
        {"$set": {"fulfilled": True, "txid": "cancelled"}},
    )
