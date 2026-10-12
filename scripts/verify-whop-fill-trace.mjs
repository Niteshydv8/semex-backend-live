// Fine-grained: poll field values every 500ms after fill trigger to catch
// transient fills wiped by React re-renders; also capture SW console.
import { chromium } from 'playwright';
import path from 'path';
const EXT_PATH = path.resolve('semex-build');
const WHOP_URL = process.env.WHOP_URL || 'https://whop.com/checkout/plan_gXTa5fieE3T1L';
const CARD = { number: '4242424242424242', month: '12', year: '2028', cvv: '123' };

const ctx = await chromium.launchPersistentContext('', {
  channel: 'chromium', executablePath: '/repl/tools/bin/chromium', headless: true,
  args: [`--disable-extensions-except=${EXT_PATH}`, `--load-extension=${EXT_PATH}`],
});
const sw = await ctx.waitForEvent('serviceworker', { timeout: 15000 }).catch(() => null);
const page = await ctx.newPage();
page.on('console', m => console.log(`[pg:${m.type()}]`, m.text().slice(0, 200)));
await page.goto(WHOP_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(12000);
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
await page.evaluate(card => window.postMessage({ type: 'SEMEX_FILL_FORM', card }, '*'), CARD);
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
