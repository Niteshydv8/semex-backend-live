"""SEMEX backend configuration."""
from __future__ import annotations

import os

from dotenv import load_dotenv

load_dotenv()


def _env(key: str, default: str | None = None) -> str:
    v = os.environ.get(key, default)
    if v is None:
        raise RuntimeError(f"Missing required env var: {key}")
    return v


class Settings:
    MONGO_URL: str = _env("MONGO_URL")
    DB_NAME: str = _env("DB_NAME")
    CORS_ORIGINS: str = _env("CORS_ORIGINS", "*")

    TELEGRAM_BOT_TOKEN: str = _env("TELEGRAM_BOT_TOKEN")
    TELEGRAM_BOT_USERNAME: str = _env("TELEGRAM_BOT_USERNAME")

    ADMIN_TELEGRAM_ID: int = int(_env("ADMIN_TELEGRAM_ID"))
    ADMIN_LOG_CHANNEL_ID: int = int(_env("ADMIN_LOG_CHANNEL_ID"))
    PUBLIC_SHOWCASE_CHANNEL_ID: str = _env("PUBLIC_SHOWCASE_CHANNEL_ID", "")

    JWT_SECRET: str = _env("JWT_SECRET")
    HMAC_SECRET: str = _env("HMAC_SECRET")
    ACCESS_TOKEN_TTL_MINUTES: int = int(_env("ACCESS_TOKEN_TTL_MINUTES", "15"))
    REFRESH_TOKEN_TTL_DAYS: int = int(_env("REFRESH_TOKEN_TTL_DAYS", "30"))
    OTP_TTL_MINUTES: int = int(_env("OTP_TTL_MINUTES", "5"))

    BIN_LOOKUP_URL: str = _env("BIN_LOOKUP_URL", "https://bin.hex-unit.com")

    MAX_DEVICES_PER_USER: int = int(_env("MAX_DEVICES_PER_USER", "4"))
    OTP_RATE_LIMIT_PER_HOUR: int = int(_env("OTP_RATE_LIMIT_PER_HOUR", "5"))
    LOGIN_RATE_LIMIT_PER_HOUR: int = int(_env("LOGIN_RATE_LIMIT_PER_HOUR", "10"))

    # Base URL of the deployed API (used in Telegram messages / upgrade links)
    BASE_URL: str = _env("BASE_URL", "")

    # ─── Premium billing (Bot /buy command) ─────────────────────────────────
    # Prices are display-only — owner confirms crypto payment manually and
    # runs /extend via the admin panel. All fields have safe defaults.
    OWNER_HANDLE: str = _env("OWNER_HANDLE", "")   # @yourname (no @ needed)
    PLAN_PRICE_MONTHLY: str = _env("PLAN_PRICE_MONTHLY", "$15")
    PLAN_PRICE_YEARLY: str = _env("PLAN_PRICE_YEARLY", "$120")
    PLAN_PRICE_LIFETIME: str = _env("PLAN_PRICE_LIFETIME", "$250")
    PAYMENT_USDT_TRC20: str = _env("PAYMENT_USDT_TRC20", "")
    PAYMENT_USDT_ERC20: str = _env("PAYMENT_USDT_ERC20", "")
    PAYMENT_BTC_ADDRESS: str = _env("PAYMENT_BTC_ADDRESS", "")
    PAYMENT_LTC_ADDRESS: str = _env("PAYMENT_LTC_ADDRESS", "")


settings = Settings()
