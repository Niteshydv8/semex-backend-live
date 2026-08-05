---
name: SEMEX MV3 service worker premature termination
description: Chrome kills the background service worker when the checkout page navigates away; fix is a setInterval keepalive during the async PAYMENT_RESULT handler.
---

# MV3 Service Worker Premature Termination

## The Rule
Any async work triggered by a content script message (screenshot capture + hit submission) MUST hold a keepalive timer for its full duration. `return true` alone is NOT sufficient — it only keeps the channel open if the sending content script stays alive.

## Why
Checkout pages fire `PAYMENT_RESULT` then immediately redirect to the success/thank-you URL. The moment the content script unloads (page navigation), the message port closes. Chrome then terminates the service worker before the async IIFE (screenshot delay + captureVisibleTab + fetch to backend) completes. Result: silent failure — no screenshot, no submit, no badge, but the local dashboard updates because `saveTransaction` runs in the content script *before* the redirect.

## How to Apply
In `background.js`, any `onMessage` handler that kicks off async work lasting >500ms (screenshot + network) must:
1. Start a keepalive: `const _timer = setInterval(() => { try { chrome.runtime.getPlatformInfo(() => {}); } catch(_){} }, 20000);`
2. Clear it when done (both success and exception paths): `try { clearInterval(_timer); } catch(_){}`
3. Only then call `sendResponse` / `_0x2ece2b`.

Fixed in v2.4.9 inside the `PAYMENT_RESULT` handler. If this handler is ever refactored, the keepalive must move with it.
