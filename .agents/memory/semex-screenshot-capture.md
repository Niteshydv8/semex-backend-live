---
name: SEMEX screenshot capture fix
description: Why captureVisibleTab failed and the correct timing for checkout-page screenshot.
---

## Rule
Capture the CHECKOUT PAGE (green toast visible) at ≤800ms after PAYMENT_RESULT, NOT the redirect/success page.

## Why
User wants a screenshot of the checkout page showing the "Payment successful" green tick/toast — this appears immediately when the payment is detected. Stripe typically redirects to the successUrl 1.5–3s later. Capturing at ≤800ms after PAYMENT_RESULT guarantees the tab is still on the checkout page with the toast visible.

The event-driven (tabs.onUpdated) approach is WRONG for this use case — it waits for the redirect page which is (a) the wrong page and (b) slower.

## How to apply
In `background.js` PAYMENT_RESULT handler (second async IIFE):
1. Cap `screenshotDelay` at 800ms: `const _0xssCapDelay = Math.min(_0xssDelayMs, 800)`
2. `await new Promise(r => setTimeout(r, _0xssCapDelay))`
3. Try: PNG → JPEG-85 → JPEG-60 with 100ms gaps between attempts
4. `captureVisibleTab` works because tab is still on checkout page (not navigating)

Do NOT use `chrome.tabs.onUpdated` listener for screenshot — it waits for the wrong page.
