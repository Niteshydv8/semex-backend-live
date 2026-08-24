---
name: SEMEX send_photo caption truncation
description: Why raw-string length cap in send_photo breaks CHARGED hit delivery and shows raw HTML in Telegram
---

# send_photo caption: raw vs visible length

## The rule
`send_photo` must cap on **visible text length** (after stripping HTML tags), NOT raw HTML string length.

**Why:** Telegram's caption limit is 1024 *visible* characters after entity parsing — not raw HTML. A Stripe checkout success URL has many `&`-separated query params, making the `<a href="...">` raw HTML much longer than the visible text. The previous `len(caption) > 1024` check compared raw HTML length. For a CHARGED hit:
- `_photo_caption()` confirms visible ≤ 1024 → passes full HTML to `send_photo`
- `send_photo` sees raw length > 1024 → truncates at char 1021 + `"..."`
- The truncation cuts *inside* the `<a href="https://checkout.stripe.com/g/pay/long-url">` opening tag, before the closing `>`
- First send: Telegram rejects the malformed HTML (unclosed tag) with 400 parse error
- Plaintext retry: `_strip_html` uses `re.sub(r"<[^>]+>", "", text)` — the regex requires a closing `>` to match; the tag has none → `<a href="http...` stays in the stripped text → Telegram delivers it as plaintext with raw HTML visible
- On *photo* sends (CHARGED hits): this failure repeats on every outbox retry → the hit **never delivers** to Telegram

## The combined root cause (two bugs together)
1. `_mask_success_url()` didn't escape `&` → `&amp;` in href → makes HTML invalid regardless of truncation
2. `send_photo` capped on raw length → truncates mid-tag when href URL is long

Either bug alone could cause parse errors. Together they guaranteed failure for CHARGED hits with Stripe checkout success URLs.

## Fix
- `hit_formatter._mask_success_url`: escape `&` → `&amp;` in the href URL string
- `telegram.send_photo`: replace raw-length check with visible-length check using `re.sub(r"<[^>]+>", "", caption)`

## How to apply
Any future edit to caption-length logic in `send_photo` or `send_message` must use visible-text measurement, not `len(raw_html)`. The `_strip_html` helper in `telegram.py` can be reused for this.
