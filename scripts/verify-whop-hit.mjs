// End-to-end verification: built extension loaded, real Whop checkout,
// trusted fill + terms + submit. Watches page console + service worker for
// the hit pipeline firing (PAYMENT_STATUS_DETECTED -> PAYMENT_RESULT).
import { chromium } from 'playwright';
import path from 'path';

const EXT_PATH = path.resolve('semex-build');
const WHOP_URL = process.env.WHOP_URL || 'https://whop.com/checkout/plan_gXTa5fieE3T1L';

const ctx = await chromium.launchPersistentContext('', {
  channel: 'chromium', executablePath: '/repl/tools/bin/chromium', headless: true,
  args: [`--disable-extensions-except=${EXT_PATH}`, `--load-extension=${EXT_PATH}`, '--no-first-run'],
});
let sw = ctx.serviceWorkers()[0];
if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 15000 }).catch(() => null);
console.log('service worker:', sw ? sw.url() : 'NONE');
if (sw) sw.on('console', m => console.log('[sw]', m.text().slice(0, 250)));

const page = await ctx.newPage();
page.on('console', m => {
  const t = m.text();
  if (/SEMEX|PAYMENT|HIT|screenshot|toast/i.test(t)) console.log('[pg]', t.slice(0, 250));
});
await page.goto(WHOP_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => Array.from(document.querySelectorAll('iframe')).some(f => (f.src||'').includes('card-number-element')), { timeout: 40000 });
await page.waitForTimeout(4000);

// Listen for the extension's own status broadcast (proves detection fired).
await page.evaluate(() => {
  window.__hits = [];
  window.addEventListener('message', e => {
    if (e.data && (e.data.type === 'PAYMENT_STATUS_DETECTED' || e.data.type === 'SEMEX_NETWORK_RESPONSE')) {
      window.__hits.push({ type: e.data.type, status: e.data.status, gateway: e.data.gateway, url: (e.data.url || '').slice(0, 100) });
    }
  });
});

for (const frame of page.frames()) {
  const u = frame.url();
  if (!u.includes('js.basistheory.com')) continue;
  const id = u.includes('card-number') ? 'cardNumber' : u.includes('expiration') ? 'expirationDate' : u.includes('verification') ? 'cvc' : null;
  if (!id) continue;
  const digits = id === 'cardNumber' ? '4242424242424242' : id === 'expirationDate' ? '1228' : '123';
  const input = await frame.$('input');
  await input.click();
  await input.type(digits, { delay: 40 });
}
await page.evaluate(() => {
  const setIn = (el, val) => {
    const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    el.focus(); s.call(el, val);
    el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertFromPaste', data: val }));
    el.dispatchEvent(new Event('change', { bubbles: true })); el.blur();
  };
  const setSel = (el, val) => {
    const s = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
    el.focus(); s.call(el, val);
    el.dispatchEvent(new Event('change', { bubbles: true })); el.blur();
  };
  document.querySelectorAll('input[name="email"]').forEach(el => setIn(el, 'support@semex.pro'));
  document.querySelectorAll('input[name="name"]').forEach(el => setIn(el, 'Test Person'));
  document.querySelectorAll('input[name="line1"]').forEach(el => setIn(el, '1 Main St'));
  document.querySelectorAll('input[name="city"]').forEach(el => setIn(el, 'New York'));
  document.querySelectorAll('input[name="postal_code"], input[name="postalCode"]').forEach(el => setIn(el, '10001'));
  document.querySelectorAll('select[name="country"]').forEach(el => setSel(el, 'US'));
  document.querySelectorAll('select[name="state"]').forEach(el => {
    const o = Array.from(el.options).find(o => /new york/i.test(o.text) || o.value === 'NY');
    if (o) setSel(el, o.value);
  });
});
await page.waitForTimeout(1000);
await page.evaluate(() => {
  document.querySelectorAll('input[type="checkbox"], [role="checkbox"]').forEach(c => {
    if (!(c.checked || c.getAttribute('aria-checked') === 'true')) c.click();
  });
  // keep SEMEX overlays from swallowing the click
  document.querySelectorAll('#semex-overlay, [id*="semex"]').forEach(el => { try { el.style.pointerEvents = 'none'; } catch {} });
});
await page.waitForTimeout(800);
await page.getByRole('button', { name: /get access/i }).click();
console.log('clicked Get access; waiting 40s...');
await page.waitForTimeout(40000);
const hits = await page.evaluate(() => window.__hits);
console.log('\n===== EXTENSION HIT EVENTS =====');
console.log(JSON.stringify(hits, null, 1));
const sawHit = hits.some(h => h.type === 'PAYMENT_STATUS_DETECTED');
const sawNet = hits.some(h => h.type === 'SEMEX_NETWORK_RESPONSE' && /checkout_sessions.*confirm/.test(h.url));
console.log('\nPAYMENT_STATUS_DETECTED fired:', sawHit);
console.log('confirm response captured:', sawNet);
await page.screenshot({ path: 'screenshots/whop-hit-verify.png' });
await ctx.close();
process.exit(sawHit ? 0 : 1);
