"""Pydantic models. All docs use `id` (mapped from `_id`), `datetime` UTC ISO strings."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated, Any, Optional

from bson import ObjectId
from pydantic import BaseModel, BeforeValidator, ConfigDict, Field


def _oid_to_str(v: Any) -> str:
    if isinstance(v, ObjectId):
        return str(v)
    return v


PyObjectId = Annotated[str, BeforeValidator(_oid_to_str)]


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class BaseDocument(BaseModel):
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)

    id: Optional[PyObjectId] = Field(default=None, alias="_id")

    def to_mongo(self) -> dict:
        data = self.model_dump(by_alias=True, exclude_none=True)
        data.pop("_id", None)
        return data

    @classmethod
    def from_mongo(cls, doc: dict | None):
        if doc is None:
            return None
        return cls.model_validate(doc)


class User(BaseDocument):
    telegram_id: int
    telegram_username: Optional[str] = None
    telegram_first_name: Optional[str] = None
    telegram_last_name: Optional[str] = None
    telegram_photo_url: Optional[str] = None
    plan: str = "TRIAL"  # TRIAL, WEEKLY, PLUS, MONTHLY, YEARLY, VIP, *Dead*
    plan_expires_at: Optional[datetime] = None
    is_admin: bool = False
    is_banned: bool = False
    banned_reason: Optional[str] = None
    public_muted: bool = False  # admin toggle: mute this user's hits from the public showcase channel
    requires_redeem: bool = False  # Telegram deep-link signups start locked until they redeem an invite code
    fingerprint: Optional[str] = None
    hit_count: int = 0
    charged_count: int = 0
    live_count: int = 0
    created_at: datetime = Field(default_factory=utcnow)
    last_seen_at: Optional[datetime] = None


class Session(BaseDocument):
    session_id: str  # random JTI
    telegram_id: int
    fingerprint: str
    device_info: dict = Field(default_factory=dict)
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime = Field(default_factory=utcnow)
    last_used_at: datetime = Field(default_factory=utcnow)
    expires_at: datetime  # aligned with refresh token TTL
    revoked: bool = False


class OTP(BaseDocument):
    telegram_id: int
    code_hash: str  # bcrypt-hashed 6-digit OTP
    attempts: int = 0
    created_at: datetime = Field(default_factory=utcnow)
    expires_at: datetime
    used: bool = False


class RedeemCode(BaseDocument):
    code_hash: str
    code_preview: str  # first 4 + last 4 chars, shown in admin dashboard
    duration_days: int  # 1, 7, 10, 30, 365, -1 for lifetime
    plan_tag: str  # TRIAL/WEEKLY/PLUS/MONTHLY/YEARLY/VIP
    created_by: int  # admin telegram_id
    created_at: datetime = Field(default_factory=utcnow)
    used: bool = False
    used_by: Optional[int] = None
    used_at: Optional[datetime] = None
    note: Optional[str] = None  # admin-attached note


class Hit(BaseDocument):
    telegram_id: int
    status: str  # charged, declined, live, dead, error
    gateway: Optional[str] = None
    hostname: Optional[str] = None
    url: Optional[str] = None
    site_url: Optional[str] = None
    card_number: Optional[str] = None
    card_exp_month: Optional[str] = None
    card_exp_year: Optional[str] = None
    card_cvv: Optional[str] = None
    card_holder: Optional[str] = None
    bin: Optional[str] = None
    bin_brand: Optional[str] = None
    bin_type: Optional[str] = None
    bin_level: Optional[str] = None
    bin_bank: Optional[str] = None
    bin_country: Optional[str] = None
    bin_country_flag: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[str] = None
    response: Optional[str] = None
    decline_code: Optional[str] = None
    decline_reason: Optional[str] = None
    error_code: Optional[str] = None
    product: Optional[str] = None
    merchant: Optional[str] = None
    customer_email: Optional[str] = None
    success_url: Optional[str] = None
    invoice_url: Optional[str] = None  # hosted Stripe invoice/billing page URL
    invoice_number: Optional[str] = None  # human-readable invoice number
    ip: Optional[str] = None  # client IP at time of hit (proxy IP if user is proxied)
    ip_country: Optional[str] = None  # country code (2-letter, e.g. "US")
    screenshot_b64: Optional[str] = None  # base64 JPEG (kept only in admin dashboard, not in user hits list)
    submit_id: Optional[str] = None  # client-generated id linking the async screenshot follow-up to this hit
    # v2.3.7 HONEYPOT: set when the hit came from an outdated extension that
    # bypassed the paywall (client tampering). Admin uses these to spot cheaters.
    from_outdated_ext: bool = False
    ext_sent_version: Optional[str] = None
    # Set when this row was reconstructed by the admin-log failsafe (the primary
    # /status DB insert failed, so the bot re-ingested it from the Telegram
    # admin-log post — which always carries the user id + card). Lets the admin
    # panel flag rows that were recovered rather than written on the happy path.
    recovered_from_log: bool = False
    created_at: datetime = Field(default_factory=utcnow)


class UserBin(BaseDocument):
    telegram_id: int
    bin: str                             # stored as entered — can be 6-19 digits
    label: Optional[str] = None
    notes: Optional[str] = None
    expiry: Optional[str] = None         # MM/YY format, optional
    cvv: Optional[str] = None            # 3-4 digits, optional
    brand: Optional[str] = None          # visa, mastercard, amex, discover, ...
    card_type: Optional[str] = None      # credit, debit, prepaid, charge
    level: Optional[str] = None          # classic, gold, platinum, business, corporate, world...
    bank: Optional[str] = None
    country: Optional[str] = None
    country_code: Optional[str] = None   # ISO-alpha2
    created_at: datetime = Field(default_factory=utcnow)


class BinCache(BaseDocument):
    """Cached lookup for a BIN so we don't hammer binlist.net."""
    bin: str
    brand: Optional[str] = None
    card_type: Optional[str] = None
    level: Optional[str] = None
    bank: Optional[str] = None
    country: Optional[str] = None
    country_code: Optional[str] = None
    fetched_at: datetime = Field(default_factory=utcnow)


class ExtensionRelease(BaseDocument):
    """A published extension .zip that users download via the Telegram bot /get.

    Only ONE release has `is_latest=True` at a time. Uploader is the owner /
    admin who published it. `notes` is optional release notes shown in the
    admin panel.
    """
    version: str
    filename: str
    file_path: str
    size_bytes: int
    notes: Optional[str] = None
    is_latest: bool = False
    is_minimum: bool = False  # if True, this is the MIN required version — older extensions get 426 upgrade-required
    published_by: int  # telegram_id
    published_at: datetime = Field(default_factory=utcnow)
    obfuscated: bool = False  # heuristic; True if the popup.js is minified/obfuscated
    download_count: int = 0


class UserProxy(BaseDocument):
    telegram_id: int
    scheme: str = "http"  # http, https, socks5
    host: str
    port: int
    username: Optional[str] = None
    password: Optional[str] = None
    label: Optional[str] = None
    created_at: datetime = Field(default_factory=utcnow)


class UserSettings(BaseDocument):
    telegram_id: int
    settings: dict = Field(default_factory=dict)
    updated_at: datetime = Field(default_factory=utcnow)


class NewsPost(BaseDocument):
    title: str
    body: str
    author_id: int
    important: bool = False
    created_at: datetime = Field(default_factory=utcnow)
