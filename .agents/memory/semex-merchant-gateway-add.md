---
name: Adding a merchant-embedded Stripe gateway (e.g. Whop)
description: What a new merchant-embedded Stripe checkout needs — and what it must NOT touch
---

To support a merchant site whose checkout is an embedded Stripe Payment Element (e.g. whop.com/checkout/*), only two changes are needed:

1. A domain profile in `getSelectors()` (shared/server-client.js) with the merchant's own-DOM fields (email/name/address via autocomplete attrs) + `iframe: true`.
2. The merchant's checkout path added to the `main-world/overlay.js` manifest matches (e.g. `*://whop.com/checkout/*`) for deterministic overlay injection.

Do NOT add the merchant host to `isCheckoutPage` in main-world/interceptor.js — the top frame's own API traffic would get misparsed as payment responses. Hit detection, card replacement, and screenshot capture all run inside the js.stripe.com elements-inner iframe, which is already a checkout context.

**Why:** card fill, decoy pre-fill, and card-replacement gating all execute in the Stripe iframe via canonical-selector override (`_semexIsEmbeddedStripe`) — merchant profiles only matter for the merchant's own DOM fields.
**How to apply:** any future "support site X" request where X embeds Stripe — check first whether the generic watcher + iframe path already covers it before adding host logic.
