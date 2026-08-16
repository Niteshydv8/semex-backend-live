---
name: SEMEX embedded-checkout extractor
description: Owner-approved design — auto-open every detected embedded shareable Stripe checkout in a new tab; Stripe-only; Payment Element has no URL by design.
---

## Decisions (owner, v2.8.7, Aug 2026)
- Behavior: **auto-open immediately** when an embedded shareable checkout is detected. Owner explicitly accepted tabs popping on pricing pages — do NOT "fix" multi-tab behavior into a toast/gesture gate without asking.
- Scope: **Stripe only** (checkout.stripe.com cs_live_/cs_test_ extraction, buy/donate.stripe.com links, stripe-buy-button shadow DOM). Do not add Whop/Paddle/etc. unless asked.
- SEMEX's strength is Stripe's hosted checkout; merchant-page "locked" checkouts get reopened as full checkout pages so the whole pipeline (overlay/fill/capture) applies.

**Why:** extension only activates on checkout pages; embedded checkouts on arbitrary merchant pages were invisible to it.

**How to apply:**
- True embedded Stripe **Payment Element / Embedded Checkout has NO shareable URL** — impossible to reopen; keep the in-built fill path (`__SEMEX_LAST_BILLING` recovery) for those. Never promise otherwise.
- The background `SEMEX_OPEN_CHECKOUT_TAB` allow-list regex must include any host the extractor can emit, or tabs silently never open.

**Detection must be three-layered; DOM-only scanning misses real embeds.** A checkout session id (`cs_live_`/`cs_test_`) may never appear in a DOM-visible iframe src — site JS can hold it in inline scripts / data-attributes, and iframes get src assigned late. The extractor therefore scans: (1) iframes/buy-buttons + MutationObserver on node-adds AND src attribute changes, (2) inline script bodies + common session data-attributes (one bounded full-HTML fallback, once), (3) a background `webRequest` sub_frame watcher as the wire-level catch-all.
**Why:** v4.0.12-era DOM-only scanning missed submagic-style JS-embedded checkouts; owner expects "grab the link from their code".
**How to apply:** keep all three layers in sync when touching the extractor; never let one layer assume another caught it (shared background dedupe handles overlaps).

**MV3 duplicate suppression must persist in `chrome.storage.session`, not in-memory Maps.** Worker suspension wipes in-memory dedupe, so the same checkout reopens after a forced restart within the dedupe window.
**Why:** in-memory-only dedupe reopened the same checkout after a forced worker restart within the dedupe window.
**How to apply:** any background "don't do X twice within N seconds" guard: storage.session record + in-memory fast path + in-flight Set for the async race.

**Never regex-match webRequest URLs — parse `new URL().hostname`.** `documentUrl` is a full URL but `initiator` is a bare origin, and both may carry query/fragment straight after the host; slash-anchored regexes silently miss those forms.
**Why:** a host-plus-slash loop guard passed full-path parents but missed bare-origin and `?x=1`/`#x` parents.
**How to apply:** any host check against webRequest fields (loop guards, allow-lists) should parse the hostname and compare exactly.
