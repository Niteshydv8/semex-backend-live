---
name: SEMEX dual-bot split
description: Main bot handles commands/login/webhook; Auto X bot (NOTIFICATION_BOT_TOKEN) sends all proactive notifications.
---

# SEMEX Dual-Bot Architecture

## The rule
- **Main bot** (`TELEGRAM_BOT_TOKEN`): webhook receiver, all interactive command replies (`send_message` in telegram_bot.py handlers), invoice, callback answers, login flow, `copy_message` for proof forwarding.
- **Auto X / notification bot** (`NOTIFICATION_BOT_TOKEN`): all proactive outbound messages — hit alerts, screenshots, OTP codes, welcome messages, Stars payment receipts, owner hit notifications. Uses `notify_message()` / `notify_photo()` from `services/telegram.py`.

## Implementation
- `services/telegram.py`: `_raw_post(base_url, ...)` is the shared core. `_post()` wraps it with `_BASE` (main). `_notify_post()` wraps it with `_get_notify_base()` (Auto X or fallback to main). `notify_message()` and `notify_photo()` are the public API for the notification bot, with the same HTML-error plaintext fallback as `send_message`/`send_photo`.
- `services/telegram_outbox.py`: imports `notify_message`, `notify_photo` — all outbox deliveries go through Auto X bot.
- `send_otp()` and `send_welcome()` call `notify_message()`.
- `_fulfill_stars_payment()` in `telegram_bot.py`: user receipts and owner alerts call `notify_message()`.

## Fallback
When `NOTIFICATION_BOT_TOKEN` is empty/unset, `_get_notify_base()` returns `_BASE` (main bot URL). Everything still works — messages just come from the main bot. No code change needed to activate the split once the secret is set.

## Why
Owner wants users to receive hit alerts, OTPs, and payment confirmations from a dedicated "SemEx Auto X" bot, separate from the command bot they interact with.

## Auto X webhook registration (owner must do this once)
```
POST https://api.telegram.org/bot<NOTIFICATION_BOT_TOKEN>/setWebhook
     ?url=https://<host>/api/telegram/webhook/autobot
     &secret_token=<TELEGRAM_WEBHOOK_SECRET>
```
Uses NOTIFICATION_BOT_WEBHOOK_SECRET if set, else falls back to TELEGRAM_WEBHOOK_SECRET.

## Login deep-link routing
`/api/public/bot` and `/api/public/version` now return `botUsername = NOTIFICATION_BOT_USERNAME` (when set) instead of the main bot. Extension builds `t.me/<botUsername>?start=login_<token>` — opens Auto X bot → `/webhook/autobot` → `_cmd_login_start()`. Extension hardcoded fallback is already `"Semexautoxbot"`.

## User requirement: users must /start both bots
Auto X bot can only DM a user if they've started it first. Owner must instruct users to `/start` the Auto X bot to receive notifications and to use it for login.
