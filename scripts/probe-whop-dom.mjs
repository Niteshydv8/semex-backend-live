// Probe the live Whop checkout DOM to find correct selectors.
import { chromium } from 'playwright';
const WHOP_URL = process.env.WHOP_URL || 'https://whop.com/checkout/plan_gXTa5fieE3T1L';
const ctx = await chromium.launchPersistentContext('', {
  channel: 'chromium', executablePath: '/repl/tools/bin/chromium', headless: true,
});
const page = await ctx.newPage();
await page.goto(WHOP_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(12000);
const dump = await page.evaluate(() => {
  const attrs = el => ({ tag: el.tagName, id: el.id, name: el.name, type: el.type, ac: el.getAttribute('autocomplete'), ph: el.placeholder, visible: !!(el.offsetWidth || el.offsetHeight) });
  return {
    inputs: Array.from(document.querySelectorAll('input')).map(attrs).filter(a => a.visible || a.type !== 'hidden'),
    selects: Array.from(document.querySelectorAll('select')).map(attrs),
  };
});
console.log(JSON.stringify(dump, null, 1));
// Expiry iframe internals
for (const f of page.frames()) {
  if (!f.url().includes('basistheory')) continue;
  try {
    const info = await f.evaluate(() => Array.from(document.querySelectorAll('input')).map(el => ({ id: el.id, name: el.name, ac: el.getAttribute('autocomplete'), ph: el.placeholder })));
    console.log(f.url().split('/').pop().split('?')[0], JSON.stringify(info));
  } catch (e) { console.log('frame err', e.message); }
}
await ctx.close();
