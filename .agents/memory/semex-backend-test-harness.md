---
name: SEMEX backend test harness
description: How to run backend/tests green locally — needs live mongod + uvicorn on 127.0.0.1:8001 in ONE shell call; tests are integration-style, not unit tests.
---

# SEMEX backend test harness

`backend/tests/` is an **integration** suite: most tests HTTP-call a live server at `http://localhost:8001` against a real MongoDB. They do not work without both running.

**Why:** Tests were written against the Railway deployment layout and never isolated. Running `pytest` alone yields ~130 connection/auth failures that look like real bugs but aren't.

**How to apply:**
- Background processes are **reaped between ShellExec calls** — start mongod, start uvicorn, and run pytest inside ONE command (mongod `--fork`, nohup uvicorn, curl health-check loop, pytest, then kill both).
- mongod binary: `/nix/store/3z9iq2gr9ddb0ncmxjlv81ngn6b4nm70-mongodb-6.0.5/bin/mongod --dbpath /tmp/semex-mongo/data --noauth --fork`.
- Dummy env: MONGO_URL/DB_NAME=semex_test, TELEGRAM_BOT_TOKEN (Telegram API is reachable; dummy token 401s fast, no hangs), JWT/HMAC secrets, ADMIN_TELEGRAM_ID=999999999, APP_BASE_DIR=<repo root>, plus PUBLIC_SHOWCASE_CHANNEL_ID / ADMIN_LOG_CHANNEL_ID or public-channel tests fail.
- Wipe `/tmp/semex-mongo/data` before each full run — reused state causes DuplicateKeyError flakes.
- Tests hardcode `X-Extension-Version` headers; when the min-version floor rises, sweep headers to `"9.9.9"`.
- Since v2.9.5 ALL `/api/admin/*` routes are owner-only (`require_owner`); tests wanting 200 must use the owner fixture (`admin_by_id_user`), not a promoted admin.
