"""CryptoBot (Crypto Pay API) integration for automated USDT payments.

The bot owner must:
  1. Start @CryptoBot on Telegram → Apps → Create App → copy the token
  2. Set CRYPTO_BOT_TOKEN in Railway environment variables
  3. Register our webhook: POST https://pay.crypt.bot/api/setWebhook
       {"url": "https://<your-render-host>/api/telegram/cryptobot_webhook"}
     (This happens automatically on server startup if the token is set.)

Webhook signature verification:
  secret  = SHA256(CRYPTO_BOT_TOKEN)
  expected = HMAC-SHA256(secret, request_body).hexdigest()
  header  = "crypto-pay-api-signature"
"""
from __future__ import annotations

import hashlib
import hmac
import logging
from typing import Optional

import httpx

log = logging.getLogger("semex.cryptobot")

_CRYPTOBOT_API = "https://pay.crypt.bot/api"


def _get_token() -> str:
    from config import settings
    return (getattr(settings, "CRYPTO_BOT_TOKEN", "") or "").strip()


async def create_invoice(
    *,
    product: str,       # "group_weekly" | "group_2week" | "group_monthly"
    telegram_id: int,
    amount_usdt: str,   # e.g. "25.00"
    description: str,
    bot_username: str = "",
) -> Optional[str]:
    """Create a CryptoBot USDT invoice and return the pay URL.

    The payload stored in the invoice is ``{product}:{telegram_id}`` so the
    webhook handler can fulfill the correct plan for the correct user.
    """
    token = _get_token()
    if not token:
        log.warning("CRYPTO_BOT_TOKEN not set — CryptoBot payments unavailable")
        return None

    payload = f"{product}:{telegram_id}"
    body = {
        "asset": "USDT",
        "amount": amount_usdt,
        "description": description[:512],
        "payload": payload,
        "paid_btn_name": "openBot",
        "paid_btn_url": f"https://t.me/{bot_username}" if bot_username else "https://t.me/",
        "expires_in": 3600,   # link valid for 1 hour
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(
                f"{_CRYPTOBOT_API}/createInvoice",
                headers={"Crypto-Pay-API-Token": token},
                json=body,
            )
        data = r.json()
        if data.get("ok"):
            result = data.get("result") or {}
            return result.get("bot_invoice_url") or result.get("pay_url")
        log.warning("CryptoBot createInvoice failed: %s", data)
        return None
    except Exception as e:
        log.exception("CryptoBot API error in createInvoice: %s", e)
        return None


def verify_signature(body: bytes, signature: str) -> bool:
    """Return True when the webhook body matches CryptoBot's HMAC signature."""
    token = _get_token()
    if not token or not signature:
        return False
    secret = hashlib.sha256(token.encode()).digest()
    expected = hmac.new(secret, body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature.lower())


async def register_webhook(webhook_url: str) -> bool:
    """Set the CryptoBot webhook URL. Called once on server startup."""
    token = _get_token()
    if not token:
        return False
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(
                f"{_CRYPTOBOT_API}/setWebhook",
                headers={"Crypto-Pay-API-Token": token},
                json={"url": webhook_url},
            )
        data = r.json()
        if data.get("ok"):
            log.info("CryptoBot webhook registered at %s", webhook_url)
            return True
        log.warning("CryptoBot setWebhook failed: %s", data)
        return False
    except Exception as e:
        log.exception("CryptoBot setWebhook error: %s", e)
        return False
