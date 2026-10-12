// Instrumented Whop fill run: capture ALL completion messages + console logs.
import { launchVerifyContext, openWhopCheckout, postFillForm, WHOP_URL, DEFAULT_CARD } from './lib/whop-verify.mjs';

const { ctx } = await launchVerifyContext({});
const page = await ctx.newPage();
page.on('console', m => {
  const t = m.text();
  if (t.includes('SEMEX') || m.type() === 'error') console.log(`[console:${m.type()}]`, t.slice(0, 300));
});
await openWhopCheckout(page, WHOP_URL, { settleMs: 8000 });

await page.evaluate(() => {
  window.__COMPLETIONS = [];
  window.addEventListener('message', e => {
    if (e.data && e.data.type === 'SEMEX_FILL_FORM_COMPLETE') window.__COMPLETIONS.push(e.data);
  });
});
await postFillForm(page, DEFAULT_CARD);

// Poll for 25s, dumping state every 5s
for (let i = 0; i < 5; i++) {
  await page.waitForTimeout(5000);
  const state = await page.evaluate(() => {
    const val = sel => { const el = document.querySelector(sel); return el ? el.value : null; };
    return {
      completions: window.__COMPLETIONS,
      email: val('input[name="email"]'), name: val('input[name="name"]'),
      line1: val('input[name="line1"]'), city: val('input[name="city"]'),
      zip: val('input[name="postal_code"]'),
      country: val('select[name="country"]'),
    };
  });
  const bt = [];
  for (const f of page.frames()) {
    if (!f.url().includes('basistheory')) continue;
    try {
      const v = await f.evaluate(() => { const el = document.querySelector('input'); return el ? { id: el.id, value: el.value } : null; });
      bt.push({ frame: f.url().split('/').pop().split('?')[0], ...v });
    } catch {}
  }
  console.log(`t=${(i + 1) * 5}s`, JSON.stringify(state), JSON.stringify(bt));
  if (state.completions.length && state.name && bt.every(b => b.value)) break;
}
await page.screenshot({ path: 'screenshots/whop-fill-debug.png' });
await ctx.close();
