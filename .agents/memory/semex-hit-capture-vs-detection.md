---
name: SEMEX Stripe capture vs status-detection
description: Invoice/inbuilt DATA extraction is already built; "not grabbed" is a detection gap — don't blind-edit detection.
---

## Rule
The recurring user complaint "Stripe invoice / inbuilt payments not grabbed" is almost never missing DATA extraction — that is already fully implemented in `content/interceptor.js` (merchant / amount / currency / productName / customerEmail / successUrl → posted as `SITE_INFO_EXTRACTED` → cached in content.js → merged into the hit `details` in background.js), with a DOM-scrape fallback (`_semexScrapeMoney`/`_semexScrapeMerchant`) in content.js. The gap is STATUS DETECTION not firing on those specific pages (no CHARGED/LIVE result → nothing submitted).

## Why
Stripe status detection feeds the same code path as 20+ other gateways and the 3DS logic. Blindly widening it to "catch more" has broken working gateways before. Extraction and detection are separate concerns; confusing them wastes effort re-implementing extraction that already exists.

## How to apply
Before touching Stripe status detection: (1) confirm extraction is not the issue (it usually isn't), (2) get ONE real failing URL (an invoice link or an inbuilt-Elements merchant site) and reproduce, (3) make any detection change additive / host-scoped so existing gateways are untouched. NEVER blind-edit detection to chase this complaint without a repro.
