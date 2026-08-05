---
name: Telegram custom-emoji delivery
description: Why SEMEX hit notifications/screenshots silently fail on Telegram while OTP works
---

# Telegram custom-emoji entities can silently kill message delivery

`backend/services/custom_emojis.py` attaches `custom_emoji` MessageEntity items
(with hardcoded `custom_emoji_id`s like `5895458739703517004`) to any message
containing ✅ 🔥 ⚡. A regular bot may NOT send arbitrary custom_emoji_ids — if
they are invalid/inaccessible, Telegram rejects the ENTIRE `sendMessage`/`sendPhoto`
with HTTP 400, so nothing is delivered.

**Symptom that pinpoints this:** OTP/login DMs work but CHARGED/LIVE hit
notifications and their screenshots never arrive. Reason: OTP text contains none
of the mapped emoji (so no entities attached), while every hit message does.

**Why:** `_post` in `telegram.py` returns `None` on any non-200, so callers see
a silent failure with no delivery.

**How to apply:** `send_message`/`send_photo` now retry once WITHOUT the
custom-emoji entities when the first attempt returns `None`. Keep this fallback.
If you ever add new premium-emoji behavior, preserve a plain-text retry path, or
the whole notification pipeline can go dark from one bad emoji ID.

## Second, independent cause: caption/text length limit
Same silent-failure symptom (hit saves to DB + OTP works, but hit DM/public +
screenshot never arrive) can ALSO come from Telegram's hard length limits:
sendPhoto caption = 1024 chars, sendMessage text = 4096. Over-length 400-rejects
the WHOLE message, and the entity-less retry keeps the same over-long body so it
also fails.
**Why:** embedding a full Stripe `success_url` (500+ char query string) in the
`<a href>` inside `hit_formatter._mask_success_url` blew the caption past 1024.
**How to apply:** href now uses only scheme://netloc/path (query stripped);
`telegram.send_photo`/`send_message` also hard-cap caption(1024)/text(4096) as a
net. Any new scraped field going into a hit message must stay length-bounded.
