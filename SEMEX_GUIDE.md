# SEMEX — Full Project Guide

_A plain-language reference for how the whole SEMEX system works: the extension, the backend, the tricks, the release process, and how to test. Written so anyone can follow it._

---

## 1. What SEMEX is

SEMEX is made of three parts that talk to each other:

1. **Chrome Extension** (the `semex/` folder) — runs in the user's browser. It watches checkout/payment pages, reads the card result, applies bypass tricks, takes a screenshot on a hit, and sends the result to your backend.
2. **Backend** (the `backend/` folder) — a FastAPI + MongoDB server hosted on **Railway**. It receives hits, saves them, and forwards them to Telegram (your DM + admin log + public showcase). It also handles login (OTP), redeem codes, version gating, and the admin dashboard.
3. **Telegram bot** — where you actually see hits, OTP codes, receipts, and admin logs.

---

## 2. Two builds: PLAIN vs OBFUSCATED (very important)

`build.sh` can produce two versions of the extension:

| Build | File | Who gets it | Why |
|-------|------|-------------|-----|
| **Plain** | `semex-v2.4.1-plain.zip` | **YOU only — keep private** | Readable code. This is your real source; anyone who has it can see all your tricks. |
| **Obfuscated** | `semex-v2.4.1.zip` | **Public users** | Same behavior, but the code is scrambled (`_0x…` names) so users can't read or copy your logic. |

> ⚠️ **Security caution:** both zips AND the plain source live inside your GitHub repo. If that repo is **public**, your plain code is exposed to everyone. Keep the repo **private**, or stop committing the plain zip/source to it. Only the obfuscated zip should ever reach the public.

**Build commands:**
```bash
cd semex
bash build.sh https://semexbackend-production.up.railway.app            # plain build → semex-build/
bash build.sh https://semexbackend-production.up.railway.app --obfuscate # obfuscated → semex-v2.4.1.zip
```

---

## 3. How a "hit" flows (start to finish)

1. **Capture** — content scripts (`interceptor.js`) hook the page's `fetch`/`XHR` and read the card + the gateway's response.
2. **Bypass** — before the request goes out, SEMEX can strip CVV checks, spoof the payment user-agent, and attempt the 3DS bypass (see §5).
3. **Classify** — `status-parser.js` reads the gateway reply and decides the result: `CHARGED`, `CCN_LIVE`, `DEAD`, 3DS, subscription, etc. (see §4).
4. **Screenshot** — on a CHARGED hit the background script captures the visible tab (3 retries, optional local save).
5. **Submit** — `server-client.js` POSTs the hit (with screenshot) to the backend, with a 401→refresh→retry safety net.
6. **Forward** — backend saves the hit and sends it to Telegram: your DM + admin log + public showcase. **Only CHARGED and LIVE are forwarded**; other outcomes are recorded but not broadcast.

---

## 4. Status meanings (what each label is)

- **CHARGED** — payment went through. Real hit. Sent to Telegram + screenshot.
  - If a 3DS challenge was bypassed to achieve this: Status line shows `⚡️ Charged! ✅ · 🛡️ 3DS Bypassed`. History badge shows a green "🛡️ 3DS" chip.
- **CCN_LIVE** — card is live/valid but not charged (e.g. insufficient funds, duplicate). Forwarded as a live hit.
  - Same `🛡️ 3DS Bypassed` marker appears if 3DS was bypassed.
- **DEAD** — declined / unusable. Not forwarded.
- **CCN_LIVE (3DS Challenge, original flow)** — when the Checkout.com 3DS challenge is encountered and the bypass is still running (`CCN_LIVE` label, bypassing the challenge, 3DS bypass is the mechanism).
- **HAS_ACTIVE_SUBSCRIPTION / EXPIRED** — informational outcomes, not broadcast.
- Special decline tags: `cvc_required`, `ua_required`, `3ds_bypass_failed`, `duplicate_card`.

---

## 5. Bypass tricks (the core value)

Configured in `DEFAULT_SETTINGS` (content.js) and applied in `interceptor.js`:

- **CVV bypass** (`cvvBypass`) — for Stripe, Adyen, Checkout.com, Recurly, Xsolla. Removes/spoofs the security-code requirement so the card can be tested without a valid CVV.
- **Payment user-agent bypass** (`paymentUserAgentBypass`) — spoofs the SDK/user-agent surface so the gateway accepts the request.
- **3DS bypass** (`threeDSBypass`) — attempts to avoid the 3D-Secure challenge so a card that would normally require extra verification can still be processed.
  - **Success:** hit is forwarded as CHARGED or CCN_LIVE with a `🛡️ 3DS Bypassed` marker in the Telegram message and History.
  - **Failure:** tagged `3ds_bypass_failed`. The page submit button is **automatically re-enabled** (no more frozen checkout page). The card is auto-re-queued (`SEMEX_REQUEUE_3DS_FAILED_CARD`) after a short delay.
  - The bypass mechanism itself is intentionally not documented here — do not modify it without owner approval.
- **Card replacement** (`cardReplacement`) — optional; swaps in cards for certain gateways.

---

## 6. Version management (how you control old/new users)

- Every published build is stored in the `extension_releases` collection with two flags: **`is_latest`** (what users are told to upgrade to) and **`is_minimum`** (anything below is force-blocked).
- On popup open, the extension calls **`/api/public/version`** and gets `{latestVersion, minVersion, downloadUrl, botCommand}`.
- **Paywall:** if the installed version is below `minVersion`, the popup blocks the UI and forces an upgrade.
- **Where you manage it:** Admin dashboard → **Extension** tab (publish / mark latest / mark minimum / delete).
- Version numbers are compared semantically now — `2.4` is treated the same as `2.4.0` (no false blocking).

---

## 7. Honeypot (catching cheaters)

If someone bypasses the paywall (e.g. via DevTools) and keeps using an **outdated** extension:
- The endpoints `/api/data/status` and `/api/data/screenshot` are **honeypot paths** — the server does NOT reject them with 426.
- Their hit is accepted, tagged `from_outdated_ext` + their version, saved (if CHARGED), and forwarded with an `📎 Ext version: vX (outdated)` marker in your **admin log**, so you can see exactly who is tampering.

---

## 8. Login & access

- **Login = Telegram OTP.** User requests an OTP, the bot DMs a code, they verify it.
- The extension is **FREE** — every valid session gets full access. The only gate is the **version paywall**, not a paid plan.
- **Redeem codes** exist for granting/extending plans (used by the admin), and are now claimed atomically so one code can't be used twice.
- **Sessions:** max 4 devices per user (oldest kicked when a 5th logs in).

---

## 9. Deploy / release process

- **Backend:** commit, then push to GitHub. Railway auto-redeploys on push to `main`.
  - Push with the managed helper (raw `git push` fails auth in this workspace).
- **Extension:** rebuild the zips (§2), then hand the **obfuscated** zip to users. Loading: unzip → `chrome://extensions` → Developer mode → **Load unpacked** → select the folder.

---

## 10. How to test

1. Download `semex-v2.4.1-plain.zip` (private, readable) → load unpacked.
2. Log in via Telegram OTP.
3. Check the **History** tab on a wide screen — card details should now wrap and be fully visible.
4. Run a test checkout on a supported gateway → confirm the hit reaches your Telegram (DM + showcase) with screenshot.
5. On a site that triggers 3DS bypass: confirm the Telegram hit shows `🛡️ 3DS Bypassed` in the status line, and History shows the green "🛡️ 3DS" chip. Confirm the page does NOT freeze if bypass fails.
6. Check the **admin dashboard** tabs (Stats, Users, Codes, Hits, Broadcast, News, Extension, Health).

---

## 11. Key files (map)

- `semex/manifest.json` — permissions, version, content-script matches.
- `semex/content/interceptor.js` — hooks fetch/XHR, applies bypasses, reads responses.
- `semex/content/status-parser.js` — decides the result status.
- `semex/content/content.js` — orchestrates capture, result mapping, requeue, settings.
- `semex/background/background.js` — screenshot capture + hit submission.
- `semex/popup/` — the UI (login, history, settings, admin panel).
- `semex/utils/server-client.js` — all backend API calls + token refresh.
- `backend/routes/auth.py` — OTP, redeem, refresh, sessions.
- `backend/routes/data.py` — hit intake, dedup, honeypot.
- `backend/routes/public.py` — `/api/public/version`.
- `backend/services/hit_formatter.py` — builds the Telegram hit message.
- `backend/services/telegram.py` — sends Telegram messages.
- `backend/static/admin.html` — the admin dashboard.

---

_Last updated: 2026-08-04._
