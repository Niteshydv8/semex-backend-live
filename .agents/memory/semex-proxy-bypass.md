---
name: SEMEX proxy bypass list
description: Which domains must be in BYPASS_LIST in background.js and why.
---

## Rule
`BYPASS_LIST` in `semex/background.js` must always include:
- `"api.semxhitter.pw"` — primary backend API
- `"semxhitter.pw"` — base domain
- `"*.semxhitter.pw"` — wildcard
- `"*.up.railway.app"` and `"*.railway.app"` — Railway fallback
- `"api.telegram.org"` — Telegram bot

## Why
When a user's proxy is active, Chrome routes ALL network requests through it. Any domain NOT in the bypass list has its requests routed through the proxy. The user's proxy was broken for `api.semxhitter.pw`, so all `submitStatus`, auth, and sync calls silently failed. The Railway fallback URL (`semexbackend-production.up.railway.app`) was already in the list, but it is slower and unreliable as primary.

This was the root cause of:
- Hit notifications not arriving (requests never reached backend)
- `lastHitResult` stuck on old values (storeLast never called with ok=true)
- CHARGED counter not updating (submit never reached server, so server-side charged_count stayed stale)

## How to apply
Any time a new API domain is added for SEMEX backend traffic, add it (and its wildcard) to `BYPASS_LIST` immediately. The list is at approximately line 830 of `background.js`. Always rebuild and redistribute the extension after changing it.

Fix was applied in v2.4.4 (bypass list) and v2.4.5 (screenshot capture fix combined).
