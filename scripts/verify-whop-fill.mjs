// Verify Whop checkout autofill with the real extension loaded.
// Loads semex-build/ unpacked, opens a live Whop checkout, triggers the fill
// via the same SEMEX_FILL_FORM postMessage the overlay sends, then checks
// top-frame fields and the Basis Theory hosted-element iframes.
import { chromium } from 'playwright';
import path from 'path';

const EXT_PATH = path.resolve('semex-build');
const WHOP_URL = process.env.WHOP_URL || 'https://whop.com/checkout/plan_gXTa5fieE3T1L';
const CARD = { number: '4242424242424242', month: '12', year: '2028', cvv: '123' };

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};

const ctx = await chromium.launchPersistentContext('', {
  channel: 'chromium', // new headless mode — supports MV3 extensions
  executablePath: '/repl/tools/bin/chromium',
  headless: true,
  args: [
    `--disable-extensions-except=${EXT_PATH}`,
    `--load-extension=${EXT_PATH}`,
    '--no-first-run',
  ],
});

// Wait for the MV3 service worker to register.
let sw = ctx.serviceWorkers()[0];
if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 15000 }).catch(() => null);
check('extension service worker registered', !!sw, sw ? sw.url() : 'no service worker');

const page = await ctx.newPage();
page.on('console', m => { if (m.type() === 'error') console.log('[page-err]', m.text().slice(0, 200)); });

console.log('Opening', WHOP_URL);
await page.goto(WHOP_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
// Give the React app + Basis Theory iframes time to render.
await page.waitForTimeout(12000);

// Inventory the page: iframes + candidate fields.
const inv = await page.evaluate(() => {
  const frames = Array.from(document.querySelectorAll('iframe')).map(f => f.src || '(no-src)');
  const pick = sel => { const el = document.querySelector(sel); return el ? (el.value || '(empty)') : null; };
  return {
    url: location.href,
    frames,
    email: pick('input[type="email"], input[name="email"], input[autocomplete="email"]'),
    nameField: !!document.querySelector('input[name="name"], input[autocomplete~="name"]'),
    country: !!document.querySelector('select[name="country"], select[autocomplete~="country"], select[autocomplete~="country-name"]'),
    address: !!document.querySelector('input[name="line1"], input[autocomplete~="address-line1"]'),
  };
});
console.log('Page URL:', inv.url);
console.log('Iframes:', JSON.stringify(inv.frames, null, 1));
check('on a Whop checkout page', /whop\.com\/checkout/.test(inv.url), inv.url);
const btFrames = inv.frames.filter(s => s.includes('js.basistheory.com') && s.includes('hosted-elements'));
check('Basis Theory hosted-element iframes present', btFrames.length >= 1, `${btFrames.length} frame(s)`);
if (btFrames.length === 0) { await ctx.close(); process.exit(1); }

// Trigger the fill exactly the way the overlay does.
await page.evaluate(card => {
  window.postMessage({ type: 'SEMEX_FILL_FORM', card }, '*');
}, CARD);

// Wait for completion signal (or timeout).
const completion = await page.evaluate(() => new Promise(res => {
  const to = setTimeout(() => res({ timeout: true }), 30000);
  window.addEventListener('message', e => {
    if (e.data && e.data.type === 'SEMEX_FILL_FORM_COMPLETE') {
      clearTimeout(to);
      res(e.data);
    }
  });
}));
console.log('Fill completion signal:', JSON.stringify(completion));
check('fill reported success (ok:true)', completion && completion.ok === true,
  completion && completion.timeout ? 'timed out waiting for SEMEX_FILL_FORM_COMPLETE' : JSON.stringify(completion));
await page.waitForTimeout(2000); // let any late subframe fills land

// ── Verify top-frame fields ─────────────────────────────────────────────
const top = await page.evaluate(() => {
  const val = sel => { const el = document.querySelector(sel); return el ? el.value : null; };
  return {
    email: val('input[type="email"], input[name="email"], input[autocomplete="email"]'),
    name: val('input[name="name"], input[autocomplete~="name"], input[autocomplete="cc-name"]'),
    country: val('select[name="country"], select[autocomplete~="country"], select[autocomplete~="country-name"]'),
    address: val('input[name="line1"], input[autocomplete~="address-line1"], input[name="addressLine1"], input[name="address1"]'),
    zip: val('input[name="postal_code"], input[name="postalCode"], input[name="zip"], input[autocomplete~="postal-code"]'),
  };
});
console.log('Top-frame values:', JSON.stringify(top));
check('email filled', !!top.email && top.email.includes('@'), String(top.email));
check('name filled', !!top.name, String(top.name));
check('address filled', !!top.address, String(top.address));
check('zip filled', !!top.zip, String(top.zip));
check('country set', !!top.country, String(top.country));

// ── Verify Basis Theory iframe fields — all three specific inputs ──────
const btValues = {};
for (const frame of page.frames()) {
  if (!frame.url().includes('js.basistheory.com')) continue;
  try {
    const info = await frame.evaluate(() => {
      const el = document.querySelector('#cardNumber, #expirationDate, #cvc');
      return el ? { id: el.id, value: el.value } : null;
    });
    if (info) btValues[info.id] = info.value; // frames with no card input (data-element.html) are not fill targets
  } catch {}
}
check('cardNumber iframe filled', (btValues.cardNumber || '').replace(/\D/g, '').length >= 15, `"${btValues.cardNumber}"`);
check('expirationDate iframe filled', /^\d{2} ?\/ ?\d{2}$/.test(btValues.expirationDate || ''), `"${btValues.expirationDate}"`);
check('cvc iframe filled', (btValues.cvc || '').replace(/\D/g, '').length >= 3, `"${btValues.cvc}"`);

await page.screenshot({ path: 'screenshots/whop-fill-verify.png', fullPage: false });
await ctx.close();

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
