"""Telegram Bot API service - send OTP, forward hits, admin logging."""
from __future__ import annotations

import logging
from typing import Optional

import httpx

from config import settings

log = logging.getLogger("semex.telegram")

_BASE = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}"


async def _post(method: str, data: dict, files: Optional[dict] = None) -> Optional[dict]:
    url = f"{_BASE}/{method}"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            if files:
                r = await client.post(url, data=data, files=files)
            else:
                r = await client.post(url, json=data)
            if r.status_code != 200:
                log.warning("Telegram %s failed: %s %s", method, r.status_code, r.text[:400])
                return None
            return r.json()
    except Exception as e:
        log.exception("Telegram %s error: %s", method, e)
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


async def send_message(chat_id: int, text: str, parse_mode: str = "HTML", *, premium_emojis: bool = True) -> Optional[dict]:
    payload = {"chat_id": chat_id, "text": text, "parse_mode": parse_mode, "disable_web_page_preview": True}
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
    # Custom-emoji entities only work when the bot is allowed to send those exact
    # custom_emoji_ids (premium/owned sticker pack). If the IDs are invalid the
    # WHOLE message is 400-rejected and nothing is delivered. Retry once without
    # the entities so the notification always goes through as plain text.
    if res is None and used_custom_emoji:
        log.warning("sendMessage failed with custom_emoji entities — retrying without them")
        payload.pop("entities", None)
        res = await _post("sendMessage", payload)
    return res


async def send_photo(chat_id: int, photo_bytes: bytes, caption: str, parse_mode: str = "HTML", *, premium_emojis: bool = True) -> Optional[dict]:
    files = {"photo": ("hit.jpg", photo_bytes, "image/jpeg")}
    data = {"chat_id": str(chat_id), "caption": caption, "parse_mode": parse_mode}
    used_custom_emoji = False
    if premium_emojis:
        try:
            from services.custom_emojis import build_entities
            entities = build_entities(caption)
            if entities:
                # multipart uses caption_entities as a JSON string
                import json as _j
                data["caption_entities"] = _j.dumps(entities)
                used_custom_emoji = True
        except Exception as e:
            log.warning("custom-emoji caption entity build failed: %s", e)
    res = await _post("sendPhoto", data, files=files)
    # Same fallback as send_message: invalid custom_emoji_ids 400-reject the
    # entire photo (screenshot never arrives). Retry once without entities.
    if res is None and used_custom_emoji:
        log.warning("sendPhoto failed with custom_emoji caption entities — retrying without them")
        data.pop("caption_entities", None)
        res = await _post("sendPhoto", data, files=files)
    return res


async def send_document(chat_id: int, doc_bytes: bytes, filename: str, caption: str = "", parse_mode: str = "HTML") -> Optional[dict]:
    files = {"document": (filename, doc_bytes, "application/zip")}
    data = {"chat_id": str(chat_id), "parse_mode": parse_mode}
    if caption:
        data["caption"] = caption
    return await _post("sendDocument", data, files=files)


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
