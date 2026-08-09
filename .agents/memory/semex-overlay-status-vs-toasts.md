---
name: SEMEX overlay status pill vs toast-notifier
description: Two separate notification systems — don't confuse the overlay status pill with the toast-notifier toasts.
---

## Rule
SEMEX has TWO independent on-page notification systems:
1. **Overlay status pill** — `setStatus()` (obfuscated `_0x2796fd`) in `content/overlay.js` updates persistent elements (statusText / pillText / dockText). This shows "Running", "Filling form…", "Waiting response…", "CHARGED", etc. It is the automation loop's live state, NOT a toast.
2. **Toast-notifier** — `window.showToast` / `showToastV2` in `content/toast-notifier-v2.js`, triggered by `SEMEX_TOAST` messages from `content/interceptor.js` (e.g. `messageType: "BYPASS_ACTIVATED"` → "STRIPE Bypass" toast) and result toasts from `content/content.js`.

## Why
Users say "toaster" for either one. The complaint about a "start toaster" and "background processing on loop" was the PILL churning "Starting…" then "Processing #1, #2, #3…" each loop iteration — not the toast-notifier. The bypass toast already fires at request-interception time (before the result), so it is naturally "first" once the pill noise is removed.

## How to apply
When a user complains about hit-time notifications: identify WHICH system. Pill wording lives in overlay.js setStatus calls; toast wording/timing lives in interceptor.js SEMEX_TOAST posts + toast-notifier-v2.js. Changing the pill is display-only and safe; it does not affect whether a hit succeeds.
