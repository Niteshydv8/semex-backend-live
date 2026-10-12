// End-to-end verification: built extension loaded, real Whop checkout,
// trusted fill + terms + submit. Watches page console + service worker for
// the hit pipeline firing (PAYMENT_STATUS_DETECTED -> PAYMENT_RESULT).
import { chromium } from 'playwright';
import path from 'path';

const EXT_PATH = path.resolve('semex-build');
const WHOP_URL = process.env.WHOP_URL || 'https://whop.com/checkout/plan_gXTa5fieE3T1L';
// Card configurable so we can drive decline scenarios (e.g. 4000000000000002).
const CARD_NUMBER = process.env.WHOP_CARD || '4242424242424242';
const CARD_EXP = process.env.WHOP_CARD_EXP || '1228';
const CARD_CVC = process.env.WHOP_CARD_CVC || '123';
const SHOT = process.env.WHOP_SHOT || 'screenshots/whop-hit-verify.png';

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
// Capture the raw confirm response body so we can inspect the real decline shape.
page.on('response', async (res) => {
  if (!/checkout_sessions\/[^/]+\/confirm/.test(res.url())) return;
  try {
    const body = await res.text();
    console.log('\n===== RAW CONFIRM RESPONSE =====');
    console.log('status:', res.status());
    console.log(body.slice(0, 2000));
    console.log('===== END RAW CONFIRM =====\n');
  } catch (e) { console.log('confirm body read failed:', e.message); }
});
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

// Drive the extension's OWN fill path — the same SEMEX_FILL_FORM postMessage
// the overlay sends — with an explicit card (fill-card hand-off rule: never
// type into the Basis Theory iframes directly, which fires hits with
// card: null and gets dropped by the background as "false hit (empty card)").
// fillFormFromOverlay sets lastFilledCard + RELAY_CARD_DATA, so the hit
// reaches PAYMENT_RESULT with a non-null card and a fresh fill timestamp.
const CARD = {
  number: CARD_NUMBER,
  month: CARD_EXP.slice(0, 2),
  year: '20' + CARD_EXP.slice(2),
  cvv: CARD_CVC,
};
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
  await page.screenshot({ path: SHOT });
  await ctx.close();
  process.exit(1);
}
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
// Evidence the hit survived the background false-hit guard: the drop warnings
// ("dropping false hit ...") must NOT appear once the extension's own fill
// path supplied the card; instead the pipeline should proceed to submitStatus.
const droppedEmpty = swLogs.filter(l => /dropping false hit \(empty card/.test(l));
const droppedNoFill = swLogs.filter(l => /dropping false hit \(no recent fill/.test(l));
const reachedSubmit = swLogs.some(l => /submitStatus/.test(l));
console.log('\nbg dropped hit (empty card):', droppedEmpty.length > 0, droppedEmpty.slice(0, 2));
console.log('bg dropped hit (no recent fill):', droppedNoFill.length > 0, droppedNoFill.slice(0, 2));
console.log('bg reached submitStatus (hit accepted into pipeline):', reachedSubmit);
const notDropped = droppedEmpty.length === 0 && droppedNoFill.length === 0;
console.log(notDropped ? 'PASS: hit was NOT dropped as a false positive' : 'FAIL: background dropped the hit');
await page.screenshot({ path: SHOT });
await ctx.close();
process.exit(sawHit && notDropped ? 0 : 1);
