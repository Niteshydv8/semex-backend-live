"""Additional formatters for public showcase (masked) and receipt/invoice."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from config import settings
from services.hit_formatter import clean_response


def _mask_card(number: Optional[str]) -> str:
    if not number:
        return "•••• •••• •••• ••••"
    n = "".join(c for c in number if c.isdigit())
    if len(n) < 8:
        return "•••• •••• •••• ••••"
    return f"{n[:4]} •••• •••• {n[-4:]}"


def format_public_showcase(hit: dict, user: dict) -> str:
    """Public showcase message — SEMEX '/hit' style for the public group.
    Shows: gateway header, user, status, amount, response, merchant. NO card/email/BIN.
    """
    import html

    def e(v):
        return html.escape(str(v))

    username = user.get("telegram_username")
    first = user.get("telegram_first_name") or ""
    tid = user.get("telegram_id")
    display = username or first or "anon"
    # Clickable name → opens the hitter's Telegram profile.
    if username:
        user_html = f'<a href="https://t.me/{e(username)}">{e(display)}</a>'
    elif tid:
        user_html = f'<a href="tg://user?id={e(tid)}">{e(display)}</a>'
    else:
        user_html = f"<b>{e(display)}</b>"

    status_raw = (hit.get("status") or "").lower()
    is_charged = status_raw in ("charged", "success", "approved", "succeeded", "captured")
    is_live = status_raw in ("live", "ccn_live", "3d_live")
    if is_charged:
        status = "CHARGED ✅"
    elif is_live:
        status = "LIVE 🔥"
    elif status_raw in ("declined", "dead", "decline", "ccn_dead"):
        status = "DEAD ❌"
    else:
        status = (hit.get("status") or "HIT").upper().replace("_", " ")

    gateway = (hit.get("gateway") or "").replace("_", " ").strip()
    gw_head = (gateway.split()[0].upper() if gateway else "CARD")

    amount = hit.get("amount")
    currency = (hit.get("currency") or "USD").upper()
    if isinstance(amount, (int, float)):
        amount_line = f"{currency} {amount:,.2f}"
    elif amount:
        amount_line = f"{currency} {amount}"
    else:
        amount_line = "—"

    # Friendly response: charged -> "Payment successful"; otherwise the real decline
    # reason (Incorrect CVC / Insufficient funds / ...).
    if is_charged:
        response = "Payment successful"
    else:
        response = clean_response(hit.get("response") or hit.get("decline_reason") or hit.get("decline_code"))

    # NOTE: IP is INTENTIONALLY NOT shown in the public showcase (owner's rule).
    # The IP still appears in the owner/admin DM template (format_hit) for auditing.

    # Footer handle follows the CONFIGURED bot (settings.TELEGRAM_BOT_USERNAME) —
    # exactly like every other user-facing handle in the app — never a hardcoded
    # bot. A stale/old bot handle used to be baked in here and leaked into the
    # public group; if no username is configured we now omit the handle line
    # entirely instead of advertising the wrong bot.
    bot_handle = (settings.TELEGRAM_BOT_USERNAME or "").lstrip("@").strip()
    footer = "⚡️ 𝗕𝗼𝘁 𝗯𝘆 𝗡𝗲𝗽𝗮𝗹𝗶 𝗕𝗵𝗮𝗶 ⚡️"
    if bot_handle:
        footer += f"\n「 @{e(bot_handle)} 」"

    return (
        f"「 <b>{e(gw_head)} HITTER</b> 」\n"
        f"\n"
        f"User ❝ {user_html}\n"
        f"Status ❝ <b>{e(status)}</b>\n"
        f"Amount ❝ {e(amount_line)}\n"
        f"Response ❝ {e(response)}\n"
        f"\n"
        f"{footer}"
    )


def _esc(v) -> str:
    """HTML-escape a dynamic value for Telegram's HTML parse mode."""
    import html
    return html.escape(str(v), quote=False)


def format_purchase_receipt(user: dict, plan_tag: str, duration_days: int, expires_at, code_preview: str) -> str:
    """Sent to the user when they redeem a code — like a purchase confirmation."""
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    # Escape user/plan/code data: a handle or plan containing &, < or > would
    # make Telegram 400-reject the whole receipt message.
    handle = _esc(user.get("telegram_username") or user.get("telegram_first_name") or "user")
    plan_tag = _esc(plan_tag)
    code_preview = _esc(code_preview)
    if duration_days < 0:
        duration_str = "LIFETIME ♾️"
    elif duration_days == 1:
        duration_str = "1 day"
    else:
        duration_str = f"{duration_days} days"
    expires_str = "Never" if not expires_at else expires_at.strftime("%Y-%m-%d %H:%M UTC")

    return (
        f"🎉 <b>Plan Activated!</b>\n\n"
        f"Hey <b>@{handle}</b>, your access is now live.\n\n"
        f"<pre>"
        f"╔═════════════════════════════════╗\n"
        f"║      SEMEX · PLAN RECEIPT       ║\n"
        f"╠═════════════════════════════════╣\n"
        f"  Purchased:  {now}\n"
        f"  Plan:       {plan_tag}\n"
        f"  Duration:   {duration_str}\n"
        f"  Expires:    {expires_str}\n"
        f"  Code used:  {code_preview}\n"
        f"╚═════════════════════════════════╝"
        f"</pre>\n\n"
        f"Open the extension and start hitting. ⚡\n"
        f"Need help? Contact <b>@CARAXSS</b>"
    )


def format_expiry_alert(user: dict, hours_left: int) -> str:
    handle = _esc(user.get("telegram_username") or user.get("telegram_first_name") or "there")
    plan = _esc(user.get("plan", "TRIAL"))
    hrs = "hour" if hours_left == 1 else "hours"
    return (
        f"⏰ <b>SEMEX Access Expiring Soon</b>\n\n"
        f"Hey @{handle}, your <b>{plan}</b> access expires in "
        f"<b>{hours_left} {hrs}</b>.\n\n"
        f"Redeem a new code in the extension to keep going.\n"
        f"Contact admin for codes: @CARAXSS"
    )


def format_expired(user: dict) -> str:
    handle = _esc(user.get("telegram_username") or user.get("telegram_first_name") or "there")
    return (
        f"🔒 <b>SEMEX Access Expired</b>\n\n"
        f"Your access has ended, @{handle}.\n"
        f"Redeem a code in the extension to renew.\n"
        f"Contact admin: @CARAXSS"
    )
