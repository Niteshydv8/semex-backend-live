---
name: SEMEX screenshot capture fix
description: Why captureVisibleTab failed on Kiwi/mobile and how the event-driven fix works.
---

## Rule
Use `chrome.tabs.onUpdated` (status:"complete") to trigger the screenshot capture, not a fixed setTimeout delay.

## Why
The old approach waited a fixed `screenshotDelay` ms (default 1000ms), then called `captureVisibleTab`. After a CHARGED hit, the checkout page redirects to the Stripe/merchant success page. During that redirect, the tab is in a "loading" state. `captureVisibleTab` called mid-navigation always fails on Kiwi/Android and intermittently on desktop — returning an error or an empty result even after 3 retries.

Additional side benefit: an active `tabs.onUpdated` listener keeps the MV3 service worker alive for the entire capture window, preventing premature termination.

## How to apply
The screenshot block in `background.js` PAYMENT_RESULT handler (inside the second async IIFE, after stats update) uses a Promise-based pattern:
1. Set a hard fallback timeout (`max(screenshotDelay + 2500, 5000)` ms) that captures regardless.
2. Register `chrome.tabs.onUpdated` listener for the sender's tabId, fire `_semexTryCapture()` 400ms after `status:"complete"`.
3. Also try immediately after `screenshotDelay` ms (opportunistic early capture — succeeds if tab already on success page).
4. Whichever resolves first wins; listener is cleaned up.

`_semexTryCapture()` tries JPEG-85 → PNG → JPEG-60 with 200ms gaps between attempts.

Do NOT revert to fixed-delay approach; it is broken on mobile.
