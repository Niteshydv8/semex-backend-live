import { chromium } from 'playwright';
import path from 'path';
const EXT_PATH = path.resolve('semex-build');
const ctx = await chromium.launchPersistentContext('', {
  channel: 'chromium', executablePath: '/repl/tools/bin/chromium', headless: true,
  args: [`--disable-extensions-except=${EXT_PATH}`, `--load-extension=${EXT_PATH}`],
});
const sw = await ctx.waitForEvent('serviceworker', { timeout: 15000 }).catch(() => null);
if (!sw) { console.log('no SW'); process.exit(1); }
const res = await sw.evaluate(async () => {
  const out = {};
  for (const d of ['whop.com', 'www.whop.com']) {
    try {
      const r = await serverClient.getSelectors(d, false);
      out[d] = r && r.selectors ? Object.keys(r.selectors).length + ' keys; cardNumber=' + r.selectors.cardNumber : JSON.stringify(r);
    } catch (e) { out[d] = 'ERR ' + e.message; }
  }
  return out;
}).catch(e => ({ evalErr: String(e) }));
console.log(JSON.stringify(res, null, 1));
await ctx.close();
