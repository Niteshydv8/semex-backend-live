---
name: SEMEX screenshot capture timing
description: When to capture the checkout screenshot after a payment hit — success-aware, never fixed-delay, never redirect-driven.
---

## Rule
Capture the hit screenshot when the checkout page's SUCCESS UI (green tick/starburst) is actually visible — detected via a content-script DOM probe — not at a fixed delay, and never keyed off page navigation.

**Why:** a fixed short delay fires before the success animation finishes (misses the tick/stars); waiting for navigation lands on the post-redirect page, which is the wrong shot. The user wants the finished success state on the checkout page itself.

**How to apply:** poll the page for success indicators with a hard cap (~3s, bounded by the Telegram photo budget), capture shortly after detection, and keep a modest fixed fallback for pages where the content script can't answer. Keep the capture attempts focused/timeout-guarded as they are — captureVisibleTab fails fast on inactive tabs, so focus-and-retry is safe.

**Also:** the saved-BIN offline cache holds CVVs — it is owner-tagged (userProfile identity) and must never be served or merged across accounts; auth failures (401) never see the cache, and logout purges cache + token + profile. Any new cache of account-scoped payment data must follow the same ownership rule.
