---
name: SEMEX Telegram bot switch procedure
description: How to move the whole extension to a different Telegram bot — one token drives everything; it's a Railway env change plus webhook + channel-admin + user /start, not a code edit
---

SEMEX uses ONE Telegram bot for everything: login deep-link, `/get` download, `/buy`, hits notifications, admin log, public showcase, and all commands. It is driven by a single pair of env vars read in `backend/config.py`: `TELEGRAM_BOT_TOKEN` + `TELEGRAM_BOT_USERNAME`. No token is hardcoded anywhere; there is NO separate log/admin bot.

The backend runs on **Railway**, so these are **Railway env vars**. The agent CANNOT change the live bot: it has no Railway access, and a Replit secret / rebuild / git push does not touch Railway env. Setting the token as a Replit secret is useless for the live backend (only a backend running inside the Repl would read `os.environ`). So never `requestSecrets` for this — direct the owner to Railway.

**Full switch checklist (owner does all of it):**
1. Railway → Variables: `TELEGRAM_BOT_TOKEN` = new bot token, `TELEGRAM_BOT_USERNAME` = new handle (no @). Redeploy.
2. Re-register the webhook for the NEW token — the backend does NOT auto-set it on startup (server.py `lifespan` doesn't; only the manual path in the `/webhook` docstring exists). Open once:
   `https://api.telegram.org/bot<NEW_TOKEN>/setWebhook?url=https://api.semxhitter.pw/api/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>`
   Without this the new bot receives NO updates → `/start`, `/get`, `/buy`, and the login **Authorize** button all break (authorize is a webhook callback).
3. Make the new bot an ADMIN of both channels or posts fail: `ADMIN_LOG_CHANNEL_ID` (hits + admin log) and `PUBLIC_SHOWCASE_CHANNEL_ID` (showcase).
4. Existing users must `/start` the NEW bot once — Telegram forbids a bot DMing a user who never started it, so login DMs / broadcasts / notifications won't arrive until they do.

**Verify after:** `GET /api/public/bot` and `POST /api/auth/telegram-login/start` should both report the new `botUsername`/`deepLink`. As of 2026-08-18 both still returned the OLD bot `SEMEXHITSBOT` — the switch had not been applied.

**Note:** live `BASE_URL` is empty on Railway (`/api/public/version` returns a RELATIVE downloadUrl), so in-message links are relative; set `BASE_URL=https://api.semxhitter.pw` if clickable links are wanted.

**Optional automation (not done — offer only):** add setWebhook to server.py `lifespan` so a redeploy auto-registers the webhook — but needs a reliable `BASE_URL`/`WEBHOOK_URL` env first.

## Never hardcode a bot handle in message templates
The public showcase footer (`services/extra_formatters.format_public_showcase`) once hardcoded `@SEMEXHITSBOT`, so every hit posted to the public group advertised the OLD bot even after the owner "switched" bots. **Why:** which bot is live is a Railway-env decision (`TELEGRAM_BOT_TOKEN`/`TELEGRAM_BOT_USERNAME`), and all sends go through the single configured bot (`notify_message = send_message`). **How to apply:** every user-facing handle must derive from `settings.TELEGRAM_BOT_USERNAME` (omit the line if empty) — never bake a literal `@SomeBot` into templates, or it silently leaks a stale bot the code push can't fix.
