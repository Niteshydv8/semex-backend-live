---
name: SEMEX Telegram silent notification failures
description: Why hit notifications silently disappear and the defense-in-depth fix.
---

## Rule
Always add an HTML→plaintext retry in `send_message` and `send_photo`. Never let a Telegram 400 silently kill a notification.

## Why
`submit_status` always returns `{"success": True, "forwarded": True}` even when the Telegram send fails. The extension therefore shows "saved & notified" in the dashboard even when nothing arrives. Root causes observed:
1. `_mask_success_url` producing an `<a href>` tag — URL escaping bugs cause malformed HTML → Telegram 400-rejects the whole message
2. `_post()` was returning `None` on non-200, losing the error description → made it return the parsed JSON regardless of status code so callers can inspect `ok`/`error_code`/`description`
3. Any field value with unescaped HTML chars in the formatted hit text → Telegram 400

## How to apply
`telegram.py` now has:
- `_is_html_parse_error(res)` — returns True when Telegram error_code==400 and description contains "parse"
- `_strip_html(text)` — strips all HTML tags and unescapes entities
- `send_message`: retry 1 = drop custom_emoji entities; retry 2 = if HTML parse error, strip tags and resend as plaintext
- `send_photo`: same retry ladder for caption

`hit_formatter.py` `_mask_success_url` returns PLAIN TEXT only (no `<a href>`). Stripe success URLs have 500+ char query strings; any HTML attribute escaping of them risks malformed markup.

## Diagnostic tool
`POST /api/admin/debug-last-hit` (owner-only) replays the last charged hit from DB, formats it, sends to owner DM, and returns the full Telegram API response + formatted text preview. Use this to diagnose any future "saved but no notification" reports.
