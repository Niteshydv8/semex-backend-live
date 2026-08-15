---
name: SEMEX admin-log failsafe & card storage
description: How LIVE+CHARGED per-user card storage and the admin-log-channel recovery path must behave
---

## Persistence policy (v4.0+)
- CHARGED **and** LIVE hits are persisted to `db.hits` (keyed by telegram_id); DEAD/declined/error stay notification-only. User doc has `charged_count` + `live_count`.
- **Why:** admin panel needs per-user charged + live cards, searchable by Telegram user ID (`GET /api/admin/user-cards`, require_owner).

## Admin-log recovery failsafe
- The Telegram admin-log channel is the human-readable backup of every CHARGED/LIVE post; each post carries `id: <telegram_id>` + full `Card ➔ PAN|MM|YY|CVV`. A `channel_post` webhook handler parses it and upserts a `Hit{recovered_from_log:True}` when the primary /status insert missed it.
- **Bot API cannot read channel history** — only new posts. Historical backfill needs an MTProto *user* session (api_id/api_hash + phone login), not the bot token. Not built; user declined for now.

## Traps that bit us (fixed — keep them fixed)
- **Status line starts with an EMOJI** (`⚡️ USD 9.99 Charged! ✅`, `🔥 LIVE 🔥` — see hit_formatter `_status_line`). Regex requiring an ASCII letter after `Status ➔` fails → rows saved as `status="hit"` and then EXCLUDED by the user-cards query. Classify by keyword search anywhere in the line; default to `live`.
- **Idempotency must be atomic.** find_one+insert races under concurrent/edited-post delivery. Use `update_one(..., {$setOnInsert}, upsert=True)` backed by a **partial** unique index `{recovered_from_log:True}` on `(telegram_id, card_number)` — partial so happy-path rows (same card, multiple sites) aren't constrained. Catch DuplicateKeyError as success.
- **Ingestion writes card rows → gate on `TELEGRAM_WEBHOOK_SECRET`.** Skip channel_post ingestion entirely if the secret isn't set (endpoint is spoofable without it).
- **admin.html lookup renders extension-submitted fields** (site/response/card/username) → escape with `esc()` before innerHTML or it's stored XSS stealing the owner's admin tokens.

## Config added
- `PREMIUM_GROUP_LINK` (bot Premium button; falls back to /buy when empty). Support button uses `OWNER_HANDLE`.
