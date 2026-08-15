---
name: Stripe new checkout UI structure (habanero)
description: How Stripe's /g/pay/ checkout UI is structured and how to inspect/verify it — needed for any future Stripe selector or fill-flow work
---

Stripe's new checkout UI (rolled out 2025-2026, codename "dahlia" loader / "habanero" elements build):

- URLs are `checkout.stripe.com/g/pay/cs_live_...` (old UI: `/c/pay/`). Hostname-based detection is unaffected.
- The ENTIRE payment form (email, card, country, submit) renders inside ONE cross-origin iframe named `__privateStripeFrameNNNN` served from `js.stripe.com/v3/elements-inner-habanero-<hash>.html`. The top document has zero inputs.
- Fields use `payment-*Input` ids (`payment-numberInput`, `payment-expiryInput`, `payment-cvcInput`, `payment-nameInput`, `payment-countryInput`, `paymentForm-emailInput`) with `name=number/expiry/cvc/name/country/email` and `cc-*` autocomplete attrs. NO data-testids on fields.
- Payment methods are `.p-AccordionItem` divs inside `[data-testid="payment-accordion-wrapper"]`; selected item gets `AccordionItem--selected`; card method is identifiable by `[data-testid="visa"]` brand icons or "Card" label text. Method ordering is conditional (wallets/Link can sort first) — never trust positional first-match.
- Card inputs mount lazily AFTER the accordion expands; the accordion shell renders first.

**Why:** old selectors partially matched (expiry/cvc/number by name) but name/country broke → "partial fill" symptom; future Stripe UI churn will land in this same structure.

**How to apply:** verify selector changes against a live `/g/pay/` link. Playwright's `frame.evaluate()` works in cross-origin iframes (CDP automation ignores same-origin policy) — the testing subagent CAN dump/fill inside js.stripe.com frames, despite agents assuming it can't. Avoid `:has()` in extension querySelector strings — old Chrome throws on the whole selector list; do identity re-resolution in JS instead. Stripe live checkout links transiently render "Something went wrong" — retry/reload before concluding expiry.
