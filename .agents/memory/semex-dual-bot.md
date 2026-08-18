---
name: SEMEX single-bot — dual-bot was removed
description: Dual-bot split was built then reverted. One bot (TELEGRAM_BOT_TOKEN) handles everything.
---

# SEMEX Single-Bot Architecture (dual-bot removed)

## Current state — ONE bot does everything
`TELEGRAM_BOT_TOKEN` is the only bot. It handles commands, login deep-links, OTP, hit alerts, Stars payments, proof photos — everything.

`notify_message` = alias for `send_message`. `notify_photo` delegates to `send_photo`. No separate token or webhook.

## Login deep-link
`/api/public/bot` and `/api/public/version` return `settings.TELEGRAM_BOT_USERNAME` directly. Extension builds `t.me/<TELEGRAM_BOT_USERNAME>?start=login_<token>`. This must match the bot whose webhook is registered at `/api/telegram/webhook`.

## Why dual-bot was removed
Owner confirmed one bot handles everything. The split was causing the login deep-link to open the wrong bot (extension has "Semexautoxbot" hardcoded as fallback, which was a different bot from TELEGRAM_BOT_TOKEN).
