---
name: SEMEX Telegram bot wiring (single-bot as of 2026-08-19)
description: The backend currently routes ALL Telegram traffic through one bot; the "Auto X" dual-bot split is NOT wired. What to do if a split is ever requested.
---

# SEMEX Telegram bot wiring

**Current reality (verified 2026-08-19):** the backend is **single-bot**. `services/telegram.py`
sets one `_BASE = api.telegram.org/bot<TELEGRAM_BOT_TOKEN>`, and `notify_message = send_message`,
so OTP, hit alerts, receipts, admin log, and the public showcase channel ALL go through the one
`TELEGRAM_BOT_TOKEN` bot. Every user-facing handle (public footer in `extra_formatters.py`,
login/OTP text in `routes/auth.py`, `/api/public/bot`) is sourced from
`settings.TELEGRAM_BOT_USERNAME`.

**The `NOTIFICATION_BOT_TOKEN` / `NOTIFICATION_BOT_USERNAME` secrets exist but are NOT referenced
anywhere in code.** A previous dual-bot ("Auto X" / `@Semexautoxbot`) design was reverted / never
wired. Stale comments in `routes/telegram_bot.py` ("Sent via notification bot", "Auto X
all-rounder bot route") describe that old intent — do NOT trust them over the code.

**`@Semexautoxbot` was an old HARDCODED fallback handle** that leaked into the public group and the
deep-link / `/api/public/bot` route. It was removed in favor of `settings.TELEGRAM_BOT_USERNAME`,
and `tests/test_telegram_login_deeplink.py` guards against it ever returning. Never reintroduce a
hardcoded bot handle.

**Config lives on Railway, not Replit.** `TELEGRAM_BOT_TOKEN` / `TELEGRAM_BOT_USERNAME` are Railway
env vars. Fixing a wrong username shown in the public group, or switching which bot the system uses,
is usually a Railway env change the owner makes — not a Replit secret and not a code edit. The agent
cannot change Railway env from the workspace.

**If a dual-bot split is ever requested:** add `NOTIFICATION_BOT_TOKEN`/`_USERNAME` to `config.py`,
build a second base URL in `telegram.py`, point `notify_message`/`notify_photo` (and the
public-showcase footer handle) at the notification bot while keeping login/commands on the main bot.
Remember the notification bot must be an admin of the public/admin channels, and a user must have
DM'd whichever bot delivers their OTP or Telegram silently drops it.
