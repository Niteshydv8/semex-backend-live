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

import html as _html
import logging
import os
import re
from datetime import datetime, timezone
from pathlib import Path

import httpx
from fastapi import APIRouter, Request

from config import settings
from models import User
from services.sessions import issue_session
from services.telegram import (
    answer_callback_query,
    answer_pre_checkout_query,
    copy_message,
    edit_message_text,
    notify_message,
    send_document,
    send_invoice,
    send_message,
    send_welcome,
)
from security import generate_redeem_code, hash_redeem_code, preview_redeem_code

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
    """Show premium plans + private-group offer + USDT wallets (BEP20/TRC20/TON)."""
    owner_handle = (settings.OWNER_HANDLE or settings.TELEGRAM_BOT_USERNAME or "").replace("@", "")
    price_monthly = getattr(settings, "PLAN_PRICE_MONTHLY", None) or "$100"
    price_yearly = (getattr(settings, "PLAN_PRICE_YEARLY", "") or "").strip()
    price_lifetime = (getattr(settings, "PLAN_PRICE_LIFETIME", "") or "").strip()
    group_weekly = getattr(settings, "GROUP_PRICE_WEEKLY", None) or "$25"
    group_2week = getattr(settings, "GROUP_PRICE_2WEEK", None) or "$38"
    group_monthly = getattr(settings, "GROUP_PRICE_MONTHLY", None) or "$50"
    has_crypto = bool((getattr(settings, "CRYPTO_BOT_TOKEN", "") or "").strip())
    usdt_bep20 = getattr(settings, "PAYMENT_USDT_BEP20", "")
    usdt_trc20 = getattr(settings, "PAYMENT_USDT_TRC20", "")
    usdt_ton = getattr(settings, "PAYMENT_USDT_TON", "")

    greeting = f"@{username}" if username else "there"
    lines = [
        f"💎 <b>SEMEX Premium</b>  ·  Hey {greeting}",
        "━━━━━━━━━━━━━━━━━━━━",
        "",
        "📦 <b>BOT ACCESS — Premium</b>",
        f"├ <b>MONTHLY</b>  ·  {price_monthly}",
    ]
    if price_yearly:
        lines.append(f"├ <b>YEARLY</b>   ·  {price_yearly}")
    if price_lifetime:
        lines.append(f"└ <b>LIFETIME</b> ·  {price_lifetime}  <i>(one-time)</i>")
    else:
        lines[-1] = lines[-1].replace("├", "└")

    lines += [
        "",
        "<i>Includes: 3DS Bypass · full-quality screenshots · extended history · priority support</i>",
        "",
        "🔥 <b>PRIVATE GROUP — CC Drop + Methods</b>",
        f"├ <b>WEEKLY</b>     (7d)   ·  {group_weekly}",
        f"├ <b>BI-WEEKLY</b>  (14d)  ·  {group_2week}",
        f"└ <b>MONTHLY</b>   (30d)  ·  {group_monthly}",
        "",
        "<i>Fresh CCs · mix lines · unchecked lines · charged BINs &amp; sites · non-VBV BINs · tips &amp; more.</i>",
        "",
        "━━━━━━━━━━━━━━━━━━━━",
        "💵 <b>Pay with USDT</b> — tap a <b>💵 USDT</b> button below for auto-confirmation",
        "<i>Binance Pay → code in memo → detected in ~90s  |  Wallet → send → paste TxID here → instant</i>",
        "",
        "🔵 <b>BEP20</b>  (BNB Smart Chain — lowest fee)",
        f"<code>{usdt_bep20}</code>" if usdt_bep20 else "<i>—</i>",
        "",
        "🔴 <b>TRC20</b>  (Tron)",
        f"<code>{usdt_trc20}</code>" if usdt_trc20 else "<i>—</i>",
        "",
        "⚪ <b>TON</b>  (manual — screenshot via /paid)",
        f"<code>{usdt_ton}</code>" if usdt_ton else "<i>—</i>",
        "",
        "⭐ <b>Prefer Telegram Stars?</b>  Tap a ⭐ button below — instant, no crypto.",
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
            "stars": getattr(settings, "GROUP_STARS_WEEKLY", 1400),
            "usd": getattr(settings, "GROUP_PRICE_WEEKLY", "$25"),
        },
        "group_2week": {
            "title": "Private Group — Bi-Weekly",
            "desc": "14 days of the SEMEX private group (CC drop + methods).",
            "stars": getattr(settings, "GROUP_STARS_2WEEK", 1900),
            "usd": getattr(settings, "GROUP_PRICE_2WEEK", "$38"),
        },
        "group_monthly": {
            "title": "Private Group — Monthly",
            "desc": "30 days of the SEMEX private group (CC drop + methods).",
            "stars": getattr(settings, "GROUP_STARS_MONTHLY", 2700),
            "usd": getattr(settings, "GROUP_PRICE_MONTHLY", "$50"),
        },
    }


def _buy_stars_kb() -> dict:
    """Inline keyboard — Stars button + USDT auto-detect button for every group plan."""
    cat = _stars_catalog()
    rows = [
        # Premium plan — Stars only (no USDT button for Premium)
        [{"text": f"⭐ Premium Monthly — {cat['plan_monthly']['stars']} ⭐ ({cat['plan_monthly']['usd']})", "callback_data": "stars:plan_monthly"}],
    ]
    # Group plans: side-by-side Stars + USDT buttons
    for key in ("group_weekly", "group_2week", "group_monthly"):
        item = cat[key]
        short = item["title"].replace("Private Group — ", "Group ")
        rows.append([
            {"text": f"⭐ {short} — {item['stars']} ⭐", "callback_data": f"stars:{key}"},
            {"text": f"💵 USDT {item['usd']}", "callback_data": f"usdt:{key}"},
        ])
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
                          "is_banned": False, "banned_reason": None},
                 "$setOnInsert": {"telegram_id": uid, "telegram_username": username,
                                  "created_at": now, "hit_count": 0,
                                  "charged_count": 0, "live_count": 0}},
                upsert=True,
            )
            stacked = existing and existing > now
            # Sent via notification bot so it appears from SemEx Auto X
            await notify_message(
                chat_id,
                "🎉 <b>SEMEX Premium Activated!</b>\n"
                "━━━━━━━━━━━━━━━━━━━━\n"
                f"⭐ <b>{stars} Stars</b>  ·  MONTHLY (30 days"
                + (", stacked ✅" if stacked else "")
                + f")\n📅 Valid until <b>{new_expiry:%Y-%m-%d}</b>\n"
                "━━━━━━━━━━━━━━━━━━━━\n"
                "Open the extension — premium is live immediately. 🔥",
            )
            fulfilled = True
        except Exception as e:
            log.exception("stars plan fulfillment failed for %s: %s", uid, e)
    else:  # group_weekly / group_2week / group_monthly
        _period_map = {"group_weekly": "7 days", "group_2week": "14 days", "group_monthly": "30 days"}
        _plan_map   = {"group_weekly": "7d",      "group_2week": "14d",      "group_monthly": "30d"}
        period   = _period_map.get(product, "7 days")
        plan_key = _plan_map.get(product, "7d")
        group_id = int(getattr(settings, "PREMIUM_GROUP_ID", 0) or 0)
        try:
            from services.group_manager import upsert_group_membership, create_one_time_invite_link as _mk_link
            membership, action = await upsert_group_membership(
                telegram_id=uid,
                username=username,
                group_id=group_id,
                plan=plan_key,
                payment_method="stars",
                payment_ref=charge_id,
            )
            exp_at = membership.get("expires_at")
            exp_str = exp_at.strftime("%Y-%m-%d") if exp_at else "?"
            if action == "renewed":
                # Still in group — just extend, no new invite needed
                await notify_message(
                    chat_id,
                    "🎉 <b>SEMEX Private Group — Renewed!</b>\n"
                    "━━━━━━━━━━━━━━━━━━━━\n"
                    f"⭐ <b>{stars} Stars</b>  ·  {period}\n"
                    f"📅 Valid until <b>{exp_str}</b>\n"
                    "━━━━━━━━━━━━━━━━━━━━\n"
                    "✅ Access extended — enjoy the group! 🔥",
                )
                fulfilled = True
            else:
                # New member or re-joining after expiry — send a fresh one-time invite
                link: str | None = await _mk_link(group_id) if group_id else None
                if not link:
                    link = (getattr(settings, "PREMIUM_GROUP_LINK", "") or "").strip() or None
                if link:
                    try:
                        from db import get_db as _gdb
                        await _gdb().group_memberships.update_one(
                            {"telegram_id": uid, "kicked": False},
                            {"$set": {"invite_link": link}},
                        )
                    except Exception:
                        pass
                    await notify_message(
                        chat_id,
                        "🎉 <b>Welcome to the SEMEX Private Group!</b>\n"
                        "━━━━━━━━━━━━━━━━━━━━\n"
                        f"⭐ <b>{stars} Stars</b>  ·  {period}\n"
                        f"📅 Valid until <b>{exp_str}</b>\n\n"
                        f"👉 <b>Your invite:</b> {link}\n"
                        "━━━━━━━━━━━━━━━━━━━━\n"
                        "⚠️ <i>One-time link — use it once to join. "
                        "Message the owner if it stops working.</i>",
                    )
                    fulfilled = True
                else:
                    log.warning("No invite link available for %s (group_id=%s)", uid, group_id)
        except Exception as e:
            log.exception("stars group membership failed for %s: %s", uid, e)

    if not fulfilled:
        await notify_message(
            chat_id,
            "✅ <b>Payment received!</b>\n\n"
            "Activation hit a snag on our side — the owner has been notified "
            "and will complete it shortly. Keep this chat as your receipt.",
        )

    # Owner notification via notify bot — always sent with charge id for refunds
    try:
        await notify_message(
            settings.ADMIN_TELEGRAM_ID,
            "⭐ <b>STARS PAYMENT</b>\n"
            "━━━━━━━━━━━━━━━━━━━━\n"
            f"👤 @{username}  (<code>{uid}</code>)\n"
            f"📦 {item['title']}\n"
            f"⭐ {stars} XTR\n"
            f"🧾 <code>{charge_id}</code>\n"
            f"{'✅ Auto-fulfilled' if fulfilled else '⚠️ NEEDS MANUAL FULFILLMENT'}",
        )
    except Exception as e:
        log.warning("owner stars notification failed: %s", e)


# ─── CryptoBot (automated USDT) payment fulfillment ────────────────────────

async def _send_usdt_method_selector(chat_id: int, from_user_id: int | None, product: str) -> None:
    """Show payment-method choice keyboard for a USDT group subscription."""
    cat = _stars_catalog()
    item = cat.get(product)
    if not item or not product.startswith("group_"):
        await send_message(chat_id, "⚠️ Unknown product. Use /buy and try again.")
        return

    has_binance = bool((getattr(settings, "BINANCE_PAY_ID", "") or "").strip())
    has_trc20   = bool((getattr(settings, "PAYMENT_USDT_TRC20", "") or "").strip())
    has_bep20   = bool((getattr(settings, "PAYMENT_USDT_BEP20", "") or "").strip())
    has_ton     = bool((getattr(settings, "PAYMENT_USDT_TON",   "") or "").strip())

    rows = []
    if has_binance:
        rows.append([{"text": "🏦 Binance Pay — auto-confirm (~90s)", "callback_data": f"binpay:{product}"}])
    if has_trc20:
        rows.append([{"text": "🔴 TRC20 Wallet — verify by TxID", "callback_data": f"trc20:{product}"}])
    if has_bep20:
        rows.append([{"text": "🔵 BEP20 Wallet — verify by TxID", "callback_data": f"bep20:{product}"}])
    if has_ton:
        rows.append([{"text": "⚪ TON — manual (/paid screenshot)", "callback_data": f"ton:{product}"}])

    if not rows:
        await send_message(chat_id, "⚠️ No USDT payment methods are configured yet. Contact the owner.")
        return

    await send_message(
        chat_id,
        f"💵 <b>{item['title']}</b>\n"
        "━━━━━━━━━━━━━━━━━━━━\n"
        f"Amount: <b>{item['usd']} USDT</b>\n\n"
        "Choose your payment method 👇",
        reply_markup={"inline_keyboard": rows},
    )


async def _send_binance_pay_instructions(chat_id: int, from_user_id: int | None, product: str) -> None:
    """Generate a unique reference code and send Binance Pay payment instructions."""
    if not from_user_id:
        return
    cat = _stars_catalog()
    item = cat.get(product)
    if not item or not product.startswith("group_"):
        await send_message(chat_id, "⚠️ Unknown product.")
        return

    pay_id = (getattr(settings, "BINANCE_PAY_ID", "") or "").strip()
    if not pay_id:
        await send_message(
            chat_id,
            "⚠️ Binance Pay is not configured yet.\n\n"
            "Use a wallet option instead, or contact the owner.",
        )
        return

    # Supersede any existing unfulfilled pending for this user+product (all methods),
    # so switching from TRC20/BEP20 to Binance Pay doesn't leave a stale on-chain
    # pending that could intercept unrelated TxID submissions.
    try:
        from db import get_db as _gdb
        await _gdb().pending_payments.update_many(
            {"telegram_id": from_user_id, "product": product, "fulfilled": False},
            {"$set": {"fulfilled": True, "txid": "superseded"}},
        )
    except Exception:
        pass

    username = None
    try:
        from db import get_db as _gdb2
        user_doc = await _gdb2().users.find_one({"telegram_id": from_user_id})
        username = (user_doc or {}).get("telegram_username")
    except Exception:
        pass

    from services.pending_payments import create_pending
    pending = await create_pending(
        telegram_id=from_user_id,
        username=username,
        product=product,
        payment_method="binance_pay",
        amount_usdt=item["usd"].lstrip("$"),
    )
    code = pending["code"]
    usd  = item["usd"]

    await send_message(
        chat_id,
        "🏦 <b>Binance Pay — Auto-Detection</b>\n"
        "━━━━━━━━━━━━━━━━━━━━\n"
        f"💵 Amount: <b>{usd} USDT</b>\n"
        f"📋 Binance Pay ID: <code>{pay_id}</code>\n\n"
        "📝 <b>YOU MUST include this code in the Note/Memo:</b>\n"
        f"<code>{code}</code>\n\n"
        "━━━━━━━━━━━━━━━━━━━━\n"
        "<b>Steps:</b>\n"
        "1️⃣  Binance app → Pay → Send\n"
        f"2️⃣  Enter Pay ID: <code>{pay_id}</code>\n"
        f"3️⃣  Amount: <b>{usd} USDT</b>\n"
        f"4️⃣  Tap <i>Note</i> → paste exactly: <code>{code}</code>\n"
        "5️⃣  Confirm payment\n\n"
        "✅ <i>Your invite is sent automatically within ~90 seconds after we detect it.</i>\n"
        "⏰ <i>This code expires in 24 hours.</i>",
    )


async def _send_wallet_instructions(
    chat_id: int, from_user_id: int | None, product: str, chain: str
) -> None:
    """Show wallet address and ask user to paste TxID after sending."""
    if not from_user_id:
        return
    cat = _stars_catalog()
    item = cat.get(product)
    if not item or not product.startswith("group_"):
        await send_message(chat_id, "⚠️ Unknown product.")
        return

    _chain_cfg = {
        "trc20": ("PAYMENT_USDT_TRC20", "🔴 TRC20 (TRON network)", "USDT-TRC20"),
        "bep20": ("PAYMENT_USDT_BEP20", "🔵 BEP20 (BNB Smart Chain)", "USDT-BEP20"),
    }
    cfg = _chain_cfg.get(chain)
    if not cfg:
        await send_message(chat_id, "⚠️ Unknown chain.")
        return
    setting_key, chain_label, token_label = cfg

    addr = (getattr(settings, setting_key, "") or "").strip()
    if not addr:
        await send_message(
            chat_id,
            f"⚠️ {chain_label} address not configured yet.\n\nTry Binance Pay or contact the owner.",
        )
        return

    # Cancel any existing unfulfilled on-chain pending for this user+product
    from services.pending_payments import create_pending, cancel_pending_onchain
    await cancel_pending_onchain(from_user_id, product)

    username = None
    try:
        from db import get_db as _gdb3
        user_doc = await _gdb3().users.find_one({"telegram_id": from_user_id})
        username = (user_doc or {}).get("telegram_username")
    except Exception:
        pass

    await create_pending(
        telegram_id=from_user_id,
        username=username,
        product=product,
        payment_method=chain,
        amount_usdt=item["usd"].lstrip("$"),
    )

    await send_message(
        chat_id,
        f"{chain_label}\n"
        "━━━━━━━━━━━━━━━━━━━━\n"
        f"💵 Send exactly: <b>{item['usd']} USDT</b>  ({token_label})\n\n"
        f"📋 To this address:\n<code>{addr}</code>\n\n"
        "━━━━━━━━━━━━━━━━━━━━\n"
        "After sending:\n"
        "👉 <b>Paste your TxID / transaction hash here</b> in this chat.\n"
        "   We verify it on-chain automatically — no screenshot needed.\n\n"
        "⏰ <i>You have 24 hours to complete this payment.</i>",
    )


async def _send_ton_instructions(chat_id: int, from_user_id: int | None, product: str) -> None:
    """Show TON wallet address and manual /paid instructions."""
    if not from_user_id:
        return
    cat = _stars_catalog()
    item = cat.get(product)
    if not item or not product.startswith("group_"):
        await send_message(chat_id, "⚠️ Unknown product.")
        return

    addr = (getattr(settings, "PAYMENT_USDT_TON", "") or "").strip()
    if not addr:
        await send_message(
            chat_id,
            "⚠️ TON address not configured yet.\n\nTry Binance Pay or a wallet option instead.",
        )
        return

    await send_message(
        chat_id,
        "⚪ <b>TON — Manual Payment</b>\n"
        "━━━━━━━━━━━━━━━━━━━━\n"
        f"💵 Send exactly: <b>{item['usd']} USDT</b>  (USDT-TON)\n\n"
        f"📋 To this address:\n<code>{addr}</code>\n\n"
        "━━━━━━━━━━━━━━━━━━━━\n"
        "After sending:\n"
        "👉 Run <b>/paid</b> and send a screenshot of the completed transaction.\n"
        "   The owner will verify and send your invite link manually.\n\n"
        "⏰ <i>Include the transaction ID in the screenshot if possible.</i>",
    )


async def _handle_txid_submission(chat_id: int, from_user_id: int, txid: str) -> bool:
    """If the user sent a transaction hash and has a pending on-chain payment,
    verify and fulfill it.  Returns True if the message was consumed."""
    from services.pending_payments import find_latest_pending_onchain, mark_fulfilled
    from services.txid_verifier import verify_txid

    pending = await find_latest_pending_onchain(from_user_id)
    if not pending:
        return False   # no pending on-chain payment for this user — ignore

    await send_message(chat_id, "🔍 <i>Verifying your transaction on-chain… (~5s)</i>")
    ok, chain = await verify_txid(txid, pending["product"])

    if ok:
        await mark_fulfilled(pending["code"], txid=txid)
        await _fulfill_verified_txid(pending, txid=txid, chain=chain, chat_id=chat_id)
    else:
        await send_message(
            chat_id,
            "⚠️ <b>Transaction not verified.</b>\n\n"
            "<b>Common reasons:</b>\n"
            "• Not confirmed yet — wait 1-2 min and paste the TxID again\n"
            "• Wrong network (use TRC20 for 🔴, BEP20 for 🔵)\n"
            "• Amount doesn't match the plan price exactly\n"
            "• Sent to wrong address\n\n"
            "Double-check and try again, or use /paid to submit a screenshot for manual review.",
        )
    return True


async def _fulfill_verified_txid(pending: dict, txid: str, chain: str, chat_id: int) -> None:
    """Fulfill a group subscription after on-chain TxID verification."""
    from services.group_manager import upsert_group_membership, create_one_time_invite_link
    from db import get_db as _gdb4

    tid      = pending["telegram_id"]
    product  = pending["product"]
    amount   = pending["amount_usdt"]
    username = pending.get("username", "-")

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
            payment_method=f"usdt_{chain.lower()}",
            payment_ref=txid,
        )
        exp_at  = membership.get("expires_at")
        exp_str = exp_at.strftime("%Y-%m-%d") if exp_at else "?"

        chain_emoji = "🔴" if chain.upper() == "TRC20" else "🔵"

        if action == "renewed":
            await send_message(
                chat_id,
                f"{chain_emoji} <b>{chain} Verified — Group Renewed!</b>\n"
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
                await _gdb4().group_memberships.update_one(
                    {"telegram_id": tid, "kicked": False},
                    {"$set": {"invite_link": link}},
                )
                await send_message(
                    chat_id,
                    f"{chain_emoji} <b>{chain} Payment Verified!</b>\n"
                    "━━━━━━━━━━━━━━━━━━━━\n"
                    f"💵 <b>${amount} USDT</b>  ·  {period}\n"
                    f"📅 Valid until <b>{exp_str}</b>\n\n"
                    f"👉 <b>Your invite:</b> {link}\n"
                    "━━━━━━━━━━━━━━━━━━━━\n"
                    "⚠️ <i>One-time link — use it once to join.</i>",
                )
            else:
                await send_message(
                    chat_id,
                    f"✅ <b>{chain} Payment Verified!</b>\n\n"
                    f"Plan: <b>{period}</b>  ·  <b>${amount} USDT</b>\n\n"
                    "Invite link is being prepared — you'll receive it shortly.",
                )

        # Notify owner
        try:
            await notify_message(
                settings.ADMIN_TELEGRAM_ID,
                f"💵 <b>{chain} TXID VERIFIED</b>\n"
                "━━━━━━━━━━━━━━━━━━━━\n"
                f"👤 @{username}  (<code>{tid}</code>)\n"
                f"📦 {product}  ·  ${amount} USDT\n"
                f"🔗 <code>{txid[:48]}…</code>\n"
                "✅ Auto-fulfilled",
            )
        except Exception:
            pass

    except Exception as e:
        log.exception("txid_fulfill failed for %s: %s", tid, e)
        await send_message(
            chat_id,
            "✅ Payment verified but something went wrong setting up your access.\n"
            "The owner has been notified and will activate it manually.",
        )
        try:
            await notify_message(
                settings.ADMIN_TELEGRAM_ID,
                f"⚠️ <b>TXID FULFILL FAILED</b>\n"
                f"User: <code>{tid}</code>  product: {product}\n"
                f"TxID: <code>{txid[:48]}</code>\n"
                f"Error: {e}",
            )
        except Exception:
            pass


# ─── CryptoBot (automated USDT) payment fulfillment ─────────────────────────

async def _fulfill_cryptobot_payment(telegram_id: int, product: str, invoice_id: str) -> None:
    """Fulfill a confirmed CryptoBot USDT payment for a group subscription.

    Called from the CryptoBot webhook handler after signature verification.
    Mirrors the Stars group fulfillment logic: creates/extends membership,
    generates a one-time invite for new members, notifies the user and owner.
    """
    _period_map = {"group_weekly": "7 days", "group_2week": "14 days", "group_monthly": "30 days"}
    _plan_map   = {"group_weekly": "7d",      "group_2week": "14d",      "group_monthly": "30d"}
    _usd_map    = {"group_weekly": "$25",     "group_2week": "$38",      "group_monthly": "$50"}
    period   = _period_map.get(product, "7 days")
    plan_key = _plan_map.get(product, "7d")
    usd      = _usd_map.get(product, "")
    group_id = int(getattr(settings, "PREMIUM_GROUP_ID", 0) or 0)
    try:
        user_doc = None
        try:
            from db import get_db as _gdb3
            user_doc = await _gdb3().users.find_one({"telegram_id": telegram_id})
        except Exception:
            pass
        username = (user_doc or {}).get("telegram_username") or "-"

        from services.group_manager import upsert_group_membership, create_one_time_invite_link as _mk_link2
        membership, action = await upsert_group_membership(
            telegram_id=telegram_id,
            username=username,
            group_id=group_id,
            plan=plan_key,
            payment_method="usdt_crypto",
            payment_ref=invoice_id,
        )
        exp_at = membership.get("expires_at")
        exp_str = exp_at.strftime("%Y-%m-%d") if exp_at else "?"

        if action == "renewed":
            await notify_message(
                telegram_id,
                "🎉 <b>SEMEX Private Group — Renewed!</b>\n"
                "━━━━━━━━━━━━━━━━━━━━\n"
                f"💵 <b>{usd} USDT</b>  ·  {period}\n"
                f"📅 Valid until <b>{exp_str}</b>\n"
                "━━━━━━━━━━━━━━━━━━━━\n"
                "✅ Access extended — enjoy the group! 🔥",
            )
        else:
            link: str | None = await _mk_link2(group_id) if group_id else None
            if not link:
                link = (getattr(settings, "PREMIUM_GROUP_LINK", "") or "").strip() or None
            if link:
                try:
                    from db import get_db as _gdb4
                    await _gdb4().group_memberships.update_one(
                        {"telegram_id": telegram_id, "kicked": False},
                        {"$set": {"invite_link": link}},
                    )
                except Exception:
                    pass
                await notify_message(
                    telegram_id,
                    "🎉 <b>Welcome to the SEMEX Private Group!</b>\n"
                    "━━━━━━━━━━━━━━━━━━━━\n"
                    f"💵 <b>{usd} USDT</b>  ·  {period}\n"
                    f"📅 Valid until <b>{exp_str}</b>\n\n"
                    f"👉 <b>Your invite:</b> {link}\n"
                    "━━━━━━━━━━━━━━━━━━━━\n"
                    "⚠️ <i>One-time link — use it once to join.</i>",
                )
            else:
                await notify_message(
                    telegram_id,
                    "✅ <b>USDT Payment confirmed!</b>\n\n"
                    f"Plan: <b>{period}</b>  ·  <b>{usd}</b>\n\n"
                    "The invite link is being prepared — the owner will DM you shortly.",
                )
        # Always notify the owner
        try:
            await notify_message(
                settings.ADMIN_TELEGRAM_ID,
                "💵 <b>CRYPTOBOT USDT PAYMENT</b>\n"
                "━━━━━━━━━━━━━━━━━━━━\n"
                f"👤 @{username}  (<code>{telegram_id}</code>)\n"
                f"📦 {product}  ·  {usd}\n"
                f"🧾 <code>{invoice_id}</code>\n"
                f"✅ Auto-fulfilled",
            )
        except Exception:
            pass
    except Exception as e:
        log.exception("cryptobot fulfillment failed for %s product=%s: %s", telegram_id, product, e)


async def _send_cryptobot_invoice(chat_id: int, from_user_id: int | None, product: str) -> None:
    """Create a CryptoBot invoice and DM the payment link to the user."""
    if not from_user_id:
        return
    cat = _stars_catalog()
    item = cat.get(product)
    if not item or not product.startswith("group_"):
        await send_message(chat_id, "⚠️ Unknown product. Please use /buy and try again.")
        return
    token = (getattr(settings, "CRYPTO_BOT_TOKEN", "") or "").strip()
    if not token:
        await send_message(
            chat_id,
            "⚠️ Instant USDT payment is not configured yet.\n\n"
            "Please pay manually using the wallet addresses in /buy, "
            "then run /paid to submit your proof.",
        )
        return
    from services.cryptobot import create_invoice as _cb_invoice
    amount_str = item["usd"].lstrip("$")
    pay_url = await _cb_invoice(
        product=product,
        telegram_id=from_user_id,
        amount_usdt=amount_str,
        description=item["desc"],
        bot_username=settings.TELEGRAM_BOT_USERNAME or "",
    )
    if pay_url:
        await send_message(
            chat_id,
            f"💵 <b>{item['title']}</b>\n"
            "━━━━━━━━━━━━━━━━━━━━\n"
            f"Amount: <b>{item['usd']} USDT</b>\n\n"
            f"👉 <b><a href='{pay_url}'>Pay via CryptoBot</a></b>\n\n"
            "⏰ <i>Link expires in 1 hour. "
            "You'll receive your group invite automatically after payment.</i>",
        )
    else:
        await send_message(
            chat_id,
            "⚠️ Couldn't create the USDT invoice right now.\n\n"
            "Please pay manually using the wallet addresses in /buy, "
            "then run /paid to submit your proof.",
        )


# ─── /paid proof-of-payment flow ───────────────────────────────────────────
# Users who paid via /buy run /paid to enter proof-submit mode. Their NEXT
# photo message is copied to the owner (ADMIN_TELEGRAM_ID) with a rich caption
# so the owner can verify and activate.
#
# State is persisted in the `tg_proof_state` MongoDB collection so it survives
# server restarts. TTL (30 min) is enforced by a MongoDB TTL index on the
# `expires_at` field — NOT by an in-process timestamp check.
_PROOF_WAIT_SECONDS = 30 * 60  # 30 minutes to send the screenshot


async def _get_proof_entry(chat_id: int) -> dict | None:
    """Return the active proof-state document for this chat, or None if absent/expired."""
    try:
        from db import get_db
        return await get_db().tg_proof_state.find_one({"chat_id": chat_id})
    except Exception as e:
        log.warning("proof_state lookup failed: %s", e)
        return None


async def _set_proof_entry(chat_id: int, username: str | None, telegram_id: int) -> None:
    """Upsert a proof-state entry. MongoDB TTL index expires it after 30 min."""
    from datetime import datetime, timedelta, timezone
    from db import get_db
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=_PROOF_WAIT_SECONDS)
    await get_db().tg_proof_state.update_one(
        {"chat_id": chat_id},
        {"$set": {
            "chat_id": chat_id,
            "username": username,
            "telegram_id": telegram_id,
            "expires_at": expires_at,
        }},
        upsert=True,
    )


async def _clear_proof_entry(chat_id: int) -> None:
    """Remove the proof-state entry for this chat (single-use consumption or cancel)."""
    try:
        from db import get_db
        await get_db().tg_proof_state.delete_one({"chat_id": chat_id})
    except Exception as e:
        log.warning("proof_state delete failed: %s", e)


async def _cmd_paid(chat_id: int, username: str | None, telegram_id: int | None) -> None:
    """Enter proof-submission mode. The user's next photo is forwarded to
    the owner. State is stored in MongoDB and expires after 30 minutes."""
    await _set_proof_entry(chat_id, username, telegram_id or chat_id)
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
    await _clear_proof_entry(chat_id)
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


async def _cmd_groupstatus(chat_id: int, from_user_id: int | None) -> None:
    """Show the user's current private-group subscription status."""
    if not from_user_id:
        return
    from datetime import timedelta
    from services.group_manager import get_active_membership
    membership = await get_active_membership(from_user_id)
    if not membership:
        # Also check for a recent expired/kicked membership so we can advise renewal
        try:
            from db import get_db as _gdb5
            last = await _gdb5().group_memberships.find_one(
                {"telegram_id": from_user_id},
                sort=[("started_at", -1)],
            )
        except Exception:
            last = None
        if last:
            exp = last.get("expires_at")
            exp_str = exp.strftime("%Y-%m-%d") if exp else "?"
            await send_message(
                chat_id,
                "📋 <b>Group Subscription</b>\n"
                "━━━━━━━━━━━━━━━━━━━━\n"
                f"❌ Expired — last plan ended <b>{exp_str}</b>\n\n"
                "Use /buy to subscribe and rejoin the group. 🔄",
            )
        else:
            await send_message(
                chat_id,
                "📋 <b>Group Subscription</b>\n"
                "━━━━━━━━━━━━━━━━━━━━\n"
                "❌ No group subscription found.\n\n"
                "Use /buy to access the SEMEX private group. 🔑",
            )
        return

    expires_at = membership.get("expires_at")
    if expires_at and expires_at.tzinfo is None:
        from datetime import timezone as _tz
        expires_at = expires_at.replace(tzinfo=_tz.utc)
    from datetime import datetime as _dt, timezone as _tz2
    now = _dt.now(_tz2.utc)
    remaining = (expires_at - now) if expires_at else timedelta(0)
    days = int(remaining.total_seconds() // 86400)
    hours = int((remaining.total_seconds() % 86400) // 3600)
    plan_labels = {"7d": "Weekly (7 days)", "14d": "Bi-Weekly (14 days)", "30d": "Monthly (30 days)"}
    plan_label = plan_labels.get(membership.get("plan", ""), membership.get("plan", "?"))
    method_labels = {
        "stars":               "⭐ Telegram Stars",
        "usdt_crypto":         "💵 USDT (CryptoBot)",
        "usdt_binance_pay":    "💵 USDT (Binance Pay — auto)",
        "usdt_trc20":          "💵 USDT (TRC20 wallet — auto)",
        "usdt_bep20":          "💵 USDT (BEP20 wallet — auto)",
        "manual":              "💵 USDT (Manual)",
    }
    method = method_labels.get(membership.get("payment_method", ""), membership.get("payment_method", "?"))

    await send_message(
        chat_id,
        "📋 <b>Group Subscription</b>\n"
        "━━━━━━━━━━━━━━━━━━━━\n"
        f"📦 Plan: <b>{plan_label}</b>\n"
        f"💳 Paid via: {method}\n"
        f"📅 Expires: <b>{expires_at:%Y-%m-%d %H:%M} UTC</b>\n"
        f"⏰ Remaining: <b>{days}d {hours}h</b>\n"
        "━━━━━━━━━━━━━━━━━━━━\n"
        "Use /buy to renew before access ends. 🔄",
    )


async def _forward_proof_to_owner(
    chat_id: int,
    user_message_id: int,
    photo_caption: str | None,
) -> None:
    """Copy the user's photo message to the owner with a rich admin caption."""
    from datetime import datetime, timezone
    entry = await _get_proof_entry(chat_id)
    if not entry:
        # Not in proof-submit mode (or TTL already expired) → ignore silently.
        return

    # In-process expiry guard — the MongoDB TTL index cleans up documents
    # asynchronously (up to ~60 s after expires_at). Catch the gap here so the
    # user always gets feedback instead of a silent drop.
    expires_at = entry.get("expires_at")
    if expires_at:
        now = datetime.now(timezone.utc)
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if now > expires_at:
            await _clear_proof_entry(chat_id)
            await send_message(
                chat_id,
                "⏰ <b>Proof window expired</b>\n\n"
                "Your 30-minute submission window has closed and the screenshot "
                "was not sent to the owner.\n\n"
                "Please run /paid again to open a new window, then send your "
                "screenshot straight away.",
            )
            return

    # NOTE: the proof entry is cleared ONLY after the copy to the owner
    # succeeds — clearing it first meant a failed forward silently consumed the
    # one-shot state and the user could never retry (proof lost).
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
        await _clear_proof_entry(chat_id)  # single-use — consumed on success only
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
            "⚠️ Couldn't forward the proof — please send the screenshot again (your submission window is still open) or DM the owner directly.",
        )


def _owner_support_url() -> str | None:
    handle = (getattr(settings, "OWNER_HANDLE", "") or "").strip().lstrip("@")
    return f"https://t.me/{handle}" if handle else None


def _main_menu_kb() -> dict:
    """Inline keyboard shown under the /start welcome."""
    # Row 1 — extension download + premium
    row1 = [
        {"text": "🧩 Get Extension", "callback_data": "menu:get"},
        {"text": "💎 Go Premium", "callback_data": "menu:premium"},
    ]
    # Row 2 — status + support
    support_url = _owner_support_url()
    support_btn = (
        {"text": "🛟 Support", "url": support_url}
        if support_url
        else {"text": "🛟 Support", "callback_data": "menu:support"}
    )
    row2 = [
        {"text": "📊 My Status", "callback_data": "menu:settings"},
        support_btn,
    ]
    # Row 3 — redeem code entry prompt
    row3 = [{"text": "🔑 Redeem Code", "callback_data": "menu:redeem"}]
    return {"inline_keyboard": [row1, row2, row3]}


def _welcome_text(name: str, user_id: int | None) -> str:
    return (
        "⚜️ <b>SEMEX</b> · Checkout Suite\n"
        "━━━━━━━━━━━━━━━━━━━━\n"
        f"👤 {name}  ·  <code>{user_id if user_id is not None else '—'}</code>\n"
        "━━━━━━━━━━━━━━━━━━━━\n\n"
        "Your premium checkout-automation suite.\n"
        "Use the menu to grab the extension, go premium, or check your account.\n\n"
        "🔒 <i>Keep your login OTP private — never share it.</i>\n"
        "📖 /help — full command list"
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


async def _geo_for_ip(ip: str | None) -> str:
    """Best-effort IP geolocation for the login authorize card. 3s cap, never
    raises — a geo lookup must never block or break login."""
    if not ip:
        return "Unknown"
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            r = await client.get(f"https://ipapi.co/{ip}/json/")
            d = r.json()
        city, country = d.get("city"), d.get("country_name")
        if city and country:
            return f"{city}, {country}"
        return country or city or "Unknown"
    except Exception:
        return "Unknown"


async def _cmd_login_start(chat_id: int, from_user: dict, token: str) -> None:
    """Deep-link login entry: t.me/<bot>?start=login_<token> from the extension.

    Binds the token to the FIRST Telegram account that opens it, then shows an
    Authorize/Deny card with the requester's IP/location/device so the user can
    spot a hijacked link before approving."""
    from db import get_db
    db = get_db()
    doc = await db.telegram_login_tokens.find_one({"token": token})
    now = datetime.now(timezone.utc)
    exp = doc.get("expires_at") if doc else None
    if exp and exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if not doc or doc.get("status") != "pending" or (exp and exp < now):
        await send_message(
            chat_id,
            "⚠️ This login link is invalid or has expired.\n\n"
            "Go back to the SEMEX extension and tap <b>Login with Telegram</b> again.",
        )
        return

    tg_id = (from_user or {}).get("id")
    if not tg_id:
        return
    bound = doc.get("telegram_id")
    if bound and int(bound) != int(tg_id):
        await send_message(chat_id, "⚠️ This login link is already bound to a different Telegram account.")
        return
    if not bound:
        # Atomic first-opener claim — concurrent opens of the same link can't
        # both bind; the conditional filter makes only the first write win.
        claimed_bind = await db.telegram_login_tokens.find_one_and_update(
            {"token": token, "status": "pending", "telegram_id": None},
            {"$set": {"telegram_id": tg_id}},
        )
        if not claimed_bind:
            rebound = await db.telegram_login_tokens.find_one({"token": token})
            if not rebound or int(rebound.get("telegram_id") or 0) != int(tg_id):
                await send_message(chat_id, "⚠️ This login link is already bound to a different Telegram account.")
                return

    user = await db.users.find_one({"telegram_id": tg_id})
    if user and user.get("is_banned"):
        await send_message(chat_id, f"🚫 This account is banned: {_html.escape(user.get('banned_reason') or 'no reason')}")
        return

    geo = await _geo_for_ip(doc.get("ip"))
    dev = doc.get("device_info") or {}
    device = _html.escape(str(dev.get("platform") or "Unknown device"))
    lang = _html.escape(str(dev.get("language") or ""))
    text = (
        "🔐 <b>SEMEX Login Request</b>\n"
        "─ ─ ─ ─ ─ ─ ─ ─ ─ ─\n"
        f"🌐 <b>IP:</b> <code>{_html.escape(str(doc.get('ip') or 'Unknown'))}</code>\n"
        f"📍 <b>Location:</b> {_html.escape(geo)}\n"
        f"💻 <b>Device:</b> {device}" + (f" · {lang}" if lang else "") + "\n"
        f"🕒 <b>Time:</b> {now.strftime('%Y-%m-%d %H:%M UTC')}\n"
        "─ ─ ─ ─ ─ ─ ─ ─ ─ ─\n\n"
        "Only tap <b>Authorize</b> if you just clicked Login in the SEMEX "
        "extension and these details match this device."
    )
    kb = {"inline_keyboard": [
        [{"text": "✅ Authorize", "callback_data": f"tglogin:allow:{token}"}],
        [{"text": "❌ Deny", "callback_data": f"tglogin:deny:{token}"}],
    ]}
    await send_message(chat_id, text, reply_markup=kb)


async def _handle_login_callback(callback: dict, action: str, token: str) -> None:
    """Authorize/Deny tap on the login card. Mints the session on Authorize and
    parks the full auth payload on the token doc for the extension's polling."""
    from db import get_db
    db = get_db()
    msg = callback.get("message") or {}
    chat_id = (msg.get("chat") or {}).get("id")
    message_id = msg.get("message_id")
    from_user = callback.get("from") or {}
    tg_id = from_user.get("id")
    cb_id = callback.get("id")
    now = datetime.now(timezone.utc)

    doc = await db.telegram_login_tokens.find_one({"token": token})
    exp = doc.get("expires_at") if doc else None
    if exp and exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)

    async def _edit(text: str) -> None:
        if chat_id and message_id:
            try:
                await edit_message_text(chat_id, message_id, text)
            except Exception:
                pass

    if not doc or doc.get("status") != "pending" or (exp and exp < now):
        if cb_id:
            await answer_callback_query(cb_id, "This login link has expired or was already used.", True)
        await _edit("⚠️ SEMEX login link expired or already used — request a new one from the extension.")
        return
    if not tg_id or int(doc.get("telegram_id") or 0) != int(tg_id):
        if cb_id:
            await answer_callback_query(cb_id, "This login request is bound to a different Telegram account.", True)
        return

    if action == "deny":
        claimed = await db.telegram_login_tokens.find_one_and_update(
            {"token": token, "status": "pending"}, {"$set": {"status": "denied"}}
        )
        if cb_id:
            await answer_callback_query(cb_id, "Login denied.")
        if claimed:
            await _edit("❌ <b>SEMEX login denied.</b>\n\nNo session was created. If this wasn't you, you're safe — the requester was never logged in.")
        return

    # action == "allow"
    user_doc = await db.users.find_one({"telegram_id": tg_id})
    if user_doc and user_doc.get("is_banned"):
        if cb_id:
            await answer_callback_query(cb_id, "This account is banned.", True)
        return

    # Upsert the user. NEW accounts created via Telegram login start LOCKED
    # (requires_redeem=True) until they redeem an invite code — owner decision.
    is_new = user_doc is None
    photo_proxy = f"/api/user-photo/{tg_id}"
    if is_new:
        is_admin = tg_id == settings.ADMIN_TELEGRAM_ID
        new_user = User(
            telegram_id=tg_id,
            telegram_username=from_user.get("username"),
            telegram_first_name=from_user.get("first_name"),
            telegram_last_name=from_user.get("last_name"),
            telegram_photo_url=photo_proxy,
            is_admin=is_admin,
            plan="VIP" if is_admin else "TRIAL",
            plan_expires_at=None,
            requires_redeem=not is_admin,
            fingerprint=doc.get("fingerprint"),
            last_seen_at=now,
        )
        await db.users.insert_one(new_user.to_mongo())
        user_doc = await db.users.find_one({"telegram_id": tg_id})
    else:
        await db.users.update_one(
            {"telegram_id": tg_id},
            {"$set": {
                "telegram_username": from_user.get("username"),
                "telegram_first_name": from_user.get("first_name"),
                "telegram_last_name": from_user.get("last_name"),
                "telegram_photo_url": photo_proxy,
                "last_seen_at": now,
            }},
        )
        user_doc = await db.users.find_one({"telegram_id": tg_id})

    user = User.from_mongo(user_doc)
    issued = await issue_session(
        db,
        tg_id,
        doc.get("fingerprint") or "",
        device_info=doc.get("device_info"),
        ip_address=doc.get("ip"),
        user_agent=doc.get("user_agent"),
    )

    requires_redeem = bool(getattr(user, "requires_redeem", False))
    plan_expires_iso = None
    if user.plan_expires_at:
        pe = user.plan_expires_at
        if pe.tzinfo is None:
            pe = pe.replace(tzinfo=timezone.utc)
        plan_expires_iso = pe.isoformat()
    auth_payload = {
        "success": True,
        "accessToken": issued["accessToken"],
        "refreshToken": issued["refreshToken"],
        "sessionId": issued["sessionId"],
        "hasAccess": not requires_redeem,
        "requiresRedeem": requires_redeem,
        "user": {
            "telegramId": user.telegram_id,
            "username": user.telegram_username,
            "firstName": user.telegram_first_name,
            "lastName": user.telegram_last_name,
            "photoUrl": user.telegram_photo_url,
            "photoFileId": user.telegram_id if user.telegram_photo_url else None,
            "name": " ".join(filter(None, [user.telegram_first_name, user.telegram_last_name])) or user.telegram_username,
            "plan": user.plan,
            "planExpiresAt": plan_expires_iso,
            "isAdmin": user.is_admin,
            "status": "active",
            "is_banned": False,
        },
    }
    # Single atomic claim: pending→authorized publishes the payload in the SAME
    # write, so an "authorized" token can never exist without deliverable
    # credentials. All issuance work above happens BEFORE the claim — a mid-way
    # failure leaves the token pending and the user simply taps Authorize again.
    claimed = await db.telegram_login_tokens.find_one_and_update(
        {"token": token, "status": "pending"},
        {"$set": {"status": "authorized", "authorized_at": now, "auth_payload": auth_payload}},
    )
    if not claimed:
        # A concurrent Authorize tap won while we were issuing — revoke the
        # orphan session we just created so it can't be used.
        try:
            await db.sessions.update_one({"session_id": issued["sessionId"]}, {"$set": {"revoked": True}})
        except Exception:
            pass
        if cb_id:
            await answer_callback_query(cb_id, "Already processed.", True)
        return

    if issued["isFirstSession"]:
        try:
            await send_welcome(tg_id, user.telegram_username)
        except Exception:
            pass
    if cb_id:
        await answer_callback_query(cb_id, "✅ Authorized!")
    await _edit(
        "✅ <b>SEMEX login authorized.</b>\n\n"
        + ("🔒 Your account is new — redeem an invite code in the extension to unlock all features.\n\n" if requires_redeem else "")
        + "Return to the extension — you're signed in."
    )


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

    # Telegram login authorize/deny manages its OWN ack (needs alert toasts for
    # stale/foreign-account taps), so it must run BEFORE the generic ack below.
    if data.startswith("tglogin:"):
        _parts = data.split(":", 2)
        if len(_parts) == 3 and chat_id and chat.get("type") == "private":
            await _handle_login_callback(callback, _parts[1], _parts[2])
        return

    # Ack immediately so the client's spinner clears.
    if cb_id:
        try:
            await answer_callback_query(cb_id)
        except Exception:
            pass
    if not chat_id:
        return
    # Privacy gate: menu callbacks carry the SENDER's identity (from_user_id)
    # but post into the CHAT the button lives in. In a group (e.g. a forwarded
    # or stale menu message) that would leak the tapper's plan, counters and
    # saved BINs to the whole group. Menu actions are DM-only, same as the
    # text-command gate below.
    if chat.get("type") != "private":
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
    elif data == "menu:redeem":
        await send_message(
            chat_id,
            "🔑 <b>Redeem a Code</b>\n"
            "━━━━━━━━━━━━━━━━━━━━\n\n"
            "Send your invite/plan code using:\n\n"
            "<code>/redeem SEMEX-XXXX-XXXX-XXXX</code>\n\n"
            "<i>Each code is single-use. Contact the owner if you don't have one.</i>",
        )
    elif data.startswith("stars:"):
        await _send_stars_invoice(chat_id, data.split(":", 1)[1])
    elif data.startswith("usdt:"):
        await _send_usdt_method_selector(chat_id, from_user_id, data.split(":", 1)[1])
    elif data.startswith("binpay:"):
        await _send_binance_pay_instructions(chat_id, from_user_id, data.split(":", 1)[1])
    elif data.startswith("trc20:"):
        await _send_wallet_instructions(chat_id, from_user_id, data.split(":", 1)[1], "trc20")
    elif data.startswith("bep20:"):
        await _send_wallet_instructions(chat_id, from_user_id, data.split(":", 1)[1], "bep20")
    elif data.startswith("ton:"):
        await _send_ton_instructions(chat_id, from_user_id, data.split(":", 1)[1])
    elif data.startswith("cryptobot:"):
        await _send_cryptobot_invoice(chat_id, from_user_id, data.split(":", 1)[1])
    # Unknown callbacks are silently ignored.


async def _cmd_help(chat_id: int) -> None:
    text = (
        "🛠 <b>SEMEX — Commands</b>\n"
        "━━━━━━━━━━━━━━━━━━━━\n\n"
        "<b>📊 Account</b>\n"
        "/status — plan, expiry &amp; hit counters\n"
        "/groupstatus — private group subscription status\n"
        "/history — last 5 charged hits\n"
        "/bins — your saved BINs\n"
        "/savebin &lt;BIN&gt; [label] — save a BIN\n\n"
        "<b>🔑 Access</b>\n"
        "/redeem &lt;CODE&gt; — activate an invite/plan code\n\n"
        "<b>🚀 General</b>\n"
        "/start · /menu — main menu\n"
        "/get — download the extension .zip\n"
        "/buy — premium plans &amp; USDT wallets\n"
        "/paid — submit payment proof\n"
        "/cancel — cancel a pending /paid\n"
        "/settings — account + saved BINs\n"
        "/help — this list\n"
        "━━━━━━━━━━━━━━━━━━━━\n"
        "<i>Issues? Message the owner directly.</i>"
    )
    await send_message(chat_id, text)


async def _cmd_redeem(chat_id: int, from_user_id: int | None, args: list[str], username: str | None = None) -> None:
    """Redeem an invite/plan code directly from the bot.

    Usage: /redeem SEMEX-XXXX-XXXX-XXXX
    The code is hashed, validated, atomically claimed, and the user's plan +
    requires_redeem are updated in MongoDB — identical to the dashboard flow.

    If the sender has no SEMEX account yet (redeemed before ever logging in),
    a minimal user record is created via upsert so the plan activates
    immediately once they log in — the user is never stuck with an unused code.
    """
    from datetime import timedelta
    from db import get_db

    tid = from_user_id or chat_id
    if not args:
        await send_message(
            chat_id,
            "Usage: <code>/redeem SEMEX-XXXX-XXXX-XXXX</code>\n\nEnter the code you received from the owner.",
        )
        return

    code = args[0].strip().upper()
    if not code:
        await send_message(chat_id, "⚠️ Please provide a code: <code>/redeem SEMEX-XXXX-XXXX-XXXX</code>")
        return

    db = get_db()
    code_h = hash_redeem_code(code)
    doc = await db.redeem_codes.find_one({"code_hash": code_h})
    if not doc:
        await send_message(chat_id, "❌ <b>Invalid code.</b> Double-check the code and try again.")
        return
    if doc.get("used"):
        await send_message(chat_id, "❌ <b>Code already redeemed.</b> Each code can only be used once.")
        return

    user = await db.users.find_one({"telegram_id": tid})
    # No early-return when user is None — we upsert a minimal record below so
    # that a code given before registration still applies on first login.

    now = datetime.now(timezone.utc)
    duration_days = int(doc.get("duration_days", 30))
    plan_tag = doc.get("plan_tag") or "MONTHLY"

    # Stack onto existing expiry if still active (None for new users → base = now)
    existing_expiry = (user or {}).get("plan_expires_at")
    if existing_expiry and hasattr(existing_expiry, "tzinfo") and existing_expiry.tzinfo is None:
        existing_expiry = existing_expiry.replace(tzinfo=timezone.utc)
    base = existing_expiry if (existing_expiry and existing_expiry > now) else now

    if duration_days < 0:
        new_expiry = None  # lifetime / VIP
        plan_tag = "VIP"
    else:
        new_expiry = base + timedelta(days=duration_days)

    # Atomic claim — only the first claimer wins
    claimed = await db.redeem_codes.find_one_and_update(
        {"_id": doc["_id"], "used": {"$ne": True}},
        {"$set": {"used": True, "used_by": tid, "used_at": now}},
    )
    if not claimed:
        await send_message(chat_id, "❌ <b>Code already redeemed.</b> (Concurrent claim — please try a different code.)")
        return

    is_new_user = user is None
    try:
        await db.users.update_one(
            {"telegram_id": tid},
            {
                "$set": {
                    "plan": plan_tag,
                    "plan_expires_at": new_expiry,
                    "requires_redeem": False,
                    "expired_notified": False,
                    "expiry_alerts_sent": {},
                },
                # $setOnInsert only fires when a new document is created (upsert).
                # Mirrors _fulfill_stars_payment: a user who redeems before registering
                # gets a skeleton record — plan is live the moment they log in.
                "$setOnInsert": {
                    "telegram_id": tid,
                    "telegram_username": username,
                    "created_at": now,
                    "hit_count": 0,
                    "charged_count": 0,
                    "live_count": 0,
                    "is_banned": False,
                    "is_admin": False,
                },
            },
            upsert=True,
        )
    except Exception as e:
        # Roll back the claim so the user can retry
        log.exception("redeem entitlement write failed for %s: %s", tid, e)
        try:
            await db.redeem_codes.update_one(
                {"_id": doc["_id"]},
                {"$set": {"used": False}, "$unset": {"used_by": "", "used_at": ""}},
            )
        except Exception:
            pass
        await send_message(
            chat_id,
            "⚠️ <b>Redemption failed</b> — database error. Your code was <b>not consumed</b>. "
            "Please try again or contact the owner.",
        )
        return

    # Success receipt
    if new_expiry:
        exp_str = new_expiry.strftime("%Y-%m-%d")
        duration_str = f"{duration_days} day{'s' if duration_days != 1 else ''}"
    else:
        exp_str = "Never (Lifetime)"
        duration_str = "Lifetime"

    stacked_note = ""
    if existing_expiry and existing_expiry > now and new_expiry:
        stacked_note = "\n<i>(Stacked on your existing plan — time was added on top.)</i>"

    if is_new_user:
        next_step = (
            "🆕 <b>Account created automatically</b> — your plan is already reserved.\n\n"
            "➡️ To activate: open the SEMEX extension → tap <b>Login with Telegram</b> "
            "→ return here and run /status to confirm."
        )
    else:
        next_step = "✅ <b>Your account is now unlocked.</b> Open the extension — premium is active immediately. Use /status to verify."

    await send_message(
        chat_id,
        "🎉 <b>Code redeemed successfully!</b>\n\n"
        f"🏷 <b>Plan:</b> {plan_tag}\n"
        f"⏱ <b>Duration:</b> {duration_str}\n"
        f"📅 <b>Valid until:</b> {exp_str}\n"
        f"🔑 <b>Code:</b> <code>{doc.get('code_preview', 'SEMEX-****')}</code>"
        + stacked_note
        + "\n\n"
        + next_step,
    )
    log.info(
        "bot redeem: user %s redeemed %s → plan=%s until=%s (new_user=%s)",
        tid, doc.get("code_preview"), plan_tag, exp_str, is_new_user,
    )


# ─── PLAN_TAG_BY_DAYS mapping (mirrors admin.py) ──────────────────────────────
_PLAN_TAG_BY_DAYS = {
    1: "TRIAL", 3: "TRIAL", 7: "WEEKLY", 10: "PLUS", 14: "PLUS",
    30: "MONTHLY", 90: "MONTHLY", 180: "MONTHLY", 365: "YEARLY",
}


def _plan_tag_for_days(days: int) -> str:
    if days < 0:
        return "VIP"
    if days >= 365:
        return "YEARLY"
    if days >= 30:
        return "MONTHLY"
    if days >= 7:
        return "WEEKLY"
    return "TRIAL"


async def _cmd_gencode(chat_id: int, from_user_id: int | None, args: list[str]) -> None:
    """Owner-only: generate redeem codes from the bot.

    Usage: /gencode <days> [quantity] [note...]
      days      – plan duration in days; use -1 for lifetime/VIP
      quantity  – 1-20 codes (default 1)
      note      – optional label stored with the codes

    Examples:
      /gencode 30          → 1 × MONTHLY code
      /gencode 7 5         → 5 × WEEKLY codes
      /gencode -1 1 VIP gift → 1 lifetime code with note "VIP gift"
    """
    if from_user_id != settings.ADMIN_TELEGRAM_ID:
        # Silent ignore — don't reveal this command exists to non-owners
        return

    if not args:
        await send_message(
            chat_id,
            "Usage: <code>/gencode &lt;days&gt; [quantity] [note...]</code>\n\n"
            "Examples:\n"
            "• <code>/gencode 30</code> — 1 × MONTHLY (30-day) code\n"
            "• <code>/gencode 7 5</code> — 5 × WEEKLY codes\n"
            "• <code>/gencode 365 1 yearly gift</code> — 1 × YEARLY with note\n"
            "• <code>/gencode -1 1 VIP</code> — 1 lifetime/VIP code\n\n"
            "Supported durations: 1, 3, 7, 14, 30, 90, 180, 365 days or -1 for lifetime.",
        )
        return

    try:
        days = int(args[0])
    except ValueError:
        await send_message(chat_id, "⚠️ First argument must be an integer (days). Use -1 for lifetime.")
        return

    quantity = 1
    if len(args) >= 2:
        try:
            quantity = int(args[1])
        except ValueError:
            # args[1] is probably the start of a note
            note = " ".join(args[1:]).strip() or None
        else:
            note = " ".join(args[2:]).strip() or None
    else:
        note = None

    quantity = max(1, min(quantity, 20))  # cap at 20 via bot
    plan_tag = _plan_tag_for_days(days)

    from db import get_db
    from models import RedeemCode

    db = get_db()
    codes_generated = []
    for _ in range(quantity):
        code = generate_redeem_code("SEMEX")
        doc = RedeemCode(
            code_hash=hash_redeem_code(code),
            code_preview=preview_redeem_code(code),
            duration_days=days,
            plan_tag=plan_tag,
            created_by=from_user_id or chat_id,
            note=note,
        )
        await db.redeem_codes.insert_one(doc.to_mongo())
        codes_generated.append(code)

    duration_str = "Lifetime / VIP" if days < 0 else f"{days} day{'s' if days != 1 else ''}"
    lines = [
        f"✅ <b>Generated {quantity} code{'s' if quantity > 1 else ''}</b>",
        f"🏷 Plan: <b>{plan_tag}</b>  |  ⏱ Duration: <b>{duration_str}</b>",
        (f"📝 Note: <i>{note}</i>" if note else ""),
        "",
    ]
    for c in codes_generated:
        lines.append(f"<code>{c}</code>")
    lines.append("\n<i>Each code is single-use. Send to users via DM — not in groups.</i>")
    await send_message(chat_id, "\n".join(l for l in lines if l != ""))
    log.info("bot gencode: owner generated %d × %s codes (days=%d, note=%r)", quantity, plan_tag, days, note)


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
            "⚠️ <b>No account found.</b>\n\n"
            "Open the SEMEX extension and log in first, then try again.",
        )
        return
    plan = user.get("plan") or "TRIAL"
    exp = user.get("plan_expires_at")
    if exp:
        exp_str = exp.strftime("%Y-%m-%d") if hasattr(exp, "strftime") else str(exp)[:10]
    else:
        exp_str = "—"
    hits = user.get("hit_count", 0)
    charged = user.get("charged_count", 0)
    live = user.get("live_count", 0)
    uname = user.get("telegram_username")
    name_line = f"@{uname}" if uname else f"<code>{tid}</code>"
    requires_redeem = user.get("requires_redeem", False)
    access_line = "🔒 <b>Locked</b> — run /redeem &lt;CODE&gt; to unlock" if requires_redeem else "✅ Active"
    lines = [
        "📊 <b>SEMEX — Account</b>",
        "━━━━━━━━━━━━━━━━━━━━",
        f"👤 {name_line}",
        f"🏷 Plan · <b>{plan}</b>",
        f"📅 Expires · {exp_str}",
        f"🔓 Access · {access_line}",
        "━━━━━━━━━━━━━━━━━━━━",
        f"🎯 Hits · <b>{hits}</b>   ✅ Charged · <b>{charged}</b>   🔥 Live · <b>{live}</b>",
        "━━━━━━━━━━━━━━━━━━━━",
        "<i>/history — view recent charged hits</i>",
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
            {"screenshot_b64": 0},
        )
        .sort("created_at", -1)
        .limit(5)
    )
    hits = []
    async for doc in cursor:
        hits.append(doc)

    if not hits:
        await send_message(
            chat_id,
            "📭 <b>No charged hits yet.</b>\n\nStart hitting and your results will appear here.",
        )
        return

    lines = [f"✅ <b>Last Charged Hits</b>  ({len(hits)} shown)\n━━━━━━━━━━━━━━━━━━━━"]
    for i, h in enumerate(hits, 1):
        card = h.get("card_number") or ""
        masked = ("•" * max(0, len(card) - 4) + card[-4:]) if len(card) >= 4 else "•••"
        gw = h.get("gateway") or h.get("hostname") or "—"
        amt = h.get("amount")
        cur = (h.get("currency") or "").upper()
        amt_str = f"{cur} {amt:.2f}".strip() if amt else "—"
        ts = h.get("created_at")
        date_str = ts.strftime("%Y-%m-%d %H:%M UTC") if ts and hasattr(ts, "strftime") else "—"
        lines.append(
            f"\n<b>{i}.</b> <code>{masked}</code>\n"
            f"   💰 {amt_str}   🌐 {gw}\n"
            f"   🕐 {date_str}"
        )
    lines.append("\n━━━━━━━━━━━━━━━━━━━━")
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
            "📭 <b>No saved BINs yet.</b>\n\n"
            "Add one with <code>/savebin 414720 [label]</code> or use the dashboard BINs tab.",
        )
        return

    lines = [f"💳 <b>Saved BINs</b>  ({len(bins)} shown)\n━━━━━━━━━━━━━━━━━━━━"]
    for b in bins:
        raw_num = b.get("bin") or "—"
        # Mask anything beyond an 8-digit BIN prefix
        display_num = raw_num[:6] + "•" * (len(raw_num) - 6) if len(raw_num) > 8 else raw_num
        label = b.get("label") or ""
        brand = (b.get("brand") or "").upper()
        level = (b.get("level") or "").upper()
        bank = b.get("bank") or ""
        meta_parts = [x for x in [brand, level, bank] if x]
        meta_str = " · ".join(meta_parts[:3])
        label_str = f"  <i>{label}</i>" if label else ""
        meta_line = f"\n     <i>{meta_str}</i>" if meta_str else ""
        lines.append(f"\n• <code>{display_num}</code>{label_str}{meta_line}")

    if len(bins) == 20:
        lines.append("\n━━━━━━━━━━━━━━━━━━━━\n<i>20 most recent shown — open the dashboard to see all.</i>")
    else:
        lines.append("\n━━━━━━━━━━━━━━━━━━━━")
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


async def _dispatch_update(update: dict, wh_secret: str) -> None:
    """Shared update dispatcher — called by both webhook endpoints after secret
    verification. Both the main command bot and the Auto X all-rounder bot route
    through this same logic so users can interact with either bot."""

    # ── Replay dedup ───────────────────────────────────────────────────────
    _update_id = update.get("update_id")
    if _update_id is not None:
        try:
            from db import get_db
            _claimed = await get_db().tg_updates.find_one_and_update(
                {"_id": int(_update_id)},
                {"$setOnInsert": {"seen_at": __import__("time").time()}},
                upsert=True,
                return_document=False,
            )
            if _claimed is not None:
                return  # duplicate delivery/replay — drop
        except Exception as e:
            log.warning("webhook replay-guard failed (processing anyway): %s", e)

    # ── Admin-log failsafe ─────────────────────────────────────────────────
    channel_post = update.get("channel_post") or update.get("edited_channel_post")
    if channel_post:
        if not wh_secret:
            log.warning("channel-post ingest skipped: webhook secret not set (spoofable)")
            return
        try:
            src_chat = (channel_post.get("chat") or {}).get("id")
            if src_chat is not None and int(src_chat) == int(settings.ADMIN_LOG_CHANNEL_ID):
                await _ingest_admin_log_post(channel_post)
        except Exception as e:
            log.warning("admin-log ingest failed: %s", e)
        return

    # ── Inline-button (callback query) ────────────────────────────────────
    callback = update.get("callback_query")
    if callback:
        try:
            await _handle_callback(callback)
        except Exception as e:
            log.exception("callback handling failed: %s", e)
        return

    # ── Telegram Stars: pre-checkout (must answer within 10 s) ────────────
    pcq = update.get("pre_checkout_query")
    if pcq:
        try:
            await _handle_pre_checkout(pcq)
        except Exception as e:
            log.exception("pre-checkout handling failed: %s", e)
        return

    message = update.get("message") or update.get("edited_message") or {}
    text: str = (message.get("text") or "").strip()
    chat = message.get("chat") or {}
    chat_id = chat.get("id")
    if not chat_id:
        return

    # ── Telegram Stars: successful payment → automatic fulfillment ──────────
    if message.get("successful_payment"):
        try:
            await _fulfill_stars_payment(message)
        except Exception as e:
            log.exception("stars fulfillment failed: %s", e)
        return

    # Private-chat gate — commands only in DMs
    if chat.get("type") != "private":
        return

    # ── Proof-of-payment photo intake ─────────────────────────────────────
    photo = message.get("photo")
    if photo:
        proof_entry = await _get_proof_entry(chat_id)
        if proof_entry:
            try:
                await _forward_proof_to_owner(
                    chat_id=chat_id,
                    user_message_id=message.get("message_id"),
                    photo_caption=message.get("caption"),
                )
            except Exception as e:
                log.exception("proof intake failed: %s", e)
            return

    if not text:
        return

    # Strip optional @BotName suffix Telegram appends in groups
    first_token = text.split()[0]
    command = first_token.split("@", 1)[0].lower()
    username = (message.get("from") or {}).get("username")
    from_user_id = (message.get("from") or {}).get("id")

    # Non-command text: auto-detect on-chain TxID for pending wallet payments
    if not command.startswith("/") and from_user_id:
        try:
            from services.txid_verifier import looks_like_txid as _ltxid
            if _ltxid(text.strip()):
                _consumed = await _handle_txid_submission(chat_id, from_user_id, text.strip())
                if _consumed:
                    return
        except Exception as _txe:
            log.exception("txid auto-detect: %s", _txe)

    try:
        if command == "/start":
            _start_args = text.split()[1:]
            if _start_args and _start_args[0].startswith("login_"):
                await _cmd_login_start(chat_id, message.get("from") or {}, _start_args[0])
            else:
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
        elif command in ("/groupstatus", "/gstatus", "/groupsub"):
            await _cmd_groupstatus(chat_id, from_user_id)
        elif command == "/history":
            await _cmd_history(chat_id, from_user_id)
        elif command in ("/bins", "/bin", "/mybins"):
            await _cmd_bins(chat_id, from_user_id)
        elif command in ("/savebin", "/addbin"):
            await _cmd_savebin(chat_id, from_user_id, text.split()[1:])
        elif command in ("/redeem", "/activate", "/code"):
            await _cmd_redeem(chat_id, from_user_id, text.split()[1:], username=username)
        elif command in ("/gencode", "/generatecode", "/makecode"):
            await _cmd_gencode(chat_id, from_user_id, text.split()[1:])
        # Silent no-op for anything else
    except Exception as e:
        log.exception("bot command %s failed: %s", command, e)
        try:
            await send_message(chat_id, "⚠️ Something went wrong. Please try again.")
        except Exception:
            pass


@router.post("/webhook")
async def telegram_webhook(request: Request):
    """Receives Telegram Bot API updates. Dispatches slash-commands.

    Register once:
        POST https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook
             ?url=https://<host>/api/telegram/webhook
             &secret_token=<TELEGRAM_WEBHOOK_SECRET>

    We always return {"ok": True} so Telegram doesn't retry.
    """
    _wh_secret = (getattr(settings, "TELEGRAM_WEBHOOK_SECRET", "") or "").strip()
    _sent = (request.headers.get("x-telegram-bot-api-secret-token") or "").strip()
    if _wh_secret:
        # Secret is configured — enforce it strictly. Reject anything that
        # doesn't match (wrong value, missing header, replay attempt).
        if _sent != _wh_secret:
            log.warning("webhook: rejected — bad or missing secret token")
            return {"ok": True}
    elif _sent:
        # No secret configured but caller sent a token — likely a forged/replay
        # attempt probing this endpoint. Silently ignore without processing.
        log.warning(
            "webhook: rejected — caller sent a secret token but TELEGRAM_WEBHOOK_SECRET "
            "is not configured; set it and re-run setWebhook with secret_token."
        )
        return {"ok": True}
    else:
        # No secret configured AND no token in the request — log a per-request
        # warning so the operator sees the exposure in deployment logs.
        log.warning(
            "webhook: processing unauthenticated request — "
            "set TELEGRAM_WEBHOOK_SECRET and re-run setWebhook to harden this endpoint."
        )
    try:
        update = await request.json()
    except Exception as e:
        log.warning("webhook received non-json body: %s", e)
        return {"ok": True}
    await _dispatch_update(update, _wh_secret)
    return {"ok": True}


@router.post("/cryptobot_webhook")
async def cryptobot_webhook(request: Request):
    """Receives payment confirmation webhooks from @CryptoBot (Crypto Pay API).

    Register with:
      POST https://pay.crypt.bot/api/setWebhook
      Header: Crypto-Pay-API-Token: <CRYPTO_BOT_TOKEN>
      Body: {"url": "https://<host>/api/telegram/cryptobot_webhook"}

    This happens automatically on server startup when CRYPTO_BOT_TOKEN is set.
    """
    import asyncio as _asyncio
    from services.cryptobot import verify_signature as _cb_verify
    body = await request.body()
    sig = request.headers.get("crypto-pay-api-signature", "")
    if not _cb_verify(body, sig):
        log.warning("cryptobot_webhook: invalid signature — ignoring")
        return {"ok": True}   # always 200 so CryptoBot doesn't retry
    try:
        data = await request.json()
    except Exception:
        return {"ok": True}

    if data.get("update_type") == "invoice_paid":
        invoice = (data.get("payload") or {})
        our_payload = invoice.get("payload", "")
        try:
            product, tid_str = our_payload.rsplit(":", 1)
            telegram_id = int(tid_str)
        except (ValueError, AttributeError):
            log.warning("cryptobot_webhook: unrecognised payload %r", our_payload)
            return {"ok": True}
        invoice_id = str(invoice.get("invoice_id", ""))
        _asyncio.create_task(_fulfill_cryptobot_payment(telegram_id, product, invoice_id))
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
