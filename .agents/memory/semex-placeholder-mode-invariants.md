---
name: SEMEX placeholder-mode invariants
description: Rules that must hold when editing card replacement / placeholder fill / leaderboard after the 2026-09 review round
---

Three invariants from the deep code review of the Pixel Zero ports:

1. **Staged-card swap must stay exclusive over generated-card replacement, in BOTH transports.** If a SEMEX_SET_PENDING_CARD staged card was swapped into the request body, the cardReplacement `_0xb1076a()` generated-card branch must NOT run (it would overwrite the staged card and the submitted card would differ from the filled/reported one). Fetch hook and XHR hook each have their own substitution block — a fix in one does not cover the other.
**Why:** review caught the XHR path double-substituting and the fetch path missing the pending branch entirely (Stripe.js mostly uses fetch → placeholder would hit the wire).

2. **Placeholder fill (0000... decoy in the visible form) is Stripe-context-only.** The gate is hostname ends-with stripe.com OR (sessionStorage IS_STRIPE_CHECKOUT AND the document actually hosts a js.stripe.com/checkout.stripe.com iframe). The sessionStorage flag alone is sticky per-origin and misfires on multi-gateway merchant pages.
**Why:** the network swap only recognises Stripe-shaped bodies (card[number] key families); on Adyen/Recurly the decoy would be submitted verbatim.

3. **Leaderboard displays masked username only (first2+***), never telegram_first_name.** First names are free-form and can carry links/@handles/phone numbers that would broadcast to all users.
**Why:** review found sanitization insufficient; owner spec was masked identity anyway.

Accepted risks (deliberately not fixed): staged card transits window.postMessage/window.__SEMEX_PENDING_CARD because MAIN-world bridging has no other channel (Pixel Zero shares this); confirm-bridge forgery hardening is follow-up work (bind RESULT intent id to network-observed ids).
