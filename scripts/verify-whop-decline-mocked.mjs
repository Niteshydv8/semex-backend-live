// End-to-end verification of the Whop DECLINE path.
// A real bank decline cannot be forced against the observed merchant (their
// checkout completes all Luhn-valid test cards — verified live 2026-10-12 with
// 4000000000000002 and 4000000000009995 both returning status "completed").
// So this variant drives the REAL built extension against the REAL Whop
// checkout page, but route-mocks ONLY the final confirm response with the
// realistic decline envelope; everything upstream (session, Basis Theory
// tokenization, confirmation_tokens) is live. Asserts PAYMENT_STATUS_DETECTED
// fires with DEAD and the decline message.
// Driver lives in scripts/lib/whop-verify.mjs — fix fill/launch logic there.
import {
  WHOP_URL, DEFAULT_CARD, launchVerifyContext, openWhopCheckout,
  watchHitEvents, readHitEvents, driveExtensionFill, acceptTermsAndSubmit,
  falseHitDrops,
} from './lib/whop-verify.mjs';

// Realistic bank-decline envelope (Stripe-style card_error, as observed for
// other 4xx confirm failures; message mirrors a generic issuer decline).
const DECLINE_BODY = JSON.stringify({
  error: { type: 'card_error', message: 'Your card was declined.', code: 'card_declined', decline_code: 'generic_decline' },
});
const DECLINE_HTTP = Number(process.env.WHOP_DECLINE_HTTP || 402);

const { ctx, swLogs } = await launchVerifyContext();

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

await openWhopCheckout(page, WHOP_URL);
await watchHitEvents(page);

try {
  await driveExtensionFill(page, DEFAULT_CARD);
} catch (e) {
  console.log('FAIL:', e.message);
  await page.screenshot({ path: 'screenshots/whop-decline-mocked.png' });
  await ctx.close();
  process.exit(1);
}
await acceptTermsAndSubmit(page);
console.log('clicked Get access; waiting 25s...');
await page.waitForTimeout(25000);

const hits = await readHitEvents(page);
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
const drops = falseHitDrops(swLogs);
console.log('\nbg false-hit drops:', drops.any.length, drops.any.slice(0, 2));
const ok = confirmIntercepted && !!dead && !drops.dropped;
console.log('\nconfirm intercepted by mock:', confirmIntercepted);
console.log('DEAD event from whop confirm with decline reason:', !!dead, dead && JSON.stringify(dead));
console.log('hit not dropped by background:', !drops.dropped);
console.log(ok ? 'PASS: decline surfaced as DEAD' : 'FAIL: decline missing or mislabeled');
await page.screenshot({ path: 'screenshots/whop-decline-mocked.png' });
await ctx.close();
process.exit(ok ? 0 : 1);
