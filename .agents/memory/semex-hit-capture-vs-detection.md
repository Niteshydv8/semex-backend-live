---
name: SEMEX hit capture vs detection (Stripe checkout vs inbuilt)
description: Which Stripe hit fields come from where, and why stripe_inbuilt (SetupIntent) fields arrive empty.
---

## The two Stripe paths capture data very differently
- **Hosted checkout / invoice** (`checkout.stripe.com`, `/payment_pages/`, invoice API): the interceptor builds a full `siteInfo` {merchant, amount, currency, productName, successUrl, customerEmail} from the checkout/invoice RESPONSE (invoice.lines, account_settings.display_name, customer_email) and caches it. Hit assembly reads merchant/productName/successUrl ONLY from that cached siteInfo. This path is complete.
- **stripe_inbuilt** (Stripe Elements confirming a SetupIntent `seti_` or a PaymentIntent): the API response has NO amount / line-items / customer_email / success_url, and the hosted-checkout siteInfo path never runs. So productName, successUrl and customerEmail arrive EMPTY unless recovered elsewhere. Merchant + amount only survive because they already have DOM-scrape fallbacks (`_semexScrapeMerchant`, `_semexScrapeAmountFromDom`).

## How the empty inbuilt fields are recovered (the fix)
- **customerEmail + successUrl**: harvested from the OUTGOING confirm request — the SAME body the card is captured from — via `payment_method_data[billing_details][email]` / `receipt_email` and `return_url`. Stashed on `window.top.__SEMEX_LAST_BILLING` (mirrors `__LAST_CAPTURED_CARD`, with a window fallback when window.top is cross-origin), consumed during hit assembly with a short freshness window, fill-only-empty. The harvest lives at the top of the request-body card extractor so it covers fetch + XHR.
- **customerEmail** also falls back to a visible `input[type=email]` on the merchant page.
- **productName**: conservative product-summary DOM scrape only (explicit product/line-item selectors, never og:title/document.title which would just echo the merchant). A bare card-setup SetupIntent legitimately has no product, so it may stay N/A.

## Rules
- An empty inbuilt field is a RESPONSE-SHAPE / extraction gap, NOT a status-detection failure — the hit still forwards fine. Do NOT touch detection or 3DS to fix empty fields.
- Only ever FILL empty fields; never overwrite a value already found via response/cache, so hosted-checkout hits stay unaffected.
- Amount for a SetupIntent comes only from the DOM scrape (there is no amount on the intent) — verify against the page if it looks wrong.
- **Why:** SetupIntents carry no charge/line-item/email/return data; only the confirm request body and the page DOM have it. The TextEncoder capture path is Adyen-specific (`generationtime`), so Stripe billing harvest belongs on the fetch/XHR request-body path, not there.
