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

## Mobile / slow-network capture (v2.6.0)
`captureVisibleTab` returns blank OR errors when the target tab is not the ACTIVE tab of a FOCUSED window. This is the #1 reason mobile (Kiwi/Android) screenshots came back empty while the hit itself still forwarded (text-only send_message, no photo).

Fix pattern in the PAYMENT_RESULT capture loop:
- Attempt 1: capture as-is (desktop tab is usually already active → succeeds, so no focus stealing on desktop).
- On first failure only: activate the tab (`chrome.tabs.update(tabId,{active:true})`) + focus its window (`chrome.windows.update(winId,{focused:true})`, guard `chrome.windows` existence for Android), then retry.
- Wrap every capture in a hard timeout (Promise.race) so a rare hang can't stall the async handler.
- Fallback chain PNG → JPEG85 → JPEG60 → JPEG40: smaller payloads both capture AND upload far better on weak links.

**Why the timing still works:** captureVisibleTab fails FAST on an inactive tab (it does not hang), so attempt 2 (after focus) fires ~1.3s after PAYMENT_RESULT — still on the checkout page, before the ~1.5–3s mobile redirect to successUrl. Keep retry backoff modest for the same reason.
