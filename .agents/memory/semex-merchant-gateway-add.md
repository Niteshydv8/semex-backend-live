---
name: Adding a merchant checkout gateway (Stripe-embedded vs Basis Theory)
description: What a new merchant checkout needs — and the Whop/Basis Theory exception
---

Two different merchant-checkout shapes exist; identify which one before touching code:

1. **Stripe-embedded merchant** (js.stripe.com elements-inner iframe on the page): only needs a `getSelectors()` profile (shared/server-client.js) + overlay manifest match. Card fill, decoy, and card replacement all work via the existing Stripe iframe path. Never add the merchant host to `isCheckoutPage`.

2. **Basis Theory merchant (Whop)** — verified live 2026-10-12 on whop.com/checkout/plan_*: card fields are js.basistheory.com hosted-elements iframes (one field per frame: #cardNumber / #expirationDate / #cvc); email/name/country/address are Whop's own React DOM (name=email/name/country/line1, autocomplete carries "billing " prefix). Stripe only loads controller/metrics frames, so NOTHING Stripe-shaped fires: not the overlay watcher, not the fill gate, not the network swap. Whop needed: gate entries (whop.com path-gated + basistheory.com always-true), subframe routing that ALSO fills the top frame, background dispatcher widened to basistheory frames, per-field fill success in BT iframes (full-card validation falsely fails single-field frames).

**Why:** the generic "merchant = embedded Stripe" assumption silently produces a checkout where the overlay never appears and fills no-op.
**How to apply:** for any "support site X" request, first inspect the live page's iframe inventory. Whop card replacement IS implemented (2026-10-12): pending-card staged in BOTH the BT iframe and the whop.com top window (tokenize origin varies by SDK build), decoy must be luhn-valid 4111… (BT validates client-side; zeros block submit), swap shape-gated on {type:'card',data:{number…}} per public BT docs — NOT yet verified on a live tokenize. Still NOT covered: Whop hit detection/screenshot forwarding (confirm API shape unobserved).
