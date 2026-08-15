# SEMEX v4.0.0 — Release Notes

**Release date:** August 15, 2026
**Builds:** `semex-v4.0.0-plain.zip` (owner only) / `semex-v4.0.0.zip` (obfuscated, public)
**Backend:** deploys via git push to main (auto-redeploy)

---

## PART A — PUBLIC RELEASE NOTES
_Safe to share with users. No internals, no bypass details._

### ✨ New in the Extension

**New overlay BIN / CC picker**
- Switch between two card sources right on the checkout page: your **saved BINs** or your own **CC list**
- **⇄ cycle button** rotates through BINs or cards instantly
- **Add new** on the fly: a new BIN activates immediately; a new card goes to the top of your list
- Cards are always **masked** (first 6 •••• last 4) — your list never leaves your device
- BIN entries show **brand / type / country** tags, and the overlay now shows your **proxy exit IP**
- Your picker mode is remembered between sessions

**Redesigned overlay**
- New compact terminal-style layout with a cleaner stats/details grid
- **Hide** button blurs your Card, BIN and IP values for screenshots/screen-sharing

**New "Terminal Trace" hit toaster**
- Color-coded result popups: 🔵 bypass attempt · 🟡 live · 🟢 charged · 🔴 declined · 🟣 3DS
- Up to 3 stacked cards, ~5 second lifetime, 🎉 confetti on charged
- Reduced-motion support for slower devices

**Better autofill identity**
- Generated identities now include optional middle initials and hyphenated surnames, with far more combinations (less repeated data across checkouts)

### 🔧 Extension fixes in v4.0.0
- **Screenshot reliability:** duplicate screenshots across invoice/billing tabs eliminated; capture now fires fast enough to catch the checkout success toast before the redirect
- Toaster no longer stutters or stacks uncontrollably on rapid results

### 🤖 New in the Telegram Bot
- **`/start` now opens a menu** — welcome message with your name + user ID, then buttons:
  - 🧩 **Get Extension** — always serves the latest release
  - 💎 **Premium Group** — private group access
  - 🛟 **Contact Support** — direct line to the owner
  - ⚙️ **Settings** — your saved BINs and preferences
- New commands: **`/menu`** and **`/settings`**

### 🛠 Reliability improvements (behind the scenes)
- Hit notifications now survive Telegram rate-limits and markup errors (automatic retry + fallback) — far fewer "silent" missed hits
- Faster, more stable hit processing: slow BIN lookups can no longer delay your hit delivery

---

## PART B — INTERNAL CHANGELOG (owner-only — do NOT publish)

### Extension v4.0.0 (from v2.9.12)

**New features**
- `content/overlay.js` — full BIN/CC list-mode picker: segmented mode toggle persisted locally; BIN mode loads server-saved BINs with brand/type/country metadata; CC mode uses local `ccList` only (never synced — policy unchanged); ⇄ cycling; add-new BIN activates immediately, add-new CC inserts at top; per-mode placeholders/empty states; PAN masking (6+••+4)
- `content/overlay.js` + `overlay.css` — compact terminal-green redesign; Hide control blurs Card/BIN/IP; BIN metadata + proxy exit IP detail rows
- `content/toast-notifier-v2.js` — "Terminal Trace" toaster: dark monospace, max 3 stacked, status accent rail/aura (bypass blue, live gold, charged green, decline red, 3DS purple), detail rows, SEMEX watermark, progress/lifetime bar (5s default), confetti on charged, dedup, XSS-safe rendering, reduced-motion fallback
- `content/content.js` — bridge messages `SEMEX_SET_LIST_MODE` (persist mode) + `SEMEX_SET_CC_ACTIVE` (reorder/activate CC, 20k char cap); identity autofill gains middle initials + hyphenated surnames

**Fixes**
- `background.js` — screenshot dedup key now includes tab + status + card last-4 + hostname (kills invoice/billing-tab duplicate captures); capture delay forced to 400 ms (popup slider kept for UI but no longer honored)
- `content.js` — identity generator: more combinations, avoids identical hyphenated surname halves

**No changes:** manifest permissions/host matches unchanged; no proxy bypass-list or MV3 keepalive changes this cycle; popup functionally unchanged.

### Backend

**New features**
- **Per-user card storage:** CHARGED **and** LIVE hits now persist permanently (`models.py` `User.live_count`, `routes/data.py`); DEAD/declined/error remain notification-only
- **Admin-log failsafe recovery:** `channel_post`/`edited_channel_post` webhook handler parses admin-log posts (telegram ID, full card, status, site, response, gateway, email, IP) and upserts `Hit{recovered_from_log:true}` when the primary insert missed it — emoji-prefixed status lines classified by keyword; atomic upsert + partial unique index `failsafe_recovered_uniq` (`db.py`) makes it idempotent under concurrent/edited delivery; gated on `TELEGRAM_WEBHOOK_SECRET`
- **Owner admin lookup:** `GET /api/admin/user-cards?telegram_id=` (require_owner) + admin dashboard "User card lookup" UI — plan/counters + separate Charged/Live tables, RECOVERED badges, all fields HTML-escaped
- **Bot menu UX:** `/start` themed welcome (username + user ID + note) with inline keyboard (Get Extension / Premium Group / Contact Support / Settings), `/menu`, `/settings`, `callback_query` dispatch, `answer_callback_query`; `send_message` supports `reply_markup`; `PREMIUM_GROUP_LINK` config (falls back to /buy), support button from `OWNER_HANDLE`

**Fixes**
- **Version-gate 426 false blocks:** malformed min-version values (e.g. bare `3`) rejected; semver normalized zero-padded; hard fallback floor; actionable update URL in the error; missing header still allowed for browser/admin
- **False-positive hit guard:** forwardable statuses without a plausible card dropped; CHARGED with zero/negative amount dropped; short-window duplicate CHARGED/LIVE suppression keyed on full PAN + user/status/site
- **Telegram delivery durability:** 429 `retry_after` honored, transient network retries, HTML-parse + custom-emoji failures fall back to plain text — no more silently lost notifications; message/photo length caps
- **Durability ordering:** CHARGED outbox write happens before final DB persistence (closes "row in dashboard, nothing in Telegram" gap)
- **Admin-log LIVE amount** now included in status line; formatter length caps fixed
- **Portable paths:** hardcoded `/app` (Railway) replaced — Render-compatible

**Internal/tech**
- Webhook `update_id` atomic replay dedup; private-chat command gate (groups/channels ignored)
- Release download resolution prefers latest Mongo-published extension, falls back to on-disk zips; download counters
- Expired users' hits still saved (forwarding rules separate); BIN lookup capped at 2.5s
- `recovered_from_log` rows never constrain normal rows (partial index only)

---

## Carried-in fixes from the v2.9.x line (all present in v4.0.0)

_For the record — these were fixed earlier and remain fixed in this build._

- **MV3 worker keepalive** — page navigation no longer kills the worker mid-screenshot/submit (interval ping during the PAYMENT_RESULT handler)
- **Proxy bypass list** — API domains whitelisted so the proxy can't kill backend calls silently
- **Proxy auth scoping** — extension abstains from non-proxy auth challenges (site Basic-Auth no longer loops)
- **Screenshot capture timing** — checkout page captured pre-redirect (tabs.onUpdated approach removed)
- **Telegram silent failures** — plain-text retry on bad HTML; custom-emoji entities validated so one bad emoji can't 400-reject the whole message
- **Overlay visibility** — new Stripe hosts added to manifest matches + interceptor detection
- **Overlay MAIN-world bridge** — all extension comms routed through content.js postMessage (overlay has no chrome.* APIs)
- **stripe.redirectToCheckout intercept** — patched per-instance at document_start, redirect suppressed, hit opens in new tab
- **$0 / free checkouts** — `no_payment_required` detected as CHARGED, gated to confirm+complete (no page-load false positives)
- **Anti-fingerprint vs Cloudflare** — CF challenge hosts excluded in manifest + runtime-guarded; captcha-solver no retry-loop on CF
- **Xsolla card-replacement/CVV coupling** — single re-encrypt path gated at 3 points
- **Authed fetch 401 refresh** — all calls refresh via serverClient; SSE has bespoke reconnect
- **Embedded-checkout extractor** — detected shareable Stripe embeds auto-open in new tabs
- **Notification design** — screenshot rides inside the hit message (photo + caption)
- **Card data stays local** — BIN/CVV/CC lists never sync to backend
- **Hit statuses & 3DS policy** — only charged/live/3d_live forwarded; 3DS challenge is its own non-forwarded label
- **Dedup keys include detail rows** — distinct decline codes no longer suppressed; SetupIntent IDs render monospace
- **Site field** — shows the merchant website, not checkout.stripe.com
- **Mobile/desktop performance** — animated blur/backdrop-filter centralized; orbs static on desktop

---

## Deploy / activation checklist (owner)

1. Push to main → backend auto-redeploys
2. Set `TELEGRAM_WEBHOOK_SECRET`, re-run `setWebhook` with `allowed_updates` including `channel_post` + `edited_channel_post` — **required or the failsafe never fires**
3. Set `PREMIUM_GROUP_LINK` + `OWNER_HANDLE` (bot buttons fall back gracefully without them)
4. Verify one real hit appears in admin → User card lookup; simulate a missed insert to confirm RECOVERED rows
5. On-device QA of overlay picker + toaster before shipping the zip to users
