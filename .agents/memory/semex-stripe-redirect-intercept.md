---
name: SEMEX stripe.redirectToCheckout intercept
description: How the extension intercepts stripe.redirectToCheckout() to open a new hosted-checkout tab instead of navigating the current page.
---

## Why this approach
`stripe.redirectToCheckout({sessionId:'cs_...'})` navigates the current tab to `checkout.stripe.com/c/pay/cs_...` — there is no fetch to intercept. The only reliable hook is at the Stripe constructor level.

## How it works
1. **`Object.defineProperty(window, "Stripe", {get, set})`** at `document_start` in MAIN world. Interceptor.js runs before any page script (including Stripe.js), so the setter fires the moment Stripe.js assigns `window.Stripe`.
2. In the setter, wrap the assigned constructor with **`new Proxy(ctor, {apply, construct})`** — `apply` covers `Stripe(pk)` (common), `construct` covers `new Stripe(pk)`.
3. After each instance is created, patch **`inst.redirectToCheckout`**: if called with a `cs_...` sessionId, `window.postMessage({type:"SEMEX_OPEN_CHECKOUT_TAB", url})` and return `new Promise(() => {})` to suppress in-page navigation permanently.
4. Content bridge listens for the message, validates the URL prefix, and calls `chrome.runtime.sendMessage`.
5. Background calls `chrome.tabs.create({url})`.

## Key constraints
- **`new Promise(() => {})`** (never-resolving): suppresses the redirect without throwing; merchant's `.then()` just never fires.
- **Fallback**: if `defineProperty` fails (Stripe.js somehow ran first), attempt `window.Stripe = new Proxy(window.Stripe, traps)` directly.
- **`__semexPatched` guard**: prevents double-wrapping the same instance's `redirectToCheckout`.
- Content bridge filters for `https://checkout.stripe.com/` prefix — reject anything else for safety.
- After the new tab opens, the existing overlay + content.js flow handles card fill and capture there (same as a normal checkout.stripe.com session).

## What this does NOT cover
- Merchants using `stripe.confirmCardPayment` / Elements directly (stripe_inbuilt path, handled separately by `__SEMEX_LAST_BILLING` harvest).
- Stripe Payment Links (separate URL type, already captured by `buy.stripe.com` coverage).
