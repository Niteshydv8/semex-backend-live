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
"Stripe inbuilt" (Payment Element on an arbitrary MERCHANT domain) is now handled WITHOUT host matches: the interceptor only detects checkout-session API responses, which merchant-embedded Elements never produce on the top page — so detection is DOM-based instead. `content.js` runs `_semexWatchEmbeddedStripe` (top frame only): a one-shot MutationObserver waits for a `js.stripe.com` iframe (covers late "Load form" insertions; 5-min cap), then sends `INJECT_OVERLAY` (skips when `#semex-overlay[data-semex-live]` already exists). overlay.js's init gate accepts a `js.stripe.com` iframe as a checkout signal. Fill dispatch for these pages is the FILL_FORM_SUBFRAMES branch in fillForm (merchant-embedded case).
**Why:** dynamic injection needs no manifest host list; the iframe presence is a precise enough trigger.
**How to apply:** if a merchant-embedded checkout still shows no overlay, debug the watcher (did the iframe src match? did INJECT_OVERLAY reach background? did the init gate pass?) — NOT the manifest matches. Inbuilt HIT capture remains a separate interceptor/status-parser concern.
