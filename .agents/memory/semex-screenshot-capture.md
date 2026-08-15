---
name: SEMEX screenshot capture fix
description: Why captureVisibleTab failed and the correct timing for checkout-page screenshot.
---

## Rule
OLD rule was "fixed ≤800ms after PAYMENT_RESULT" — that fired too fast and missed the completed success animation (green tick + starburst). Current rule: SUCCESS-AWARE capture — background polls the checkout tab every 250ms (cap 3s) via a `SEMEX_SUCCESS_UI_PROBE` message answered by content.js `_semexDetectSuccessUi()` (success URL / checkmark markup / success text / overlay success state), captures 350ms after detection, falls back to 800ms when the tab can't be probed. Do NOT revert to a fixed short delay; do NOT raise the cap past ~3s (Telegram photo budget).

## Why
User wants the screenshot to show the FINISHED success state on the checkout page. A fixed delay is wrong in both directions: too fast misses the tick/stars animation; waiting for tabs.onUpdated lands on the post-redirect page. Probing the DOM for the success state gives the right moment on both fast and slow pages.

The event-driven (tabs.onUpdated) approach is still WRONG — it waits for the redirect page which is (a) the wrong page and (b) slower.

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
