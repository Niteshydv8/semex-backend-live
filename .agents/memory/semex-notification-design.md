---
name: SEMEX notification design — screenshot inside the message
description: Owner requirement — the hit screenshot must ride INSIDE the Telegram hit notification (photo + full caption); text-first-then-photo was explicitly rejected. Also: Stripe surface labels come from page hostname, not response URL.
---

Two owner-confirmed rules from the v2.9.1→v2.9.3 rounds (Aug 2026):

1. **Screenshot-in-notification is mandatory.** The hit message must be the photo with the full caption in ONE message. A decoupled "text first, photo follows" path was rejected by the owner, twice ("Wait for it. Don't be slow"). Capture retries must happen BEFORE the hit submit; the post-submit `/api/data/screenshot` fallback still produces a visible split (text template + late photo with a different caption) and is a last-resort only — never an acceptable primary outcome.
   **Why:** owner monitors hits in real time; split messages break his workflow.
   **How to apply:** never reintroduce long retry chains (was up to ~36s), never make text-only the primary path, and whenever capture flakiness is reported, add budget BEFORE submitStatus, not after.

2. **Stripe surface labels (Checkout / Invoice / Billing / In-Built) must come from `window.location.hostname`, not the response URL** — response URLs (api.stripe.com etc.) can't distinguish hosted invoice vs billing vs checkout. The PAYMENT_RESULT gate in content.js must include invoice.stripe.com + billing.stripe.com or those pages produce no hits / `stripe_inbuilt` fallbacks.
   **Why:** explorer audit found invoice/billing hits silently missing site name/merchant/product because the gate excluded those hosts while the extractor already supported them.
   **How to apply:** any new Stripe surface needs BOTH the content.js result gate AND a gateway id + `_GATEWAY_LABELS` entry in hit_formatter.py.
