// End-to-end verification of the Whop DECLINE path.
// A real bank decline cannot be forced against the observed merchant (their
// checkout completes all Luhn-valid test cards — verified live 2026-10-12 with
// 4000000000000002 and 4000000000009995 both returning status "completed").
// So this variant drives the REAL built extension against the REAL Whop
// checkout page, but route-mocks ONLY the final confirm response with the
// realistic decline envelope; everything upstream (session, Basis Theory
// tokenization, confirmation_tokens) is live. Asserts PAYMENT_STATUS_DETECTED
// fires with DEAD and the decline message.
import { chromium } from 'playwright';
import path from 'path';

const EXT_PATH = path.resolve('semex-build');
const WHOP_URL = process.env.WHOP_URL || 'https://whop.com/checkout/plan_gXTa5fieE3T1L';
// Realistic bank-decline envelope (Stripe-style card_error, as observed for
// other 4xx confirm failures; message mirrors a generic issuer decline).
const DECLINE_BODY = JSON.stringify({
  error: { type: 'card_error', message: 'Your card was declined.', code: 'card_declined', decline_code: 'generic_decline' },
});
const DECLINE_HTTP = Number(process.env.WHOP_DECLINE_HTTP || 402);

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
  if (/SEMEX|PAYMENT|HIT/i.test(t)) console.log('[pg]', t.slice(0, 250));
});

// Mock ONLY the confirm call; let every other request hit the live site.
let confirmIntercepted = false;
await page.route(/checkout_sessions\/[^/]+\/confirm/, route => {
  confirmIntercepted = true;
  console.log('[mock] intercepting confirm ->', DECLINE_HTTP, DECLINE_BODY);
  route.fulfill({ status: DECLINE_HTTP, contentType: 'application/json', body: DECLINE_BODY });
});

await page.goto(WHOP_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => Array.from(document.querySelectorAll('iframe')).some(f => (f.src || '').includes('card-number-element')), { timeout: 40000 });
await page.waitForTimeout(4000);

await page.evaluate(() => {
  window.__hits = [];
  window.addEventListener('message', e => {
    if (e.data && (e.data.type === 'PAYMENT_STATUS_DETECTED' || e.data.type === 'SEMEX_NETWORK_RESPONSE')) {
      window.__hits.push({ type: e.data.type, status: e.data.status, gateway: e.data.gateway, declineReason: e.data.declineReason, url: (e.data.url || '').slice(0, 100) });
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
  document.querySelectorAll('#semex-overlay, [id*="semex"]').forEach(el => { try { el.style.pointerEvents = 'none'; } catch {} });
});
await page.waitForTimeout(800);
await page.getByRole('button', { name: /get access/i }).click();
console.log('clicked Get access; waiting 25s...');
await page.waitForTimeout(25000);

const hits = await page.evaluate(() => window.__hits);
console.log('\n===== EXTENSION HIT EVENTS =====');
console.log(JSON.stringify(hits, null, 1));
// Strict: the DEAD event must come from the mocked whop confirm call itself,
// with the decline reason surfaced — not from any unrelated failure.
const dead = hits.find(h =>
  h.type === 'PAYMENT_STATUS_DETECTED' &&
  h.status === 'DEAD' &&
  h.gateway === 'whop' &&
  /checkout_sessions\/[^/]+\/confirm/.test(h.url || '') &&
  /card was declined/i.test(h.declineReason || ''));
const ok = confirmIntercepted && !!dead;
console.log('\nconfirm intercepted by mock:', confirmIntercepted);
console.log('DEAD event from whop confirm with decline reason:', !!dead, dead && JSON.stringify(dead));
console.log(ok ? 'PASS: decline surfaced as DEAD' : 'FAIL: decline missing or mislabeled');
await page.screenshot({ path: 'screenshots/whop-decline-mocked.png' });
await ctx.close();
process.exit(ok ? 0 : 1);
