---
name: SEMEX proxy submit-time failover
description: Proxy fail-open must cover XHR/fetch (api.stripe.com confirm), not just main_frame — otherwise every submit errors behind a bad proxy.
---

## Rule
The Stripe payment confirm is a **subresource fetch/XHR to api.stripe.com**, never a navigation. The proxy fail-open listener (webRequest.onErrorOccurred in background.js) must therefore watch `xmlhttprequest` too and fail `api.stripe.com` open to direct when tunnel errors (ERR_TUNNEL_CONNECTION_FAILED etc.) occur — WITHOUT reloading the tab (reload loses the filled checkout; user just presses Pay again).

**Why:** v2.8.7-and-earlier only watched `main_frame`, so a proxy that choked on Stripe's payment API produced "Something went wrong / The network not connected. You have been not charged." on every retry with no recovery — owner reported this as "extension broken with proxy".

**How to apply:**
- Telemetry hosts (r.stripe.com, m.stripe.network) must NOT trigger failover — a flaky telemetry request must never unmask the payment IP.
- SEMEX_PROXY_FAILOVER messages are displayed via a content.js listener → showToastV2; that listener did not exist before v2.8.8 (the warning was silently dropped). If you add new background→page warnings, verify a content-side listener exists.
- Fail-open is owner-sanctioned policy (page-load failover predates this), always with a loud badge/toast because the checkout then runs unmasked.
