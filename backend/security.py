"""Security helpers: JWT, HMAC, OTP hashing, redeem code generation."""
from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from config import settings


# ---------- OTP ----------

def generate_otp() -> str:
    """6-digit numeric OTP."""
    return f"{secrets.randbelow(1000000):06d}"


def hash_otp(otp: str) -> str:
    return bcrypt.hashpw(otp.encode(), bcrypt.gensalt()).decode()


def verify_otp(otp: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(otp.encode(), hashed.encode())
    except Exception:
        return False


# ---------- Redeem codes ----------

_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no ambiguous chars


def generate_redeem_code(prefix: str = "SEMEX") -> str:
    """Format: SEMEX-XXXX-XXXX-XXXX."""
    parts = []
    for _ in range(3):
        parts.append("".join(secrets.choice(_CODE_ALPHABET) for _ in range(4)))
    return f"{prefix}-{parts[0]}-{parts[1]}-{parts[2]}"


def hash_redeem_code(code: str) -> str:
    """SHA-256 hash — deterministic so we can index/lookup."""
    return hashlib.sha256(code.encode()).hexdigest()


def preview_redeem_code(code: str) -> str:
    """First 4 + last 4 chars, rest masked."""
    if len(code) <= 8:
        return code
    return f"{code[:6]}...{code[-4:]}"


# ---------- JWT ----------

def create_access_token(session_id: str, telegram_id: int, fingerprint: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sid": session_id,
        "tid": telegram_id,
        "fp": fingerprint,
        "iat": now,
        "exp": now + timedelta(minutes=settings.ACCESS_TOKEN_TTL_MINUTES),
        "typ": "access",
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def create_refresh_token(session_id: str, telegram_id: int, fingerprint: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sid": session_id,
        "tid": telegram_id,
        "fp": fingerprint,
        "iat": now,
        "exp": now + timedelta(days=settings.REFRESH_TOKEN_TTL_DAYS),
        "typ": "refresh",
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None


# ---------- HMAC (anti-tamper request signing) ----------

def compute_hmac(body: bytes, session_id: str) -> str:
    """HMAC-SHA256 of body||session_id."""
    key = f"{settings.HMAC_SECRET}:{session_id}".encode()
    return hmac.new(key, body, hashlib.sha256).hexdigest()


def verify_hmac(body: bytes, session_id: str, provided: str) -> bool:
    expected = compute_hmac(body, session_id)
    return hmac.compare_digest(expected, provided or "")
