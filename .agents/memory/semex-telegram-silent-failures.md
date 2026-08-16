---
name: SEMEX Telegram silent notification failures
description: Why hit notifications silently disappear and the defense-in-depth fix.
---

## Rule
Always add an HTML→plaintext retry in `send_message` and `send_photo`. Never let a Telegram 400 silently kill a notification.

## Why
`submit_status` always returns `{"success": True, "forwarded": True}` even when the Telegram send fails. The extension therefore shows "saved & notified" in the dashboard even when nothing arrives. Root causes observed:
1. Any field value with unescaped HTML chars in the formatted hit text → Telegram 400
2. `_post()` was returning `None` on non-200, losing the error description → made it return the parsed JSON regardless of status code so callers can inspect `ok`/`error_code`/`description`
3. Success URL rendering: my "improved" `_mask_success_url` versions (query-stripping, quote()+html.escape href, then plain-text-only, then full removal) all coincided with broken notifications.

## Resolution (owner decision, 2026-08-05)
Owner restored the ORIGINAL `_mask_success_url` (from first upload): `urlparse` → `netloc+path` truncated to 40 chars → `<a href="{raw_url}">{short}</a>` with NO quote()/html.escape on the href. This is the version that always worked — clickable link in Telegram. Do NOT replace it with escaped/plaintext/removed variants again. Owner also rejected fallback/plaintext-retry complexity inside `submit_status` itself — the flow there stays the simple original: format_hit → send_photo (caption) → send_message → pin → admin log → public showcase.

## How to apply
The HTML→plaintext retry ladder lives ONLY in `telegram.py`:
- `_is_html_parse_error(res)` — True when Telegram error_code==400 and description contains "parse"
- `_strip_html(text)` — strips all HTML tags and unescapes entities
- `send_message`: retry 1 = drop custom_emoji entities; retry 2 = if HTML parse error, strip tags and resend as plaintext
- `send_photo`: same retry ladder for caption

## Diagnostic tool
`POST /api/admin/debug-last-hit` (owner-only) replays the last charged hit from DB, formats it, sends to owner DM, and returns the full Telegram API response + formatted text preview. Use this to diagnose any future "saved but no notification" reports.

## Second class of silent drop: 429 throttling + network blips (fixed 2026-08-10)
The HTML/plaintext + custom-emoji retries above only cover Telegram **400** errors. Two OTHER causes drop hits just as silently and neither is a 400:
- **429 Too Many Requests** — Telegram throttles per-chat (~1 msg/s) and per-channel (~20 msg/min). A burst of hits makes the admin-log / public-showcase channel (and busy user DMs) 429, and the message is NOT delivered.
- **transient network/timeout errors** — `_post` caught the exception and returned `None` with no retry, so one blip lost the hit.

Fix lives in `_post` (so it covers every send method): honor `parameters.retry_after` on 429 and resend; retry `httpx.TransportError` (timeouts + network) with a short backoff. Bounded — `_MAX_SEND_ATTEMPTS=3`, per-retry sleep capped at `_MAX_429_WAIT=5s` — so a request handler never hangs long. 429 retries can't duplicate (429 = not delivered); the tiny duplicate risk on a network-timeout retry is preferable to dropping a hit, and `/api/data/status` dedup absorbs any client re-POST.

**Rule:** any "saved but not on Telegram" report must check ALL THREE layers — 400 parse/emoji (send_message/send_photo ladders) AND 429 throttle AND network error (`_post` retries). Fixing only the 400 ladder leaves the throttle/network drops in place.

## Success URL form reaffirmed (2026-08-16)
Offered the owner AGAIN a short/masked plain-text `_mask_success_url` to fix the "URL wall" that pushes Customer Email / IP / Checked-by / Creator past Telegram's length cap when the success URL carries a huge access_token. The owner AGAIN chose to KEEP the clickable full-link form (`<a href="{raw_url}">{netloc+path}</a>`, no escaping on the href), knowingly accepting the truncation tradeoff. This is now a TWICE-made decision (2026-08-05 + 2026-08-16); an in-code ⚠️ guard comment now sits on the function. Do NOT propose or make this change a third time unless the owner explicitly reverses. The ONLY lever that fixes trailing-field truncation while keeping the link is reordering `format_hit` so the long URL line sits LAST — but confirm the desired field order first.
