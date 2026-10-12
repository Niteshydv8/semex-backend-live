// Fine-grained: poll field values every 500ms after fill trigger to catch
// transient fills wiped by React re-renders; also capture SW console.
import { launchVerifyContext, openWhopCheckout, postFillForm, WHOP_URL, DEFAULT_CARD } from './lib/whop-verify.mjs';

const { ctx, sw } = await launchVerifyContext({});
const page = await ctx.newPage();
page.on('console', m => console.log(`[pg:${m.type()}]`, m.text().slice(0, 200)));
await openWhopCheckout(page, WHOP_URL, { settleMs: 8000 });
console.log('url after load:', page.url());

await page.evaluate(() => {
  window.__LOG = [];
  const els = () => ({
    name: document.querySelector('input[name="name"]')?.value,
    line1: document.querySelector('input[name="line1"]')?.value,
    zip: document.querySelector('input[name="postal_code"]')?.value,
    city: document.querySelector('input[name="city"]')?.value,
    email: document.querySelector('input[name="email"]')?.value,
  });
  window.__ELS = els;
  window.__LOG.push({ t: 0, ...els() });
});
await postFillForm(page, DEFAULT_CARD);
for (let i = 1; i <= 40; i++) {
  await page.waitForTimeout(500);
  await page.evaluate(t => window.__LOG.push({ t, ...window.__ELS() }), i * 500);
}
const log = await page.evaluate(() => window.__LOG);
let prev = '';
for (const row of log) {
  const s = JSON.stringify({ name: row.name, line1: row.line1, zip: row.zip, city: row.city, email: row.email });
  if (s !== prev) { console.log(`t=${row.t}ms`, s); prev = s; }
}
// SW state: what did the background cache?
if (sw) {
  const cache = await sw.evaluate(async () => new Promise(r => chrome.storage.session.get('__xcabuf', r))).catch(e => String(e));
  console.log('SW __xcabuf:', JSON.stringify(cache).slice(0, 500));
}
await ctx.close();
