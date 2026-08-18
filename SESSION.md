# SEMEX — Full Session & Feature Reference

> **Last updated:** 2026-08-18  
> This document is the single authoritative reference for the SEMEX ecosystem: backend architecture, extension capabilities, bot commands, access gating, restrictions, and operational rules. Update this file whenever any of the below changes.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Backend — Architecture & Stack](#2-backend--architecture--stack)
3. [Backend — API Surface](#3-backend--api-surface)
4. [Extension — Features](#4-extension--features)
5. [Extension — Version Gating & Minimum Versions](#5-extension--version-gating--minimum-versions)
6. [Extension — Restrictions & Hard Rules](#6-extension--restrictions--hard-rules)
7. [Telegram Bot — Commands](#7-telegram-bot--commands)
8. [Redeem Code System](#8-redeem-code-system)
9. [Plans & Access Control](#9-plans--access-control)
10. [Payment & Subscription Flows](#10-payment--subscription-flows)
11. [Hit Lifecycle & Persistence](#11-hit-lifecycle--persistence)
12. [Screenshot & Notification System](#12-screenshot--notification-system)
13. [Proxy System](#13-proxy-system)
14. [Anti-Fingerprint System](#14-anti-fingerprint-system)
15. [Overlay System](#15-overlay-system)
16. [Admin Panel](#16-admin-panel)
17. [Security & Hard Invariants](#17-security--hard-invariants)
18. [Deployment & Infrastructure](#18-deployment--infrastructure)

---

## 1. System Overview

SEMEX is a premium checkout-automation suite comprising:

| Component | Technology | Purpose |
|---|---|---|
| **Backend** | Python / FastAPI / MongoDB (Motor) | API server, auth, hit persistence, Telegram delivery |
| **Extension** | Chrome MV3 (Manifest V3) | Checkout detection, card fill, hit capture |
| **Telegram Bot** | Bot API webhook | User commands, code redemption, code generation, hit alerts |
| **Admin Panel** | Jinja2 / static HTML | Owner-only: user management, code generation, release publishing |

**Production host:** Railway (auto-redeploys on `git push main`).  
**Bot push:** `gitPush({ branch: "main" })` callback triggers Railway redeploy — never use raw `git push`.

---

## 2. Backend — Architecture & Stack

### Files

```
backend/
├── server.py           # FastAPI app, lifespan, middleware, router mounts
├── config.py           # Settings (Pydantic, env-driven)
├── db.py               # Motor MongoDB client + index initialisation
├── models.py           # Pydantic document models (User, Hit, RedeemCode, …)
├── deps.py             # FastAPI dependency injectors (auth, plan gating)
├── security.py         # JWT, OTP hashing, redeem-code generation
├── routes/
│   ├── auth.py         # /api/auth/* — OTP, Telegram login, redeem, refresh
│   ├── user.py         # /api/user/* — profile, BINs, hits, proxies, SSE
│   ├── data.py         # /api/data/* — hit submission, screenshot, version gate
│   ├── admin.py        # /api/admin/* — owner-only management
│   ├── public.py       # /api/public/* — version check, bot info, BINs, health
│   └── telegram_bot.py # /api/telegram/* — webhook + all bot commands
├── services/
│   ├── telegram.py     # Telegram API wrappers (send_message, send_photo, …)
│   ├── telegram_outbox.py  # Dedup queue for Telegram delivery
│   ├── sessions.py     # Session issuance (JWT access + refresh)
│   ├── bin_lookup.py   # BIN metadata lookup
│   ├── hit_formatter.py    # Formats hit payload into Telegram message
│   ├── extra_formatters.py # Public showcase formatter
│   └── sync.py         # SSE sync manager
└── tests/              # Integration tests (need live mongod + uvicorn:8001)
```

### Key environment variables

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Shared HMAC secret for JWT access/refresh tokens |
| `TELEGRAM_BOT_TOKEN` | Main command bot API token (webhook, login, commands) |
| `NOTIFICATION_BOT_TOKEN` | SemEx Auto X bot token — proactive notifications (hit alerts, OTP, receipts) + all-rounder commands/login via /webhook/autobot |
| `NOTIFICATION_BOT_USERNAME` | SemEx Auto X @username — returned by /api/public/bot and /api/public/version so extension login deep-links open this bot |
| `NOTIFICATION_BOT_WEBHOOK_SECRET` | Webhook secret for /webhook/autobot (optional — falls back to TELEGRAM_WEBHOOK_SECRET) |
| `TELEGRAM_WEBHOOK_SECRET` | Webhook HMAC guard — required for admin-log ingest |
| `ADMIN_TELEGRAM_ID` | Owner's Telegram numeric ID (int) |
| `ADMIN_LOG_CHANNEL_ID` | Telegram channel receiving LIVE/CHARGED hit posts |
| `OWNER_HANDLE` | Owner's @username for support links |
| `PREMIUM_GROUP_LINK` | Private group invite URL (auto-fulfilled after Stars payment) |
| `PLAN_PRICE_MONTHLY/YEARLY/LIFETIME` | Price labels shown in /buy |
| `PLAN_STARS_MONTHLY` | Telegram Stars price for monthly plan |
| `GROUP_PRICE_WEEKLY/MONTHLY` | Group access prices |
| `GROUP_STARS_WEEKLY/MONTHLY` | Stars prices for group access |
| `PAYMENT_USDT_BEP20/TRC20/TON` | USDT payment wallet addresses |
| `SESSION_SECRET` | Additional server secret |

---

## 3. Backend — API Surface

### Auth routes (`/api/auth/*`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/request-otp` | None | Send OTP to Telegram ID |
| POST | `/verify-otp` | None | Verify OTP, issue session |
| POST | `/redeem` | Session (allow-expired) | Redeem a plan/invite code |
| POST | `/refresh` | Refresh token | Rotate access token |
| POST | `/logout` | Session | Revoke session |
| GET | `/session` | Session | Current session info |
| POST | `/telegram-login/start` | None | Begin deep-link login flow |
| GET | `/telegram-login/status` | None | Poll for authorization |

### User routes (`/api/user/*`)

| Method | Path | Description |
|---|---|---|
| GET | `/me` | Profile, plan, counters |
| GET/PATCH | `/settings` | Extension settings CRUD |
| GET/POST/DELETE | `/bins` | Saved BINs |
| GET | `/hits` | Hit history |
| GET | `/state` | Full state sync |
| GET | `/stream` | SSE event stream |
| GET/DELETE | `/devices` | Session management |
| GET | `/ip-check` | IP/proxy status |

### Data routes (`/api/data/*`)

| Method | Path | Description |
|---|---|---|
| POST | `/status` | Submit a hit (card + result) |
| POST | `/screenshot` | Attach screenshot to existing hit |

**Version gate:** every request to `/api/data/*` (and most `/api/*`) is checked against the minimum extension version from DB (floor: `2.5.1`). Outdated clients get HTTP 426 with download URL. Exempt paths: `/api/public/*`, `/api/telegram/*`, health, docs.

### Admin routes (`/api/admin/*`) — owner-only

| Method | Path | Description |
|---|---|---|
| GET/PATCH | `/users` | List, ban, extend plans |
| POST/GET/DELETE | `/codes/*` | Redeem code management |
| GET | `/hits` | All hits across users |
| POST/GET/DELETE | `/releases/*` | Extension release publishing |

### Public routes (`/api/public/*`) — no auth

| Method | Path | Description |
|---|---|---|
| GET | `/version` | Minimum + latest extension version |
| GET | `/health` | Server health |
| GET | `/bot` | Bot username + join link |
| GET | `/bins` | Public BIN showcase |
| GET | `/news` | Changelog/announcements |

---

## 4. Extension — Features

### Core checkout automation

- **Checkout detection:** MutationObserver watches for Stripe Payment Element and Stripe Hosted Checkout iframes. Supports both `stripe.com/pay/` hosted and embedded `js.stripe.com` Payment Element.
- **Card fill:** Fills card number, expiry, CVV, billing name into Stripe's iframe fields. Supports new Stripe habanero UI (payment-*Input IDs inside `elements-inner` iframe). Fill runs inside ISOLATED world; Stripe frame access via Playwright-compatible cross-origin frame evaluate.
- **BIN cycling:** Rotates through saved BINs per attempt. Cards passed with `SEMEX_FILL_FORM` message per attempt — never cached between fills.
- **Name randomisation:** Human-sounding names generated per fill from pooled first/last name lists (same pool used across all fill paths).
- **Auto-remove on success:** Charged/live cards are removed from the rotation automatically.

### Hit capture & status

- **Statuses tracked:** `charged`, `live`, `3d_live`, `declined`, `dead`, `error`
- **Forwarded to Telegram:** `charged`, `live`, `3d_live` (own label, no bypass)
- **Persisted (not forwarded):** `declined`, `dead` with a real card
- **Never saved:** card-less attempts
- **$0 / free orders:** detected by `payment_status: "no_payment_required"`, reported as CHARGED, gated to `/confirm`+`/complete` URLs to avoid page-load false positives.

### Stripe surface support

| Surface | Detection | Notes |
|---|---|---|
| Hosted Checkout (`/pay/`, `/c/pay/`) | URL pattern | Full extraction |
| Embedded Payment Element | `js.stripe.com` iframe | Extraction from confirm request + DOM |
| Invoice (`invoice.stripe.com`) | URL + manifest | Must be in manifest `matches` AND `isCheckoutPage` |
| SetupIntent (`stripe_inbuilt`) | `/setup_intents/*/confirm` | Email/successUrl recovered from `__SEMEX_LAST_BILLING` + DOM |
| redirectToCheckout | `window.Stripe` proxy at `document_start` | Never-resolving Promise; opens new tab via postMessage bridge |

### Dashboard

- **Hit hydration:** SSE `hit` event → dashboard pulls `/api/user/hits`. Backend-persisted statuses survive reinstalls.
- **BIN list:** synced via `/api/user/bins`, live-pushed via SSE on changes.
- **Counters:** Charged/Live/Dead counts from backend (accurate post-reinstall).

### Overlay

- **Injection:** content.js injects overlay.js into checkout pages only (manifest `content_scripts` + `isCheckoutPage` runtime guard).
- **Bridge:** overlay.js has no `chrome.*` APIs — all extension comms route through content.js via `window.postMessage`.
- **Status pill:** `setStatus()` updates the in-overlay status text (NOT the toast notifier).
- **Toasts:** separate notification system; pill churn (Starting/Processing) is the common "toast complaint".
- **Mobile:** CSS uses `--blur-glass` variable; animated blur/backdrop-filter removed from desktop too (performance). Ryuk tab styled at `#ryuk-tab .ryuk-root`, no `@media`.

---

## 5. Extension — Version Gating & Minimum Versions

### Version floor

- **Hard floor:** `2.5.1` (set in `backend/routes/data.py` as `_FALLBACK_MIN_VERSION`)
- **DB override:** admin can set a higher minimum via the releases panel
- **Users on v2.5.1 and above:** pass the version gate and have full API access
- **Users below v2.5.1:** receive HTTP 426 with a download link for the latest build
- **Beta access:** v2.5.1+ users are considered in-scope for all beta/current features
- **Cache:** version floor cached 60 s in-process to avoid per-request DB reads

### Version format

Must match `^\d+\.\d+(\.\d+)?(\.\d+)?$` — single-integer strings ("3") are rejected (would compare higher than "2.x.x").

### Version in extension

Current manifest version: **4.1.1** (in `semex/manifest.json`). Published releases tracked in `extension_releases` collection.

---

## 6. Extension — Restrictions & Hard Rules

| Rule | Description |
|---|---|
| **No 3DS bypass** | NEVER touch 3DS challenge logic. 3DS = own label only, never forwarded as a bypass. |
| **Card data local-only** | `binOrCCList` (BIN/CVV/CC list) must NEVER sync to backend. Strip from all settings-sync payloads. |
| **No shared encryption key shipping** | Extension shared key must not be included in installable zip. |
| **BIN add = device-local** | Overlay BIN adds are local-only (DB saves dashboard-only). Page-triggered storage writes need pinned-root gesture + chrome.runtime message + SW queue — never via window.postMessage. |
| **Proxy bypass list** | `api.semxhitter.pw`, `semxhitter.pw`, `*.semxhitter.pw` must be in `BYPASS_LIST` in `background.js` or proxy kills all API calls silently. |
| **Proxy auth scoping** | `onAuthRequired` must abstain when `details.isProxy === false`, or site Basic-Auth loops and checkout never opens. |
| **Anti-fingerprint + Cloudflare** | AF canvas/WebGL patches corrupt CF challenge POW. Exclude `challenges.cloudflare.com` + `/cdn-cgi/challenge-platform` in manifest AND runtime-guard AF. |
| **Fingerprint control** | Real FP engine is `content/anti-fingerprint.js` driven by `antiFingerprint` storage. Ryuk tab is just a control surface. Never push random tz/platform (breaks proxy-geo sync). |
| **Service worker keepalive** | Page navigation kills the MV3 SW mid-screenshot/submit. Fix: `setInterval` ping during `PAYMENT_RESULT` async handler. |
| **getSelectors wrapper** | `getSelectors()` returns `{selectors, delays, iframe}`. ALL consumers must unwrap — double-wrap causes silent no-fill + fake success. |
| **Overlay only on real checkouts** | Panel must never appear on ordinary merchant pages. `_semexIsCheckoutFill` flag + `IS_STRIPE_CHECKOUT` sessionStorage (set in iframe origin) gate fills. |

---

## 7. Telegram Bot — Commands

### Public user commands

| Command | Aliases | Description |
|---|---|---|
| `/start` | — | Onboarding welcome + main menu keyboard |
| `/menu` | — | Re-open main menu |
| `/help` | — | Full command list |
| `/get` | — | Download extension .zip via Telegram |
| `/buy` | `/premium`, `/upgrade`, `/plans` | Show plans, USDT addresses, Stars buttons |
| `/paid` | `/proof`, `/receipt` | Enter proof-of-payment mode (next photo → owner) |
| `/cancel` | — | Cancel pending /paid submission |
| `/status` | `/stats`, `/me`, `/plan` | Account plan, expiry, hit counters |
| `/history` | — | Last 5 charged hits (masked card numbers) |
| `/bins` | `/bin`, `/mybins` | List saved BINs |
| `/savebin <BIN> [label]` | `/addbin` | Save a BIN to extension list |
| `/settings` | `/setting` | Account status + saved BINs |
| **`/redeem <CODE>`** | `/activate`, `/code` | **Redeem an invite/plan code in the bot** |

### Owner-only commands (silent ignore for non-owners)

| Command | Aliases | Description |
|---|---|---|
| `/sendlink <telegram_id> [link]` | `/givelink`, `/invitelink` | Send private group invite to a user |
| **`/gencode <days> [qty] [note]`** | `/generatecode`, `/makecode` | **Generate redeem codes from the bot** |

### Inline keyboard callbacks

| Callback | Action |
|---|---|
| `menu:get` | Send extension zip |
| `menu:premium` | Show /buy |
| `menu:support` | Show owner handle |
| `menu:settings` | Show status + BINs |
| `menu:home` | Re-open /start |
| `stars:<product>` | Send Stars invoice |
| `tglogin:<action>:<token>` | Authorize/deny login request |

---

## 8. Redeem Code System

### Code format

`SEMEX-XXXX-XXXX-XXXX` where X is from alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no ambiguous chars).

### Storage

`redeem_codes` MongoDB collection:
- `code_hash` — SHA-256 of the uppercased code (indexed, used for lookup)
- `code_preview` — masked display (`SEMEX-****-...XXXX`)
- `duration_days` — plan duration; `-1` = lifetime/VIP
- `plan_tag` — `TRIAL`, `WEEKLY`, `PLUS`, `MONTHLY`, `YEARLY`, `VIP`
- `created_by` — owner's telegram_id
- `used` / `used_by` / `used_at` — redemption state (atomic claim)
- `note` — optional admin label

### Duration → Plan mapping

| Days | Plan tag |
|---|---|
| 1, 3 | TRIAL |
| 7 | WEEKLY |
| 10, 14 | PLUS |
| 30, 90, 180 | MONTHLY |
| 365 | YEARLY |
| -1 | VIP (lifetime) |

### Redemption flow

1. Code uppercased + SHA-256 hashed → lookup `redeem_codes`
2. Validated: exists, `used == false`
3. User account must exist (`telegram_id` in `users`)
4. Expiry stacked: if active plan remains, new duration added on top; otherwise from now
5. **Atomic claim:** `find_one_and_update` with `used: {$ne: true}` — only one claimer wins
6. User updated: `plan`, `plan_expires_at`, `requires_redeem: false`, expiry alerts reset
7. Rollback if entitlement write fails (code un-claimed so user can retry)
8. Receipt sent via Telegram DM

### Generation via bot (`/gencode`)

- Owner-only (silently ignored for non-owners)
- Max 20 codes per bot command (admin panel allows up to 500)
- Codes stored immediately in `redeem_codes` collection
- Each code displayed as copyable `<code>` block in bot reply
- Same atomic-claim protection on redemption

---

## 9. Plans & Access Control

### Plan tiers

| Plan | Access |
|---|---|
| `TRIAL` | Basic access, limited history |
| `WEEKLY` | 7-day premium |
| `PLUS` | 14-day premium |
| `MONTHLY` | 30-day premium |
| `YEARLY` | 365-day premium |
| `VIP` | Lifetime, no expiry |

### `requires_redeem` flag

- `true` on new Telegram deep-link signups (locked until they redeem a code)
- Cleared to `false` on successful code redemption (dashboard or bot)
- When `true`: `hasAccess: false` in session response; extension shows redeem prompt
- Plan expiry check: **disabled** in extension (free access model); gating is purely `requires_redeem`

### `get_current_user_unlocked` dependency

Used by hit submission routes — rejects users with `requires_redeem: true` even if their session is valid.

---

## 10. Payment & Subscription Flows

### Manual USDT flow

1. User runs `/buy` → sees USDT addresses (BEP20 / TRC20 / TON)
2. User pays and runs `/paid` → enters proof-submit mode (30 min TTL in MongoDB)
3. User sends payment screenshot → copied to owner with admin caption
4. Owner verifies on-chain, extends plan via admin panel
5. Owner optionally runs `/sendlink <telegram_id>` to deliver private group invite

### Telegram Stars flow (automatic)

1. User taps Stars button in `/buy` → bot sends invoice
2. User pays → `pre_checkout_query` answered within 10 s
3. `successful_payment` → `_fulfill_stars_payment()`:
   - `plan_monthly`: extends DB plan 30 days, sends receipt
   - `group_weekly/monthly`: sends `PREMIUM_GROUP_LINK` invite DM
4. Owner notified with charge ID (needed for `refundStarPayment`)

### Proof-of-payment state

Stored in `tg_proof_state` collection with TTL index on `expires_at` (30 min). In-process expiry guard catches the TTL lag window.

---

## 11. Hit Lifecycle & Persistence

### Submission

Extension POSTs to `/api/data/status` with card data, result, gateway, site URL, amount.

### Statuses

| Status | Forwarded | Persisted |
|---|---|---|
| `charged` | ✅ Telegram | ✅ DB |
| `live` | ✅ Telegram | ✅ DB |
| `3d_live` | ✅ (own label) | ✅ DB |
| `declined` | ❌ | ✅ (real card only) |
| `dead` | ❌ | ✅ (real card only) |
| card-less | ❌ | ❌ |

### CVV-aware dedup (declined/dead)

Non-forwarded hits dedup is CVV-aware — same card + different CVV = separate record.

### Admin-log failsafe

CHARGED/LIVE hits also posted to `ADMIN_LOG_CHANNEL_ID`. If primary DB insert fails, `_ingest_admin_log_post()` parses the channel post and upserts the hit. Only active when `TELEGRAM_WEBHOOK_SECRET` is set (prevents spoofed card ingestion).

### Persistence per-user

LIVE + CHARGED persisted per `telegram_id`. Counters (`hit_count`, `charged_count`, `live_count`) incremented and shown in `/status`.

---

## 12. Screenshot & Notification System

### Screenshot capture

- Probe polls every 200 ms, capped at 3.5 s total
- Settle delay scaled by UI type:
  - Animated tick (Stripe animated success): 600 ms
  - Static page: 350 ms
- **Never** abort poll on a single transient probe error
- **Never** use fixed delays or navigation-driven triggering
- Success detection: looks for SEMEX element IDs (success markers) — if IDs are renamed, probe silently misses

### Telegram delivery

- Screenshot rides **inside** the hit message (photo + caption, ~6 s budget)
- Text-first approach was rejected by owner
- On send failure: plaintext retry + debug-last-hit endpoint
- `_mask_success_url` stays a clickable full link (owner decision, confirmed 2026-08-16)
- Stripe surface labels come from page hostname + gate, not response URL

### Silent failure modes

- Invalid `custom_emoji_id` entities 400-reject the whole message (plain OTP unaffected)
- Bad HTML in send_message/send_photo silently 400s → plaintext retry
- Solution: plaintext fallback + `debug-last-hit` endpoint for diagnosis

---

## 13. Proxy System

### Activation

Configured in extension settings (proxies). Background.js `onAuthRequired` supplies proxy credentials.

### Bypass list

Always bypass for SEMEX API domains:
- `api.semxhitter.pw`
- `semxhitter.pw`
- `*.semxhitter.pw`

Missing bypass = proxy kills all API calls silently.

### Auth scoping

`onAuthRequired` must check `details.isProxy === true` before supplying credentials. If it responds to non-proxy auth (e.g., site Basic Auth), checkout page loops forever.

### Failover

Proxy failover and restart are handled by MV3 service worker. Worker keepalive (`setInterval` ping) prevents navigation from killing mid-operation handler.

---

## 14. Anti-Fingerprint System

### Engine

`content/anti-fingerprint.js` — driven by `antiFingerprint` storage key. Patches canvas, WebGL, fonts, platform, timezone, screen dimensions.

### Control surface

Ryuk tab shows AF controls but does NOT run the AF engine directly. Ryuk tab is a UI only.

### Critical exclusions

Must exclude from AF (breaks Cloudflare challenge POW computation):
- `challenges.cloudflare.com`
- `/cdn-cgi/challenge-platform`

Exclusion must be in both manifest `matches` (don't inject AF there) and runtime guard in AF code.

### Fingerprint ↔ proxy sync

Never randomise timezone/platform independently — must sync with proxy geo or the browser fingerprint contradicts the IP location.

---

## 15. Overlay System

### Injection

Overlay injected by `content.js` on checkout pages only. New Stripe hosts (e.g. `invoice.stripe.com`) must be added to BOTH:
1. `manifest.json` `content_scripts.matches`
2. `isCheckoutPage()` check in the interceptor

### Bridge

`overlay.js` has no `chrome.*` APIs. All extension communication routes through `content.js` via `window.postMessage`. Page-triggered storage writes need pinned-root gesture + `chrome.runtime.sendMessage` + SW queue — never raw `window.postMessage` for privileged writes.

### Embedded checkout gate

`_semexIsCheckoutFill` flag silently blocks fills on merchant pages with embedded Stripe. `IS_STRIPE_CHECKOUT` sessionStorage is set in the iframe's origin, not the top frame. Detection: check if iframe `src` includes `js.stripe.com`.

---

## 16. Admin Panel

Access: owner-only (authenticated via `require_owner` dependency).

### Capabilities

- **User management:** list, ban/unban, extend plans, revoke sessions, promote to admin, demote
- **Redeem codes:** generate (1–500 per request), list (used/unused filter), delete unused codes
- **Hit management:** view all hits across all users
- **Extension releases:** publish new builds (sets `is_latest`, `is_minimum`), view download counts, manage release notes

### Code generation (admin panel)

`POST /api/admin/codes/generate` body:
```json
{
  "days": 30,
  "quantity": 5,
  "prefix": "SEMEX",
  "plan_tag": "MONTHLY",
  "note": "batch for campaign"
}
```

---

## 17. Security & Hard Invariants

| Invariant | Why |
|---|---|
| JWT_SECRET must be secret, never shipped with extension | Extension code is user-accessible; a leaked JWT secret lets anyone forge sessions |
| Webhook secret required for admin-log ingest | Without it, anyone can POST forged card rows to the channel ingest endpoint |
| Redeem codes single-use (atomic claim) | `find_one_and_update` with `used: {$ne: true}` — concurrent redemptions can't double-spend |
| Card data never sent to backend | Protects users; extension BIN/CC list is device-local only |
| 3DS bypass logic untouched | Do not attempt to bypass 3DS challenges |
| Session TTL: 15 min access token | All authed calls must use `authedFetch` (auto-refresh on 401); SSE needs bespoke reconnect |
| Proof-state TTL: 30 min (MongoDB TTL index) | Prevents stale proof sessions accumulating; in-process guard catches TTL lag |

---

## 18. Deployment & Infrastructure

### Railway (backend)

- Auto-redeploys on `git push main`
- Push via `gitPush({ branch: "main" })` callback (raw `git push` fails auth)
- Environment variables set in Railway dashboard

### Extension distribution

- No auto-update mechanism
- Owner publishes new zip via admin panel → sets `is_latest` in DB
- Bot `/get` command sends the latest published zip to users
- Build process:
  1. Edit source in `semex/` directory
  2. Run `./build.sh <API_URL>` → outputs to `semex-build/` + root zip
  3. Never hand-edit `semex-build/` (generated)
  4. Placeholder `__SEMEX_API_URL__` in `semex/` is replaced at build time

### MongoDB collections

| Collection | Purpose |
|---|---|
| `users` | User accounts, plans, counters |
| `sessions` | Active sessions (JWT JTI) |
| `redeem_codes` | Plan/invite codes |
| `hits` | Hit records (all statuses) |
| `user_bins` | Saved BINs per user |
| `extension_releases` | Published extension builds |
| `tg_proof_state` | Proof-of-payment session state (30 min TTL) |
| `tg_updates` | Webhook dedup store |
| `tg_login_tokens` | Deep-link login tokens |
| `star_payments` | Telegram Stars payment audit log |
| `telegram_login_tokens` | Login authorization tokens |
