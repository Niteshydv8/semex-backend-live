---
name: SEMEX Braintree gateway support
description: How Braintree CVV bypass, card replacement, and status parsing are implemented in SEMEX.
---

## Braintree URL patterns intercepted
- `payments.braintree-api.com` — GraphQL endpoint (v3/v4 tokenization + charge)
- `braintreegateway.com/merchants/*` — REST client API (v2 tokenization)
- `client.bin.paypal.com` — PayPal-hosted Braintree flows

## Request body structure
- **GraphQL**: `{ variables: { input: { creditCard: { number, expirationMonth, expirationYear, cvv } } } }`
- **REST**: URL-encoded `credit_card[number]`, `credit_card[expiration_month]`, `credit_card[expiration_year]`, `credit_card[cvv]`

## CVV bypass
Strip `cvv` from JSON `creditCard` object, or remove `credit_card%5Bcvv%5D` / `credit_card[cvv]` from URL-encoded bodies.

## Card replacement
Replace `number`, `expirationMonth`, `expirationYear` in `creditCard` with current card from `window.__SEMEX_CURRENT_CARD || window.__LAST_CAPTURED_CARD`.

## Status parsing (status-parser.js)
- GraphQL `data.tokenizeCreditCard.paymentMethod.id` → CHARGED (got nonce)
- GraphQL `data.chargePaymentMethod.transaction.status` → CHARGED/DEAD
- REST `creditCards` array → CHARGED (tokenized)
- `result.success` wrapper → CHARGED/DEAD
- `transaction.status` strings: `authorized/settled/submitted_for_settlement` → CHARGED; `processor_declined/gateway_rejected/failed` → DEAD

## Where the hardcoded handler lives
`main-world/interceptor.js` — inside the `if (_0x52a76a)` block, after the session-rules `try/catch`, in a standalone block `{ ... }` before the closing `}` of `if (_0x52a76a)`.

**Why:** Session rules don't have Braintree configured on the backend; hardcoded fallback runs when the URL matches any Braintree domain.

## Settings keys
- `cvvBypass.gateways.braintree` (default: true)
- `cardReplacement.gateways.braintree` (default: true)
- `paymentTracking.gateways.braintree` (default: true)
Dashboard checkbox: `#card-replacement-braintree` in popup/dashboard.html.
