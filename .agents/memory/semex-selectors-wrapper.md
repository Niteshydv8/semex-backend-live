---
name: getSelectors wrapper shape — all consumers must unwrap
description: serverClient.getSelectors() returns {selectors, delays, iframe}; every consumer must use .selectors — a double-wrap in the cache path silently no-op'd fills
---

`serverClient.getSelectors(domain)` returns a **wrapper** object `{selectors: {...}, delays, iframe}`, never the raw selector map.

**Why:** the `__xcabuf` form-data cache (`fetchSingleFormData` in background.js) once stored the whole wrapper under the entry's `selectors` key. Downstream, `fillFormFromOverlay` passed it to `fillForm` as the selector map, so `selectors.cardNumber` / `.country` / `.email` were all `undefined` → every field fill silently skipped → `SEMEX_FILL_FORM_COMPLETE ok:true` still posted → overlay sat on "Waiting response..." with an empty form. The direct CHECK_CONFIG path unwrapped correctly, which made the bug intermittent-looking ("autofill works sometimes": cache-path fills never worked, push-path fills did).

**How to apply:**
- Any new consumer of `getSelectors()` must unwrap: `const s = (await getSelectors(d)).selectors`.
- `fillFormFromOverlay` has a defensive unwrap for legacy cache entries (unwraps one level when `.cardNumber` is missing but `.selectors` exists) — keep it.
- A fill with no usable selector map must fail loudly (`ok:false, error:"config_unavailable"`), never post fake success — silent no-fill cost a multi-session hunt.
- The selector map itself is verified against live Stripe `/c/pay/` DOM (top-frame old-UI ids `cardNumber/cardExpiry/cardCvc/billingName/billingCountry/email`) as of 2026-08-17 — Stripe serves top-frame fields on `/c/pay/`, iframe-rendered form only on `/g/pay/`.
