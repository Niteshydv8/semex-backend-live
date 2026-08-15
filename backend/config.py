"""SEMEX backend configuration."""
from __future__ import annotations

import os
from pathlib import Path

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

    # Filesystem root containing the repo checkout (holds semex/ extension
    # source, build outputs, release zips). Railway used /app; Render checks
    # out elsewhere — compute from this file's location so both work.
    # Override with APP_BASE_DIR if a host needs something different.
    APP_BASE_DIR: str = _env("APP_BASE_DIR", str(Path(__file__).resolve().parent.parent))

    # ─── Premium billing (Bot /buy command) ─────────────────────────────────
    # Prices are display-only — owner confirms crypto payment manually and
    # runs /extend via the admin panel. All fields have safe defaults.
    OWNER_HANDLE: str = _env("OWNER_HANDLE", "")   # @yourname (no @ needed)
    PLAN_PRICE_MONTHLY: str = _env("PLAN_PRICE_MONTHLY", "$180")
    PLAN_PRICE_YEARLY: str = _env("PLAN_PRICE_YEARLY", "")   # hidden when empty
    PLAN_PRICE_LIFETIME: str = _env("PLAN_PRICE_LIFETIME", "$900")
    # Owner's USDT wallets — shown in /buy. Defaults are the live addresses.
    PAYMENT_USDT_BEP20: str = _env("PAYMENT_USDT_BEP20", "0xb1ab479abe81d6be059d5bb9d55a6e8d99b64bfd")
    PAYMENT_USDT_TRC20: str = _env("PAYMENT_USDT_TRC20", "TCn8eNownsyUzMeHNMeUpzXJFDruCWYr5w")
    PAYMENT_USDT_TON: str = _env("PAYMENT_USDT_TON", "UQAmwQDBLUHsSZI3SiKTDwSnvte-Y8MkwoDvzHzOGa-3xk68")
    PAYMENT_USDT_ERC20: str = _env("PAYMENT_USDT_ERC20", "")
    PAYMENT_BTC_ADDRESS: str = _env("PAYMENT_BTC_ADDRESS", "")
    PAYMENT_LTC_ADDRESS: str = _env("PAYMENT_LTC_ADDRESS", "")

    # Private group (CC drop + methods) pricing — manual subscription.
    GROUP_PRICE_WEEKLY: str = _env("GROUP_PRICE_WEEKLY", "$29")
    GROUP_PRICE_MONTHLY: str = _env("GROUP_PRICE_MONTHLY", "$59")

    # Invite link to the subscription-only premium private group. NEVER shown
    # publicly — the owner sends it to a verified buyer via /sendlink after
    # payment. The "Premium Group" bot button always shows the offer + wallets.
    PREMIUM_GROUP_LINK: str = _env("PREMIUM_GROUP_LINK", "")

    # Optional Telegram webhook secret — set this value when registering the webhook:
    #   POST https://api.telegram.org/bot<TOKEN>/setWebhook?url=...&secret_token=<THIS>
    # Telegram will then send X-Telegram-Bot-Api-Secret-Token on every update.
    # Leave empty to skip the check (less secure but backward-compatible).
    TELEGRAM_WEBHOOK_SECRET: str = _env("TELEGRAM_WEBHOOK_SECRET", "")


settings = Settings()
