---
name: Adding a merchant checkout gateway (Stripe-embedded vs Basis Theory)
description: What a new merchant checkout needs — and the Whop/Basis Theory exception
---

Two different merchant-checkout shapes exist; identify which one before touching code:

1. **Stripe-embedded merchant** (js.stripe.com elements-inner iframe on the page): only needs a `getSelectors()` profile (shared/server-client.js) + overlay manifest match. Card fill, decoy, and card replacement all work via the existing Stripe iframe path. Never add the merchant host to `isCheckoutPage`.

2. **Basis Theory merchant (Whop)** — verified live 2026-10-12 on whop.com/checkout/plan_*: card fields are js.basistheory.com hosted-elements iframes (one field per frame: #cardNumber / #expirationDate / #cvc); email/name/country/address are Whop's own React DOM (name=email/name/country/line1, autocomplete carries "billing " prefix). Stripe only loads controller/metrics frames, so NOTHING Stripe-shaped fires: not the overlay watcher, not the fill gate, not the network swap. Whop needed: gate entries (whop.com path-gated + basistheory.com always-true), subframe routing that ALSO fills the top frame, background dispatcher widened to basistheory frames, per-field fill success in BT iframes (full-card validation falsely fails single-field frames).

**Why:** the generic "merchant = embedded Stripe" assumption silently produces a checkout where the overlay never appears and fills no-op.
**How to apply:** for any "support site X" request, first inspect the live page's iframe inventory. Still NOT covered for Whop: card-replacement network swap (Basis Theory tokenize shape unobserved — real card is filled directly as fail-safe) and hit detection/screenshot forwarding (Whop confirm API shape unobserved).
