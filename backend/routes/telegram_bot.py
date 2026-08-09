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
from pathlib import Path

from fastapi import APIRouter, Request

from config import settings
from services.telegram import copy_message, send_document, send_message

log = logging.getLogger("semex.bot")

router = APIRouter(prefix="/api/telegram", tags=["telegram-bot"])


EXTENSION_ZIP_CANDIDATES = [
    "/app/semex-v2.2.0.zip",
    "/app/semex.zip",
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
    for p in Path("/app").glob("semex*.zip"):
        if p.stat().st_size > 0:
            return p
    return None


async def _cmd_buy(chat_id: int, username: str | None) -> None:
    """Show plan details + USDT payment addresses on BEP20 / TRC20 / TON.
    Owner confirms manually via /paid proof-of-payment flow (see _cmd_paid)."""
    owner_handle = (settings.OWNER_HANDLE or settings.TELEGRAM_BOT_USERNAME or "SemexBot").replace("@", "")
    price_monthly = getattr(settings, "PLAN_PRICE_MONTHLY", None) or "$15"
    price_yearly = getattr(settings, "PLAN_PRICE_YEARLY", None) or "$120"
    price_lifetime = getattr(settings, "PLAN_PRICE_LIFETIME", None) or "$250"
    # USDT payment addresses (all USDT, three networks — pick lowest fee)
    usdt_bep20 = getattr(settings, "PAYMENT_USDT_BEP20", "") or "0xb1ab479abe81d6be059d5bb9d55a6e8d99b64bfd"
    usdt_trc20 = getattr(settings, "PAYMENT_USDT_TRC20", "") or "TCn8eNownsyUzMeHNMeUpzXJFDruCWYr5w"
    usdt_ton = getattr(settings, "PAYMENT_USDT_TON", "") or "UQAmwQDBLUHsSZI3SiKTDwSnvte-Y8MkwoDvzHzOGa-3xk68"

    name_line = f" @{username}" if username else ""
    lines = [
        f"<b>💎 SEMEX Premium Plans</b>{name_line}",
        "",
        "<b>📦 Plans:</b>",
        f"• <b>MONTHLY</b> — {price_monthly} / 30 days",
        f"• <b>YEARLY</b>  — {price_yearly} / 365 days",
        f"• <b>LIFETIME</b> — {price_lifetime} one-time",
        "",
        "<b>🔓 Premium unlocks:</b>",
        "• 3DS Bypass (Stripe)",
        "• Full-quality screenshots on every CHARGED",
        "• Extended history retention",
        "• Priority support",
        "",
        "<b>💵 Payment — USDT (all networks):</b>",
        "",
        "✅ <b>BEP20</b> (BNB Smart Chain)",
        f"<code>{usdt_bep20}</code>",
        "",
        "🪙 <b>TRC20</b> (Tron)",
        f"<code>{usdt_trc20}</code>",
        "",
        "🪙 <b>TON</b> (The Open Network)",
        f"<code>{usdt_ton}</code>",
        "",
        f"<b>➡️ How to buy:</b>",
        f"1. Send USDT to any address above (BEP20 recommended — lowest fee)",
        f"2. Screenshot the transaction (must show <b>amount + tx hash</b>)",
        f"3. Run <code>/paid</code> in this chat, then reply with your screenshot",
        f"4. Owner @{owner_handle} verifies + activates your plan (usually within a few hours)",
        "",
        "<i>All tap-to-copy addresses — hold on mobile to copy.</i>",
    ]
    await send_message(chat_id, "\n".join(lines))


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
        f"• Open the admin panel → find user <code>{tid}</code> → click <b>Extend</b>\n"
        f"• DM the user @{handle} to confirm activation"
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


async def _cmd_start(chat_id: int, username: str | None) -> None:
    name = f"@{username}" if username else "there"
    text = (
        f"<b>👋 Welcome to SEMEX, {name}!</b>\n\n"
        "SEMEX is a Chrome extension that streamlines checkout automation.\n\n"
        "<b>Getting started:</b>\n"
        "1. /get — download the extension .zip\n"
        "2. Unzip it, then open <code>chrome://extensions</code>\n"
        "3. Enable <b>Developer mode</b> (top-right toggle)\n"
        "4. Click <b>Load unpacked</b> and select the folder\n"
        "5. Click the SEMEX icon and log in via the OTP shown here\n\n"
        "💎 <b>Want Premium?</b> Type /buy to see plans (unlocks 3DS Bypass + more).\n\n"
        "Type /help for the command list."
    )
    await send_message(chat_id, text)


async def _cmd_help(chat_id: int) -> None:
    text = (
        "<b>🛠 SEMEX Bot Commands</b>\n\n"
        "<b>📊 Your account:</b>\n"
        "/status – plan, expiry & hit counters\n"
        "/history – last 5 charged hits\n"
        "/bins – your saved BINs\n\n"
        "<b>🚀 Getting started:</b>\n"
        "/start – onboarding\n"
        "/get – download the extension .zip\n"
        "/buy – premium plans + USDT payment addresses\n"
        "/paid – submit proof-of-payment screenshot\n"
        "/cancel – cancel a pending /paid submission\n"
        "/help – this message\n\n"
        "Any issues? Message the owner directly."
    )
    await send_message(chat_id, text)


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

    message = update.get("message") or update.get("edited_message") or {}
    text: str = (message.get("text") or "").strip()
    chat = message.get("chat") or {}
    chat_id = chat.get("id")
    if not chat_id:
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
            await _cmd_start(chat_id, username)
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
        elif command in ("/status", "/stats", "/me", "/plan"):
            # Only respond in private chats (chat_id == from_user_id in Telegram DMs).
            # This prevents forged webhook POSTs from leaking account data to a
            # different chat by faking the from.id field.
            if from_user_id and chat_id != from_user_id:
                await send_message(chat_id, "⚠️ /status is only available in private chats with the bot.")
            else:
                await _cmd_status(chat_id, from_user_id)
        elif command == "/history":
            if from_user_id and chat_id != from_user_id:
                await send_message(chat_id, "⚠️ /history is only available in private chats with the bot.")
            else:
                await _cmd_history(chat_id, from_user_id)
        elif command in ("/bins", "/bin", "/mybins"):
            if from_user_id and chat_id != from_user_id:
                await send_message(chat_id, "⚠️ /bins is only available in private chats with the bot.")
            else:
                await _cmd_bins(chat_id, from_user_id)
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
