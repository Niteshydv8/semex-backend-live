---
name: SEMEX embedded checkout fill gate
description: Cross-origin Stripe iframes have their own sessionStorage; top-frame gates/routing must detect embedded checkouts by iframe presence, not by session flags.
---

## Rule
On merchant pages embedding a Stripe Payment Element, any top-frame logic that gates or routes on "is this a checkout" must detect the checkout by looking for a `js.stripe.com` iframe in the DOM — never by reading `sessionStorage.IS_STRIPE_CHECKOUT`.

## Why
`sessionStorage` is per-origin. The interceptor sets `IS_STRIPE_CHECKOUT` inside the cross-origin js.stripe.com iframe, so the top frame's copy never flips. Every top-frame check based on it silently misclassifies merchant embedded checkouts (fills abort, gateway mislabels as "stripe_inbuilt", etc.). In the iframe, `document.referrer` is the only way to see the embedding page's host.

## How to apply
- Top frame: `document.querySelectorAll("iframe")` → any `src` including `js.stripe.com` means an embedded Stripe checkout is present; route fills via `FILL_FORM_SUBFRAMES` (top-frame `querySelector` can never reach cross-origin card fields).
- Inside the js.stripe.com iframe: use `document.referrer` to learn which Stripe surface (checkout/invoice/billing) embedded it.
- Toasts/notifications injected into arbitrary merchant pages must not use `backdrop-filter` — it bleeds the page's background (white bleed on light-themed pages); use solid backgrounds.
