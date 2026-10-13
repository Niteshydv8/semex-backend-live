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

# Persistent HTTP client — reuses TCP+TLS connections to api.telegram.org instead
# of paying a full handshake on every send_message/send_photo/sendDocument call.
# The client is lazily created on first use and shared for the process lifetime.
_tg_http: httpx.AsyncClient | None = None
_tg_http_loop = None


def _get_http() -> httpx.AsyncClient:
    global _tg_http, _tg_http_loop
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None
    # Recreate the client when it is closed OR bound to a different/closed
    # event loop — a keep-alive client created inside one asyncio.run() must
    # not leak into the next (tests spin a fresh loop per call).
    if _tg_http is None or _tg_http.is_closed or _tg_http_loop is not loop:
        _tg_http = httpx.AsyncClient(
            timeout=20.0,
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
        )
        _tg_http_loop = loop
    return _tg_http


async def _raw_post(base_url: str, method: str, data: dict, files: Optional[dict] = None) -> Optional[dict]:
    """Core HTTP poster — shared by main bot and notification bot."""
    url = f"{base_url}/{method}"
    client = _get_http()
    for attempt in range(1, _MAX_SEND_ATTEMPTS + 1):
        try:
            if files:
                r = await client.post(url, data=data, files=files)
            else:
                r = await client.post(url, json=data)
            try:
                resp = r.json()
            except Exception:
                resp = None
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
            return resp
        except httpx.TransportError as e:
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


async def _post(method: str, data: dict, files: Optional[dict] = None) -> Optional[dict]:
    return await _raw_post(_BASE, method, data, files)


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
    # Telegram's photo caption limit is 1024 *visible* characters (after HTML
    # entity/tag parsing) — NOT raw HTML string length.  The previous raw-length
    # cap was wrong: a long <a href="..."> href (e.g. a Stripe checkout URL with
    # many query params) makes the raw HTML much longer than 1024 even though the
    # visible text is well under the limit.  Truncating raw HTML at 1024 can cut
    # the opening tag mid-way (e.g. '<a href="https://...'), leaving an unclosed
    # tag that _strip_html's regex cannot match — the raw tag then bleeds through
    # in the plaintext retry as literal text, and CHARGED hit notifications fail
    # to deliver at all after repeated outbox retries.
    # _photo_caption() upstream already ensures visible length ≤ 1024; this is
    # only a safety net for any caller that bypasses that check.
    import re as _re_cap
    if isinstance(caption, str) and len(_re_cap.sub(r"<[^>]+>", "", caption)) > 1024:
        caption = _re_cap.sub(r"<[^>]+>", "", caption)[:1021] + "..."
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


async def edit_message_text(chat_id: int, message_id: int, text: str, reply_markup: Optional[dict] = None) -> Optional[dict]:
    """Edit a bot message in place (used by the login authorize card)."""
    payload = {
        "chat_id": chat_id,
        "message_id": message_id,
        "text": text[:4093] + "..." if isinstance(text, str) and len(text) > 4096 else text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    }
    if reply_markup is not None:
        payload["reply_markup"] = reply_markup
    return await _post("editMessageText", payload)


async def answer_callback_query(callback_query_id: str, text: str = "", show_alert: bool = False) -> Optional[dict]:
    """Ack an inline-button tap so the client stops its loading spinner. Optional
    toast/alert text can be shown to the user."""
    payload = {"callback_query_id": callback_query_id, "show_alert": show_alert}
    if text:
        payload["text"] = text[:200]
    return await _post("answerCallbackQuery", payload)


async def send_invoice(chat_id: int, title: str, description: str, payload: str, stars: int) -> Optional[dict]:
    """Telegram Stars invoice (digital goods — currency XTR, no provider_token)."""
    data = {
        "chat_id": chat_id,
        "title": title[:32],
        "description": description[:255],
        "payload": payload,
        "currency": "XTR",
        "prices": [{"label": title[:32], "amount": int(stars)}],
    }
    return await _post("sendInvoice", data)


async def answer_pre_checkout_query(query_id: str, ok: bool = True, error_message: str = "") -> Optional[dict]:
    """Must be called within 10s of receiving a pre_checkout_query."""
    data: dict = {"pre_checkout_query_id": query_id, "ok": ok}
    if not ok and error_message:
        data["error_message"] = error_message[:200]
    return await _post("answerPreCheckoutQuery", data)


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


# Aliases so callers don't need to change — all messages go through the single bot.
notify_message = send_message


async def notify_photo(
    chat_id: int,
    photo_bytes: bytes,
    caption: str,
    parse_mode: str = "HTML",
) -> Optional[dict]:
    return await send_photo(chat_id, photo_bytes, caption, parse_mode)


# ---------- OTP delivery ----------

async def send_otp(chat_id: int, otp_code: str, ttl_minutes: int) -> bool:
    text = (
        "🔐 <b>SEMEX — Login Code</b>\n"
        "━━━━━━━━━━━━━━━━━━━━\n\n"
        "Your one-time sign-in code:\n\n"
        f"<code>{otp_code}</code>\n\n"
        f"⏱ Expires in <b>{ttl_minutes} minute{'s' if ttl_minutes != 1 else ''}</b>\n"
        "🚫 <b>Never share this code with anyone.</b>"
    )
    r = await notify_message(chat_id, text)
    return r is not None and r.get("ok", False)


async def send_welcome(chat_id: int, username: Optional[str]) -> None:
    name = f"@{username}" if username else "there"
    text = (
        f"👋 <b>Welcome, {name}!</b>\n"
        "━━━━━━━━━━━━━━━━━━━━\n\n"
        "You're now signed into SEMEX. Enjoy the ride. 💜\n\n"
        "Open the extension and start hitting. 🚀"
    )
    await notify_message(chat_id, text)
