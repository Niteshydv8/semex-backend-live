"""Shared redeem-code logic.

Both the HTTP API (routes/auth.py `/api/auth/redeem`, routes/admin.py
`/api/admin/codes/generate`) and the Telegram bot (routes/telegram_bot.py
`/redeem`, `/gencode`) go through these helpers, so the two entry points can
never drift on how a code is minted, how it is atomically claimed, or how a
user's plan/expiry is granted.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from models import RedeemCode
from security import generate_redeem_code, hash_redeem_code, preview_redeem_code

log = logging.getLogger("semex.redeem")

# Canonical days -> plan-tag mapping. This is the single source of truth; the
# HTTP routes and the bot all resolve tags through plan_tag_for_days().
_PLAN_TAG_BY_DAYS = {
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


def plan_tag_for_days(days: int) -> str:
    """Map a duration in days to a plan tag. Negative == lifetime (VIP)."""
    if days < 0:
        return "VIP"
    if days in _PLAN_TAG_BY_DAYS:
        return _PLAN_TAG_BY_DAYS[days]
    if days >= 365:
        return "YEARLY"
    if days >= 30:
        return "MONTHLY"
    if days >= 7:
        return "WEEKLY"
    return "TRIAL"


class RedeemError(Exception):
    """Raised when a code can't be minted or redeemed.

    `status` mirrors the HTTP status the API layer should surface (400 for a
    bad/used code, 500 for an entitlement-write failure). `retryable` is True
    when the code was NOT consumed, so the user can safely try again.
    """

    def __init__(self, message: str, *, status: int = 400, retryable: bool = False):
        super().__init__(message)
        self.message = message
        self.status = status
        self.retryable = retryable


def _user_field(user: Any, name: str):
    if isinstance(user, dict):
        return user.get(name)
    return getattr(user, name, None)


async def generate_codes(
    db,
    *,
    days: int,
    quantity: int = 1,
    prefix: str = "SEMEX",
    plan_tag: Optional[str] = None,
    note: Optional[str] = None,
    created_by: int,
) -> tuple[list[str], str]:
    """Mint `quantity` redeem codes and persist them. Returns (plaintext_codes, plan_tag).

    The plaintext codes are returned ONCE here — only their SHA-256 hash is
    stored — so the caller must deliver them to the owner immediately.
    """
    if quantity < 1 or quantity > 500:
        raise RedeemError("Quantity must be 1-500.")
    tag = plan_tag or plan_tag_for_days(days)
    generated: list[str] = []
    for _ in range(quantity):
        code = generate_redeem_code(prefix)
        doc = RedeemCode(
            code_hash=hash_redeem_code(code),
            code_preview=preview_redeem_code(code),
            duration_days=days,
            plan_tag=tag,
            created_by=created_by,
            note=note,
        )
        await db.redeem_codes.insert_one(doc.to_mongo())
        generated.append(code)
    return generated, tag


async def redeem_code_for_user(db, user: Any, raw_code: str) -> dict:
    """Atomically claim `raw_code` and grant its plan/expiry to `user`.

    `user` may be a pydantic User or a plain Mongo dict (needs telegram_id and
    plan_expires_at). Returns
    {"planTag", "durationDays", "newExpiry", "codePreview"}.
    Raises RedeemError on an invalid/used code or a failed entitlement write
    (in which case the claim is rolled back so the code is not burned).
    """
    telegram_id = _user_field(user, "telegram_id")
    existing_expiry = _user_field(user, "plan_expires_at")

    code_h = hash_redeem_code((raw_code or "").strip().upper())
    doc = await db.redeem_codes.find_one({"code_hash": code_h})
    if not doc:
        raise RedeemError("Invalid code.", status=400, retryable=True)
    if doc.get("used"):
        raise RedeemError("Code already redeemed.", status=400, retryable=False)

    now = datetime.now(timezone.utc)
    duration_days = int(doc.get("duration_days", 0))
    plan_tag = doc.get("plan_tag") or plan_tag_for_days(duration_days)

    # Stack onto an existing, still-valid expiry.
    if existing_expiry and getattr(existing_expiry, "tzinfo", None) is None:
        existing_expiry = existing_expiry.replace(tzinfo=timezone.utc)
    base = existing_expiry if (existing_expiry and existing_expiry > now) else now

    if duration_days < 0:
        new_expiry = None  # lifetime
        plan_tag = "VIP"
    else:
        new_expiry = base + timedelta(days=duration_days)

    # Atomically claim the code BEFORE granting entitlement. Only the request
    # that flips used->True wins; a concurrent duplicate gets None and is
    # rejected, so a single code can never extend two accounts (or one twice).
    claimed = await db.redeem_codes.find_one_and_update(
        {"_id": doc["_id"], "used": {"$ne": True}},
        {"$set": {"used": True, "used_by": telegram_id, "used_at": now}},
    )
    if not claimed:
        raise RedeemError("Code already redeemed.", status=400, retryable=False)
    try:
        await db.users.update_one(
            {"telegram_id": telegram_id},
            {"$set": {
                "plan": plan_tag,
                "plan_expires_at": new_expiry,
                "expired_notified": False,
                "expiry_alerts_sent": {},
                "requires_redeem": False,
            }},
        )
    except Exception:
        # Never burn a valid code — if the entitlement write fails (Mongo
        # blip/timeout), roll the claim back so the user can retry.
        try:
            await db.redeem_codes.update_one(
                {"_id": doc["_id"]},
                {"$set": {"used": False}, "$unset": {"used_by": "", "used_at": ""}},
            )
        except Exception:
            log.error("redeem rollback ALSO failed for code %s — manual fix needed", doc.get("code_preview"))
        raise RedeemError(
            "Redemption failed — please try again. Your code was NOT used.",
            status=500, retryable=True,
        )

    return {
        "planTag": plan_tag,
        "durationDays": duration_days,
        "newExpiry": new_expiry,
        "codePreview": doc.get("code_preview", "SEMEX-****"),
    }
