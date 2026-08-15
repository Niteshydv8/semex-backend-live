---
name: SEMEX authed-fetch token refresh
description: Every authenticated extension API call must refresh-on-401 via serverClient.authedFetch, or it silently dies after the 15-min access-token TTL.
---

# SEMEX authed API calls must refresh-on-401

Access tokens have a 15-minute TTL (backend `ACCESS_TOKEN_TTL_MINUTES`). Any extension call to an authenticated endpoint that uses a raw `fetch()` with the stored access token and NO refresh-on-401 will hard-fail with "invalid token" / HTTP 401 once the token ages out — and it fails confusingly, because the same token worked earlier in the session.

**Rule:** route every authenticated API call through `serverClient.authedFetch(path, options)` (in `semex/utils/server-client.js`). It attaches Authorization / X-Fingerprint / X-Extension-Version headers, and on a 401 calls `_tryRefresh()` (POST refreshToken → `/api/auth/refresh`) then retries once. A 401 that survives the refresh = truly logged out → surface "Session expired — please log in again".

**Why:** the Saved BINs panel + Save-BIN button + background BIN fetch each fetched raw with no refresh, so BINs alone broke ~15 min into a session while `submitStatus`/`redeemCode` (which refresh inline) kept working. Confirmed root cause of the "BIN library invalid token" bug.

**How to apply:** when adding/editing any authenticated endpoint call in the extension, use `authedFetch` — never a bare fetch with the access token. As of the v4.0.6 audit pass, ALL known offenders are migrated (`/api/user/settings`, `/api/user/state`, `/api/user/ip-check`, `/api/admin/*`, `/api/data/screenshot`), including the SSE stream `/api/user/stream` (fetch-based, so authedFetch works and returns the raw Response for streaming). Note: `authedFetch` deliberately lets its fresh Authorization/X-Fingerprint headers overwrite caller-supplied ones so the 401-retry never reuses a stale token — do not "fix" that precedence. Remaining raw fetches are third-party only (2Captcha, NoPeCHA, ipwho.is, ipify) and need no SEMEX auth.
