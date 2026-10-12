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
const swLogs = [];
if (sw) sw.on('console', m => { const t = m.text().slice(0, 250); swLogs.push(t); console.log('[sw]', t); });

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

// Drive the extension's OWN fill path (SEMEX_FILL_FORM with an explicit card,
// exactly what the overlay sends) instead of typing into the Basis Theory
// iframes. fillFormFromOverlay sets lastFilledCard + RELAY_CARD_DATA, so the
// resulting hit reaches PAYMENT_RESULT with a non-null card and a fresh fill
// timestamp — the background no longer drops it as "false hit (empty card)".
const CARD = { number: '4242424242424242', month: '12', year: '2028', cvv: '123' };
const fillResult = await page.evaluate(card => new Promise(res => {
  const to = setTimeout(() => res({ timeout: true }), 30000);
  window.addEventListener('message', function onMsg(e) {
    if (e.data && e.data.type === 'SEMEX_FILL_FORM_COMPLETE') {
      clearTimeout(to);
      window.removeEventListener('message', onMsg);
      res(e.data);
    }
  });
  window.postMessage({ type: 'SEMEX_FILL_FORM', card }, '*');
}), CARD);
console.log('SEMEX_FILL_FORM completion:', JSON.stringify(fillResult));
if (!fillResult || fillResult.ok !== true) {
  console.log('FAIL: extension fill did not complete — aborting (a manual iframe fill would produce a card:null hit).');
  await page.screenshot({ path: 'screenshots/whop-decline-mocked.png' });
  await ctx.close();
  process.exit(1);
}
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
// Evidence the background accepted the hit pipeline (no false-hit drops) now
// that the fill went through the extension's own fill path.
const dropped = swLogs.filter(l => /dropping false hit/.test(l));
console.log('\nbg false-hit drops:', dropped.length, dropped.slice(0, 2));
const ok = confirmIntercepted && !!dead && dropped.length === 0;
console.log('\nconfirm intercepted by mock:', confirmIntercepted);
console.log('DEAD event from whop confirm with decline reason:', !!dead, dead && JSON.stringify(dead));
console.log('hit not dropped by background:', dropped.length === 0);
console.log(ok ? 'PASS: decline surfaced as DEAD' : 'FAIL: decline missing or mislabeled');
await page.screenshot({ path: 'screenshots/whop-decline-mocked.png' });
await ctx.close();
process.exit(ok ? 0 : 1);
