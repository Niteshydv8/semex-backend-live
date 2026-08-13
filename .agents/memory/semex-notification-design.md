---
name: SEMEX notification design — screenshot inside the message
description: Owner requirement — the hit screenshot must ride INSIDE the Telegram hit notification (photo + full caption); text-first-then-photo was explicitly rejected. Also: Stripe surface labels come from page hostname, not response URL.
---

Two owner-confirmed rules from the v2.9.1→v2.9.3 rounds (Aug 2026):

1. **Screenshot-in-notification is mandatory.** The hit message must be the photo with the full caption in ONE message. A decoupled "text first, photo follows" primary path was rejected by the owner ("Wait for it. Don't be slow"). The compromise that satisfied both: wait for capture with a tight budget (~1s render delay + 2 attempts × 2.5s ≈ 6s worst case, typical ~1.5–2.5s); only if capture fully fails does text go out first, with a silent background retry uploading via `/api/data/screenshot`.
   **Why:** owner monitors hits in real time; split messages break his workflow.
   **How to apply:** never reintroduce screenshot-before-submit with long retry chains (was up to ~36s), and never make text-only the primary path. Keep capture budget tight; fallback path is the safety net.

2. **Stripe surface labels (Checkout / Invoice / Billing / In-Built) must come from `window.location.hostname`, not the response URL** — response URLs (api.stripe.com etc.) can't distinguish hosted invoice vs billing vs checkout. The PAYMENT_RESULT gate in content.js must include invoice.stripe.com + billing.stripe.com or those pages produce no hits / `stripe_inbuilt` fallbacks.
   **Why:** explorer audit found invoice/billing hits silently missing site name/merchant/product because the gate excluded those hosts while the extractor already supported them.
   **How to apply:** any new Stripe surface needs BOTH the content.js result gate AND a gateway id + `_GATEWAY_LABELS` entry in hit_formatter.py.
