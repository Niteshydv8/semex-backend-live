---
name: SEMEX backend security baseline
description: CORS configuration rules, webhook secret enforcement, and rate limits added for the authenticated API routes.
---

# SEMEX Backend Security Baseline

## CORS (backend/server.py)
`allow_credentials=True` is **incompatible** with `allow_origins=["*"]`. The code now sets `_allow_credentials = origins != ["*"]` so credentials are only sent when `CORS_ORIGINS` is an explicit comma-separated list in the env var.

**Why:** Starlette/browsers reject `credentials + wildcard` silently; it violates the CORS spec and would expose authenticated endpoints to arbitrary origins.

**How to apply:** If CORS needs to be tightened further, set `CORS_ORIGINS=https://allowed.domain.com` in Railway env. Do NOT revert to `allow_credentials=True` unconditionally.

## Telegram webhook (backend/routes/telegram_bot.py)
Three-way check on every request:
1. Secret configured AND header matches → process normally
2. Secret configured AND header missing/wrong → return `{"ok":True}` without processing
3. No secret configured AND caller sends a token → reject (replay probe attempt)
4. No secret configured AND no token → log per-request WARNING and process (backward compat)

**Why:** Old code only validated when secret was set; a missing secret meant ALL requests were accepted silently.

**How to apply:** Set `TELEGRAM_WEBHOOK_SECRET` in Railway and re-run setWebhook with `secret_token`. Until then, the endpoint logs a warning per request.

## Rate limits on authenticated routes (backend/routes/data.py, auth.py)
- `POST /api/data/status` (hit submission): `rate_limit(f"hit_submit:{user.telegram_id}", 200)` — 200/hr per user
- `POST /api/data/screenshot`: `rate_limit(f"screenshot:{user.telegram_id}", 60)` — 60/hr per user
- `GET /api/auth/telegram-login/status` (login polling): `rate_limit(f"tg_poll:{ip}", 120)` — 120/hr per IP

**Why:** Previously only OTP/login-start routes had rate limits; authenticated data routes were unbounded and could abuse Mongo, Telegram outbox, and BIN lookup API.

**How to apply:** The `rate_limit()` function is in `backend/deps.py`. Use key pattern `"<action>:<user_telegram_id_or_ip>"`. All limits use sliding-hour windows stored in `db.rate_limits`.
