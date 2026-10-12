---
name: SEMEX Whop decline verification
description: The observed Whop merchant checkout is in test mode — Stripe decline test cards return "completed"; decline path must be verified by route-mocking the /confirm response.
---

The Whop merchant checkout used for live verification (whop.com/checkout/plan_*) runs in a mode where the Stripe decline test cards 4000000000000002 and 4000000000009995 both returned status "completed". Luhn-invalid cards are rejected client-side by Basis Theory and never reach /confirm. A genuine issuer-decline body has NOT been observed.

**Why:** live decline-shape verification is blocked on having a real dead card or a live-mode merchant.

**How to apply:** verify the Whop decline path with scripts/verify-whop-decline-mocked.mjs (route-mocks only the /confirm response; everything upstream is live). Effective Whop statuses live in BOTH semex/shared/server-client.js fetchSessionRules() (takes precedence when session rules load) and status-parser.js defaults — keep failureStatuses (incl. declined/requires_payment_method/incomplete) and skipStatuses (incl. requires_action/requires_confirmation) in sync in both places.

Also: ALWAYS rebuild semex-build (semex/build.sh https://api.semxhitter.pw) before any live verify script — a stale build silently drops hits (no whop parser → parse returns null) and looks like a detection bug.
