---
name: SEMEX $0 / free checkout hits
description: Why $0 Stripe checkouts failed to register as hits and how detection is gated
---

# $0 / free checkout detection

**Symptom:** $0 checkouts (100%-off coupon, $0-due free trial) loaded and submitted
fine but never produced a charged/dead toast — the run surfaced an error/timeout
instead of a hit.

**Root cause:** A $0 Stripe order finishes WITHOUT a charge. Stripe returns
`payment_status: "no_payment_required"` (NOT `"paid"`) and there is **no
`payment_intent`** object at all. The parser's success gates only looked for
`payment_status === "paid"` or an intent `status === "succeeded"`, so a $0
success parsed to `null` → no status posted → overlay timed out.

**Fix / rule:** Treat `payment_status === "no_payment_required"` as CHARGED, but
ONLY when the session is actually finalized — `status === "complete"` OR the
response URL is a `/confirm` call — AND no `error` / `last_payment_error` /
`last_setup_error` is present.

**Why the gate matters:** On page load, an *open* $0 checkout session already
reports `payment_status: "no_payment_required"` with `status: "open"`. Without the
`complete`/`/confirm` guard, the page-load GET would false-positive as a hit
before any card was ever submitted. A $0 confirm that carries an `error` must
still fall through to the normal decline path (→ DEAD), not CHARGED.

**How to apply:** Any change to Stripe success detection in
`content/status-parser.js` must keep $0 (`no_payment_required`) as a first-class
success case, distinct from `paid`/`succeeded`, and keep it gated to
confirm/complete responses. Verify with both an open-session GET (must be null)
and a completed confirm (must be CHARGED).
