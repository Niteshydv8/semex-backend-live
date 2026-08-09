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
Add the host to both files, then rebuild. **Caveat:** "Stripe inbuilt" (Elements on an arbitrary MERCHANT domain) can NOT be covered by an overlay host-match — overlay only injects on fixed stripe.com hosts. Inbuilt hits are captured by the all_urls interceptor (api.stripe.com response detection) + status-parser, which is a separate concern from overlay visibility. If inbuilt hits "don't grab," debug the interceptor/status-parser, not the overlay matches.
