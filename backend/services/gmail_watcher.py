"""Background task — polls Gmail via IMAP for Binance Pay payment confirmations.

How it works:
  1. User initiates Binance Pay via the bot → receives a unique SEMEX-XXXXXXXX code
  2. User sends USDT to your Binance Pay ID with the code in the Note/Memo field
  3. Binance sends you a "payment received" email — the memo appears in the body
  4. This watcher scans every 90 s, finds the code, and auto-fulfills the payment

Required env vars (set on Railway):
  GMAIL_ADDRESS       — Gmail address that receives Binance notifications
  GMAIL_APP_PASSWORD  — 16-char App Password (NOT your Google password)
                        Create one at: myaccount.google.com/apppasswords
                        (Google Account → Security → App Passwords)
"""
from __future__ import annotations

import asyncio
import email
import imaplib
import logging
import re
from email.header import decode_header

from config import settings

log = logging.getLogger(__name__)

_POLL_INTERVAL = 90        # seconds between inbox checks
_IMAP_HOST     = "imap.gmail.com"
_IMAP_PORT     = 993
_CODE_RE       = re.compile(r"SEMEX-[a-z0-9]{8}", re.IGNORECASE)

# Binance sends from various addresses depending on region / email type
_BINANCE_SENDERS = (
    "do-not-reply@binance.com",
    "noreply@binance.com",
    "no-reply@binance.com",
    "notification@binance.com",
    "accounts@binance.com",
    "binance.com",          # catch-all: any subdomain @binance.com
)

_task: asyncio.Task | None = None


# ─── Email parsing helpers ────────────────────────────────────────────────────

def _decode_bytes(raw: bytes, charset: str | None) -> str:
    try:
        return raw.decode(charset or "utf-8", errors="replace")
    except (LookupError, UnicodeDecodeError):
        return raw.decode("utf-8", errors="replace")


def _extract_body(msg: email.message.Message) -> str:
    parts: list[str] = []
    if msg.is_multipart():
        for part in msg.walk():
            ct = part.get_content_type()
            if ct in ("text/plain", "text/html"):
                payload = part.get_payload(decode=True)
                if payload:
                    parts.append(_decode_bytes(payload, part.get_content_charset()))
    else:
        payload = msg.get_payload(decode=True)
        if payload:
            parts.append(_decode_bytes(payload, msg.get_content_charset()))
    return " ".join(parts)


def _decode_header_str(raw: str) -> str:
    parts = decode_header(raw or "")
    decoded = []
    for chunk, enc in parts:
        if isinstance(chunk, bytes):
            decoded.append(_decode_bytes(chunk, enc))
        else:
            decoded.append(chunk)
    return " ".join(decoded)


# ─── IMAP polling (runs in a thread-pool executor) ────────────────────────────

def _check_mail_sync(gmail_addr: str, app_password: str) -> list[str]:
    """Blocking: connect to Gmail, fetch unread Binance emails, return matched codes."""
    found: list[str] = []
    try:
        conn = imaplib.IMAP4_SSL(_IMAP_HOST, _IMAP_PORT)
        conn.login(gmail_addr, app_password)
        conn.select("INBOX")

        _, data = conn.search(None, "UNSEEN")
        if not data or not data[0]:
            conn.logout()
            return found

        ids = data[0].split()
        # Process newest first, cap at 50 to avoid large sweeps
        for num in reversed(ids[-50:]):
            try:
                _, msg_data = conn.fetch(num, "(RFC822)")
            except Exception:
                continue
            if not msg_data or not msg_data[0]:
                continue
            raw = msg_data[0][1]
            if not isinstance(raw, bytes):
                continue

            msg = email.message_from_bytes(raw)
            sender = msg.get("From", "").lower()

            # Only process emails from Binance
            if not any(b in sender for b in _BINANCE_SENDERS):
                continue

            # Mark as read so we don't re-process it
            conn.store(num, "+FLAGS", "\\Seen")

            subject = _decode_header_str(msg.get("Subject", ""))
            body    = _extract_body(msg)
            full_text = subject + " " + body

            for match in _CODE_RE.findall(full_text):
                found.append(match)

        conn.logout()
    except imaplib.IMAP4.error as e:
        log.error("gmail_watcher IMAP auth/protocol error: %s", e)
    except OSError as e:
        log.warning("gmail_watcher network error: %s", e)
    except Exception as e:
        log.exception("gmail_watcher unexpected error: %s", e)
    return found


# ─── Fulfillment (called in the async loop after a code is matched) ───────────

async def _fulfill_binance_pay(pending: dict) -> None:
    from services.group_manager import upsert_group_membership, create_one_time_invite_link
    from db import get_db

    tid      = pending["telegram_id"]
    product  = pending["product"]
    amount   = pending["amount_usdt"]
    username = pending.get("username", "-")
    code     = pending.get("code", "")

    _period_map = {"group_weekly": "7 days", "group_2week": "14 days", "group_monthly": "30 days"}
    _plan_map   = {"group_weekly": "7d",      "group_2week": "14d",      "group_monthly": "30d"}
    period   = _period_map.get(product, "7 days")
    plan_key = _plan_map.get(product, "7d")
    group_id = int(getattr(settings, "PREMIUM_GROUP_ID", 0) or 0)

    try:
        membership, action = await upsert_group_membership(
            telegram_id=tid,
            username=username,
            group_id=group_id,
            plan=plan_key,
            payment_method="usdt_binance_pay",
            payment_ref=code,
        )
        exp_at  = membership.get("expires_at")
        exp_str = exp_at.strftime("%Y-%m-%d") if exp_at else "?"

        from routes.telegram_bot import notify_message  # type: ignore[import]

        if action == "renewed":
            await notify_message(
                tid,
                "✅ <b>Binance Pay Confirmed — Group Renewed!</b>\n"
                "━━━━━━━━━━━━━━━━━━━━\n"
                f"💵 <b>${amount} USDT</b>  ·  {period}\n"
                f"📅 Valid until <b>{exp_str}</b>\n"
                "━━━━━━━━━━━━━━━━━━━━\n"
                "✅ Access extended — enjoy the group! 🔥",
            )
        else:
            link: str | None = await create_one_time_invite_link(group_id) if group_id else None
            if not link:
                link = (getattr(settings, "PREMIUM_GROUP_LINK", "") or "").strip() or None
            if link:
                await get_db().group_memberships.update_one(
                    {"telegram_id": tid, "kicked": False},
                    {"$set": {"invite_link": link}},
                )
                await notify_message(
                    tid,
                    "✅ <b>Binance Pay Confirmed!</b>\n"
                    "━━━━━━━━━━━━━━━━━━━━\n"
                    f"💵 <b>${amount} USDT</b>  ·  {period}\n"
                    f"📅 Valid until <b>{exp_str}</b>\n\n"
                    f"👉 <b>Your invite:</b> {link}\n"
                    "━━━━━━━━━━━━━━━━━━━━\n"
                    "⚠️ <i>One-time link — use it once to join.</i>",
                )
            else:
                await notify_message(
                    tid,
                    "✅ <b>Binance Pay Confirmed!</b>\n\n"
                    f"Plan: <b>{period}</b>  ·  <b>${amount} USDT</b>\n\n"
                    "Your invite link is being prepared — you'll receive it shortly.",
                )

        # Notify owner
        try:
            await notify_message(
                settings.ADMIN_TELEGRAM_ID,
                "💵 <b>BINANCE PAY — AUTO DETECTED</b>\n"
                "━━━━━━━━━━━━━━━━━━━━\n"
                f"👤 @{username}  (<code>{tid}</code>)\n"
                f"📦 {product}  ·  ${amount} USDT\n"
                f"🔑 Code: <code>{code}</code>\n"
                "✅ Auto-fulfilled via Gmail",
            )
        except Exception:
            pass

    except Exception as e:
        log.exception("gmail_watcher: fulfill failed for %s (code=%s): %s", tid, code, e)


# ─── Poll loop ────────────────────────────────────────────────────────────────

async def _poll_loop() -> None:
    from services.pending_payments import find_by_code, mark_fulfilled

    gmail_addr = (getattr(settings, "GMAIL_ADDRESS", "") or "").strip()
    app_pw     = (getattr(settings, "GMAIL_APP_PASSWORD", "") or "").strip()

    if not gmail_addr or not app_pw:
        log.info("gmail_watcher: GMAIL_ADDRESS/GMAIL_APP_PASSWORD not set — disabled")
        return

    log.info("gmail_watcher: started — polling %s every %ds", gmail_addr, _POLL_INTERVAL)
    loop = asyncio.get_running_loop()

    while True:
        await asyncio.sleep(_POLL_INTERVAL)
        try:
            raw_codes: list[str] = await loop.run_in_executor(
                None, _check_mail_sync, gmail_addr, app_pw
            )
            for raw in raw_codes:
                code = raw.upper()
                pending = await find_by_code(code)
                if not pending:
                    log.debug("gmail_watcher: code %s not found / already fulfilled", code)
                    continue
                await mark_fulfilled(code)
                await _fulfill_binance_pay(pending)
        except asyncio.CancelledError:
            raise
        except Exception as e:
            log.exception("gmail_watcher: poll iteration error: %s", e)


# ─── Start / stop ─────────────────────────────────────────────────────────────

def start_gmail_watcher() -> None:
    global _task
    _task = asyncio.create_task(_poll_loop())
    log.info("gmail_watcher: task created")


def stop_gmail_watcher() -> None:
    global _task
    if _task and not _task.done():
        _task.cancel()
    _task = None
    log.info("gmail_watcher: stopped")
