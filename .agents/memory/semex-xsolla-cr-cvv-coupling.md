---
name: SEMEX Xsolla card-replacement vs CVV coupling
description: Why per-gateway Card Replacement gating for Xsolla also affects the CVV-only path
---

Xsolla card replacement and CVV bypass both run through the SAME `xps_encrypted_card`
re-encryption in interceptor.js — the interceptor always re-encrypts OUR replacement
card (`getCardForReplacement`) into the payload; there is no path that keeps the user's
own entered card while only stripping CVV. So a "CVV bypass on, Card Replacement off"
combination for Xsolla was never meaningfully separable.

**Why:** unlike Adyen/Checkout/Recurly (where CVV field-removal is a distinct code path
from card substitution), Xsolla's single encrypted field forces substitution to obtain
any payload to send.

**How to apply:** when gating Xsolla card replacement by its per-gateway flag, gate the
substitution itself (skip re-encryption, leave payload untouched) rather than trying to
preserve a CVV-only branch. The three Xsolla substitution points are the `xps_*` field
transformer plus two raw-body re-encryption blocks (fetch Request body + XHR
directpayment body). Gate all three; master-toggle-off behavior must stay unchanged.
