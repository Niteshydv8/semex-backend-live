---
name: SEMEX Telegram deep-link login architecture
description: Login moved to bot-authorize deep links (v4.1.0); popup can't poll — the background SW owns the flow; new accounts are redeem-locked
---

SEMEX login is Telegram deep-link authorize (added in v4.1.0), replacing the Telegram-ID + OTP UI entirely (backend OTP endpoints kept for compat).

**Flow:** popup button → `SEMEX_TELEGRAM_LOGIN` to background → `POST /api/auth/telegram-login/start` mints a 5-min `login_<token>` → background opens `t.me/<bot>?start=<token>` and polls `/telegram-login/status` every 2s → bot binds the token to the FIRST Telegram account that opens the link (hijack guard) and sends an Authorize/Deny card with IP/location/device → on Authorize the bot mints the session and parks the auth payload on the token doc → background stores tokens + fires a chrome notification.

**Why:**
- **The popup dies the instant the Telegram tab opens** — any login polling in popup.js is silently killed. All polling MUST live in the background service worker. Poll loop pings `chrome.storage.session` each iteration as MV3 keepalive + cancel check (same keepalive lesson as the screenshot path).
- Shared session issuance lives in `backend/services/sessions.py` (`issue_session`) — used by BOTH verify-otp and the bot authorize path so device-limit/minting logic can't drift.
- New accounts created via Telegram authorize get `requires_redeem=True` (locked until invite-code redeem; owner decision). `hasAccess`/`requiresRedeem` in session/verify responses are data-driven from this flag — do NOT re-hardcode them to free-access.

**How to apply:** any future login/auth change must touch both `auth.py` and `telegram_bot.py` paths; gate locked users via `requiresRedeem` in `checkLoginStatus` (popup shows the redeem step), never via OTP remnants.
