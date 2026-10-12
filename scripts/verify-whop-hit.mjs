// End-to-end verification: built extension loaded, real Whop checkout,
// trusted fill + terms + submit. Watches page console + service worker for
// the hit pipeline firing (PAYMENT_STATUS_DETECTED -> PAYMENT_RESULT).
// Driver lives in scripts/lib/whop-verify.mjs — fix fill/launch logic there.
import {
  WHOP_URL, launchVerifyContext, openWhopCheckout, watchHitEvents,
  readHitEvents, driveExtensionFill, acceptTermsAndSubmit,
  falseHitDrops, reachedSubmitStatus,
} from './lib/whop-verify.mjs';

// Card configurable so we can drive decline scenarios (e.g. 4000000000000002).
const CARD_NUMBER = process.env.WHOP_CARD || '4242424242424242';
const CARD_EXP = process.env.WHOP_CARD_EXP || '1228';
const CARD_CVC = process.env.WHOP_CARD_CVC || '123';
const SHOT = process.env.WHOP_SHOT || 'screenshots/whop-hit-verify.png';

const { ctx, swLogs } = await launchVerifyContext();

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
await openWhopCheckout(page, WHOP_URL);
await watchHitEvents(page);

const CARD = {
  number: CARD_NUMBER,
  month: CARD_EXP.slice(0, 2),
  year: '20' + CARD_EXP.slice(2),
  cvv: CARD_CVC,
};
try {
  await driveExtensionFill(page, CARD);
} catch (e) {
  console.log('FAIL:', e.message);
  await page.screenshot({ path: SHOT });
  await ctx.close();
  process.exit(1);
}
await acceptTermsAndSubmit(page);
console.log('clicked Get access; waiting 40s...');
await page.waitForTimeout(40000);
const hits = await readHitEvents(page);
console.log('\n===== EXTENSION HIT EVENTS =====');
console.log(JSON.stringify(hits, null, 1));
const sawHit = hits.some(h => h.type === 'PAYMENT_STATUS_DETECTED');
const sawNet = hits.some(h => h.type === 'SEMEX_NETWORK_RESPONSE' && /checkout_sessions.*confirm/.test(h.url));
console.log('\nPAYMENT_STATUS_DETECTED fired:', sawHit);
console.log('confirm response captured:', sawNet);
// Evidence the hit survived the background false-hit guard: the drop warnings
// ("dropping false hit ...") must NOT appear once the extension's own fill
// path supplied the card; instead the pipeline should proceed to submitStatus.
const drops = falseHitDrops(swLogs);
console.log('\nbg dropped hit (empty card):', drops.emptyCard.length > 0, drops.emptyCard.slice(0, 2));
console.log('bg dropped hit (no recent fill):', drops.noRecentFill.length > 0, drops.noRecentFill.slice(0, 2));
console.log('bg reached submitStatus (hit accepted into pipeline):', reachedSubmitStatus(swLogs));
console.log(!drops.dropped ? 'PASS: hit was NOT dropped as a false positive' : 'FAIL: background dropped the hit');
await page.screenshot({ path: SHOT });
await ctx.close();
process.exit(sawHit && !drops.dropped ? 0 : 1);
