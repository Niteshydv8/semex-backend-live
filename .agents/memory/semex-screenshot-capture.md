---
name: SEMEX screenshot capture timing
description: When/how to capture the checkout screenshot after a payment hit — success-aware probe, settle scaled by UI kind, tolerant of transient probe errors.
---

## Rule
Capture the hit screenshot when the checkout page's SUCCESS UI is actually visible — detected via the content-script DOM probe (SEMEX_SUCCESS_UI_PROBE) — not at a fixed delay and never keyed off page navigation. Background polls the probe (~200ms), caps the wait (~3.5s), then settles before shooting.

**Why:** a fixed short delay fires before Stripe's green tick + starburst finish drawing (misses the tick); waiting for navigation lands on the post-redirect merchant page (wrong shot). The user wants the finished success state on the checkout page itself.

## Two gotchas that caused "too fast / too late"
1. **Never abort the poll on a single transient probe error.** The old loop did `catch { break; }` — one failed sendMessage (which happens exactly as the success page navigates/re-renders) bailed the whole wait and shot the pre-tick spinner. Keep polling through transient errors; only give up if a content script was NEVER reachable (bounded consecutive-fail count so the fixed fallback still fires inside the notification budget).
2. **Scale the settle to WHAT was detected.** The animated green tick+starburst ("tick") needs ~600ms to draw crisp; a static success/thank-you page needs only ~350ms; an unreachable tab gets ~800ms; a probed-but-never-confirmed timeout shoots at the cap. `_semexDetectSuccessUi()` returns a "kind" (tick|overlay|text|url) or null, checked tick-first so an animated tick is never mislabelled when a success URL is also present. The probe listener returns a strictly-boolean `ready` plus a `tick` flag.

## Guard-test coupling (semex/content/success-ui-probe.test.js)
The test brace/paren-extracts the real detector, listener, and the background probe block and EXECUTES them. A future edit must keep these or the extraction/asserts break:
- The probe block must still contain the literals `350` and `800` and `SEMEX_SUCCESS_UI_PROBE`, and stay runnable as `async (_tabIdForShotEarly, chrome) => { ...block... }` (reference only those two + globals, no other outer vars).
- No `{` or `}` in comments between the block's opening brace and the `const _semexWaitT0 = Date.now();` marker — `extractBlockBeforeMarker` walks back to the nearest brace and a comment brace corrupts the extraction.
- The Part C mock returns `{ ready }` with no `tick`, so the non-tick "ready" settle must stay 350ms (asserts settle gap >= 330ms). Detector must keep returning truthy/null and `ready` must stay boolean. Note: the 600ms tick path is NOT separately asserted (D-group only checks >=330), so a tick->350 regression would pass silently.

**Also:** the saved-BIN offline cache holds CVVs — it is owner-tagged (userProfile identity) and must never be served or merged across accounts; auth failures (401) never see the cache, and logout purges cache + token + profile. Any new cache of account-scoped payment data must follow the same ownership rule.
