---
name: SEMEX overlay visibility is manifest-gated
description: Why the checkout overlay/popup doesn't appear on some Stripe surfaces and how to extend it.
---

## Rule
`content/overlay.js` self-guards (`window.SEMEX_OVERLAY_INJECTED`) and does NOT hardcode hostnames — it only appears where the MANIFEST injects it. Its content_scripts block matches a specific host list, so the overlay/"popup" is invisible on any Stripe surface not in that list.

To make the overlay + checkout detection work on a new Stripe-hosted surface, edit TWO places in lockstep:
1. `semex/manifest.json` → the overlay.js content_scripts `matches` (the host-restricted block).
2. `semex/content/interceptor.js` → `isCheckoutPage()` hostname check.

## Why
Stripe hosted invoices live on `invoice.stripe.com`; payment links on pay/buy/donate.stripe.com. Users reported "popup doesn't appear on invoice/inbuilt" purely because those hosts weren't in the overlay match list. v2.6.0 added `invoice.stripe.com` to both places.

## How to apply
Add the host to both files, then rebuild.

## Merchant-embedded Stripe (inbill-style) — covered since the embedded-detection fix
"Stripe inbuilt" (Payment Element on an arbitrary MERCHANT domain) is handled WITHOUT host matches: the interceptor only detects checkout-session API responses, which merchant-embedded Elements never produce on the top page — so the overlay trigger is DOM-based instead. `content.js` runs `_semexWatchEmbeddedStripe` (top frame only): a one-shot MutationObserver waits for a real Stripe payment **Element** iframe, then sends `INJECT_OVERLAY` (skips when `#semex-overlay[data-semex-live]` already exists). background's `INJECT_OVERLAY` handler `insertCSS`+`executeScript`s overlay.css/overlay.js into that tab. Fill dispatch for these pages is the FILL_FORM_SUBFRAMES branch in fillForm.

**The trigger MUST require `elements-inner` in the iframe src — NOT a bare `js.stripe.com` match.**
**Why:** merely loading Stripe.js injects a hidden CONTROLLER iframe (`js.stripe.com/v3/controller-*`) on ANY site — Replit's own billing, SaaS dashboards, blogs. A bare `js.stripe.com` check therefore popped the overlay on "every page" the user visited (reported 2026-08-18). Real Payment/Card Elements render as `elements-inner-*` iframes, which is the same marker fill-routing already keys on (content.js fill path + fill-routing.test.js) — so gating on `elements-inner` keeps the overlay-appears and the fill-works conditions in lockstep and kills the false positives.
**How to apply:** if a merchant-embedded checkout shows NO overlay, confirm its payment iframe src actually contains `elements-inner` (newer Stripe surfaces may rename it — update the marker in BOTH the watcher and the fill path together). If the overlay appears where it shouldn't, something widened the trigger back to bare `js.stripe.com`. Inbuilt HIT capture remains a separate interceptor/status-parser concern.
