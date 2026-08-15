"""Telegram Bot API service - send OTP, forward hits, admin logging."""
from __future__ import annotations

import asyncio
import logging
from typing import Optional

import httpx

from config import settings

log = logging.getLogger("semex.telegram")

_BASE = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}"


# Telegram throttles per-chat (~1 msg/s) and per-channel (~20 msg/min). When a
# burst of hits trips that limit the API replies 429 and the message is NOT
# delivered — previously we just logged and returned, so the hit stayed in the
# DB + dashboard but silently never reached Telegram. We now honor `retry_after`
# and also retry transient network/timeout blips with a short backoff. Retries
# are bounded so a request handler never hangs for long.
_MAX_SEND_ATTEMPTS = 3
_MAX_429_WAIT = 5.0  # cap per-retry sleep (seconds)


async def _post(method: str, data: dict, files: Optional[dict] = None) -> Optional[dict]:
    url = f"{_BASE}/{method}"
    for attempt in range(1, _MAX_SEND_ATTEMPTS + 1):
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                if files:
                    r = await client.post(url, data=data, files=files)
                else:
                    r = await client.post(url, json=data)
            try:
                resp = r.json()
            except Exception:
                resp = None

            # 429 Too Many Requests — honor Telegram's retry_after, then resend.
            # A 429 means the message was NOT delivered, so a retry cannot duplicate it.
            if r.status_code == 429 and attempt < _MAX_SEND_ATTEMPTS:
                try:
                    retry_after = float(((resp or {}).get("parameters") or {}).get("retry_after", 1))
                except Exception:
                    retry_after = 1.0
                wait = min(max(retry_after, 1.0), _MAX_429_WAIT)
                log.warning("Telegram %s 429 (retry_after=%s) — resending in %.1fs (attempt %d/%d)",
                            method, retry_after, wait, attempt, _MAX_SEND_ATTEMPTS)
                await asyncio.sleep(wait)
                continue

            if r.status_code != 200:
                log.warning("Telegram %s failed: %s %s", method, r.status_code, r.text[:400])
            # Always return the parsed JSON so callers can read ok/error_code/description.
            # Callers already gate on res.get("ok") so this is backward-compatible.
            return resp

        except httpx.TransportError as e:
            # Transient network/timeout error — brief backoff then retry so a single
            # blip doesn't silently drop a hit notification.
            if attempt < _MAX_SEND_ATTEMPTS:
                wait = 0.6 * attempt
                log.warning("Telegram %s network error (%s) — retrying in %.1fs (attempt %d/%d)",
                            method, e.__class__.__name__, wait, attempt, _MAX_SEND_ATTEMPTS)
                await asyncio.sleep(wait)
                continue
            log.exception("Telegram %s network error — gave up: %s", method, e)
            return None
        except Exception as e:
            log.exception("Telegram %s error: %s", method, e)
            return None
    return None


async def get_bot_info() -> Optional[dict]:
    """Returns { id, username, first_name, ...} for the bot."""
    r = await _post("getMe", {})
    return r.get("result") if r and r.get("ok") else None


async def get_chat(chat_id: int) -> Optional[dict]:
    """Fetch a user's profile via chat_id (works because they DM'd the bot first)."""
    r = await _post("getChat", {"chat_id": chat_id})
    return r.get("result") if r and r.get("ok") else None


async def get_user_photo_url(user_id: int) -> Optional[str]:
    r = await _post("getUserProfilePhotos", {"user_id": user_id, "limit": 1})
    if not r or not r.get("ok"):
        return None
    photos = r["result"].get("photos") or []
    if not photos:
        return None
    file_id = photos[0][-1]["file_id"]  # largest size
    f = await _post("getFile", {"file_id": file_id})
    if not f or not f.get("ok"):
        return None
    return f"https://api.telegram.org/file/bot{settings.TELEGRAM_BOT_TOKEN}/{f['result']['file_path']}"


def _strip_html(text: str) -> str:
    """Strip HTML tags and unescape entities — used as plaintext fallback."""
    import re as _re, html as _html
    stripped = _re.sub(r"<[^>]+>", "", text or "")
    return _html.unescape(stripped)


def _is_html_parse_error(res: Optional[dict]) -> bool:
    """Return True when Telegram rejected the message due to malformed HTML."""
    if not res:
        return False
    return (
        res.get("ok") is False
        and res.get("error_code") == 400
        and "parse" in (res.get("description") or "").lower()
    )


async def send_message(chat_id: int, text: str, parse_mode: str = "HTML", *, premium_emojis: bool = False, reply_markup: Optional[dict] = None) -> Optional[dict]:
    # Telegram hard-limits sendMessage text to 4096 chars; over-length 400-rejects
    # the whole message. Cap defensively so one long field never kills delivery.
    if isinstance(text, str) and len(text) > 4096:
        text = text[:4093] + "..."
    payload = {"chat_id": chat_id, "text": text, "parse_mode": parse_mode, "disable_web_page_preview": True}
    if reply_markup is not None:
        payload["reply_markup"] = reply_markup
    used_custom_emoji = False
    if premium_emojis:
        try:
            from services.custom_emojis import build_entities
            entities = build_entities(text)
            if entities:
                payload["entities"] = entities
                used_custom_emoji = True
        except Exception as e:
            log.warning("custom-emoji entity build failed: %s", e)
    res = await _post("sendMessage", payload)
    # Retry 1: custom-emoji entity failure — drop entities and resend HTML.
    if not (res and res.get("ok")) and used_custom_emoji:
        log.warning("sendMessage failed with custom_emoji entities — retrying without them")
        payload.pop("entities", None)
        used_custom_emoji = False
        res = await _post("sendMessage", payload)
    # Retry 2: HTML parse error — Telegram rejected the markup. Strip all tags
    # and resend as plain text so the notification always reaches the user.
    if _is_html_parse_error(res):
        log.warning("sendMessage HTML parse error (%s) — retrying as plaintext. desc=%s",
                    chat_id, res.get("description", "")[:200])
        plain = _strip_html(text)
        plain_payload = {"chat_id": chat_id, "text": plain, "disable_web_page_preview": True}
        res = await _post("sendMessage", plain_payload)
    return res


async def send_photo(chat_id: int, photo_bytes: bytes, caption: str, parse_mode: str = "HTML", *, premium_emojis: bool = False) -> Optional[dict]:
    # Telegram hard-limits a photo caption to 1024 chars; over-length 400-rejects
    # the whole sendPhoto so the screenshot never arrives. Cap defensively.
    if isinstance(caption, str) and len(caption) > 1024:
        caption = caption[:1021] + "..."
    files = {"photo": ("hit.jpg", photo_bytes, "image/jpeg")}
    data = {"chat_id": str(chat_id), "caption": caption, "parse_mode": parse_mode}
    used_custom_emoji = False
    if premium_emojis:
        try:
            from services.custom_emojis import build_entities
            entities = build_entities(caption)
            if entities:
                import json as _j
                data["caption_entities"] = _j.dumps(entities)
                used_custom_emoji = True
        except Exception as e:
            log.warning("custom-emoji caption entity build failed: %s", e)
    res = await _post("sendPhoto", data, files=files)
    # Retry 1: custom-emoji entity failure.
    if not (res and res.get("ok")) and used_custom_emoji:
        log.warning("sendPhoto failed with custom_emoji caption entities — retrying without them")
        data.pop("caption_entities", None)
        used_custom_emoji = False
        res = await _post("sendPhoto", data, files=files)
    # Retry 2: HTML parse error — strip caption tags and resend.
    if _is_html_parse_error(res):
        log.warning("sendPhoto HTML parse error (%s) — retrying with plain caption. desc=%s",
                    chat_id, res.get("description", "")[:200])
        data["caption"] = _strip_html(caption)
        data.pop("parse_mode", None)
        res = await _post("sendPhoto", data, files=files)
    return res


async def send_document(chat_id: int, doc_bytes: bytes, filename: str, caption: str = "", parse_mode: str = "HTML") -> Optional[dict]:
    files = {"document": (filename, doc_bytes, "application/zip")}
    data = {"chat_id": str(chat_id), "parse_mode": parse_mode}
    if caption:
        data["caption"] = caption
    return await _post("sendDocument", data, files=files)


async def answer_callback_query(callback_query_id: str, text: str = "", show_alert: bool = False) -> Optional[dict]:
    """Ack an inline-button tap so the client stops its loading spinner. Optional
    toast/alert text can be shown to the user."""
    payload = {"callback_query_id": callback_query_id, "show_alert": show_alert}
    if text:
        payload["text"] = text[:200]
    return await _post("answerCallbackQuery", payload)


async def pin_message(chat_id: int, message_id: int, disable_notification: bool = True) -> Optional[dict]:
    return await _post(
        "pinChatMessage",
        {"chat_id": chat_id, "message_id": message_id, "disable_notification": disable_notification},
    )


async def copy_message(
    to_chat_id: int,
    from_chat_id: int,
    message_id: int,
    caption: Optional[str] = None,
    parse_mode: str = "HTML",
) -> Optional[dict]:
    """Forward a message to another chat without the "Forwarded from" header.
    Used for /paid proof-of-payment: user's photo is copied to the owner
    with an admin caption, so the owner sees the receipt + user context but
    the user's original message isn't leaked as a forward."""
    payload = {
        "chat_id": to_chat_id,
        "from_chat_id": from_chat_id,
        "message_id": message_id,
        "parse_mode": parse_mode,
    }
    if caption is not None:
        payload["caption"] = caption
    return await _post("copyMessage", payload)


# ---------- OTP delivery ----------

async def send_otp(chat_id: int, otp_code: str, ttl_minutes: int) -> bool:
    text = (
        "<b>🔐 SEMEX Login OTP</b>\n\n"
        f"Your code: <code>{otp_code}</code>\n\n"
        f"⏰ Expires in <b>{ttl_minutes} minutes</b>.\n"
        "🚫 Do <b>NOT</b> share this code with anyone."
    )
    r = await send_message(chat_id, text)
    return r is not None and r.get("ok", False)


async def send_welcome(chat_id: int, username: Optional[str]) -> None:
    name = f"@{username}" if username else "there"
    text = (
        f"<b>👋 Welcome to SEMEX, {name}!</b>\n\n"
        "You've successfully authenticated. "
        "Enjoy the ride. 💜"
    )
    await send_message(chat_id, text)
