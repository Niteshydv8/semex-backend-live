// Shared driver for the Whop verify scripts (verify-whop-fill / -hit /
// -decline-mocked). Every script MUST drive the extension's own fill path
// (SEMEX_FILL_FORM postMessage, exactly what the overlay sends) — never type
// into the Basis Theory iframes manually: that bypasses fillFormFromOverlay,
// so lastFilledCard/RELAY_CARD_DATA stay empty and the background drops the
// resulting hit as "false hit (empty card)".
//
// Fix the fill/launch/assert logic HERE and it applies to every script.
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  // Fallback: playwright-core installed as a semex devDependency.
  ({ chromium } = require(path.resolve('semex/node_modules/playwright-core')));
}

export const WHOP_URL = process.env.WHOP_URL || 'https://whop.com/checkout/plan_gXTa5fieE3T1L';
export const DEFAULT_CARD = { number: '4242424242424242', month: '12', year: '2028', cvv: '123' };

// Fail fast if semex-build/ is stale: a verify script run against an old build
// SILENTLY tests old code (this exact bug hid the Whop parser during the
// authed-hit verification — the build predated it, so nothing detected).
// Compares the newest mtime of the semex/ sources against the build output.
const SRC_PATHS = ['content', 'main-world', 'background', 'shared', 'popup', 'crypto', 'storage', 'libs', 'manifest.json', 'rules.json', 'build.sh'];
const REBUILD_HINT = 'Rebuild: cd semex && bash build.sh "https://api.semxhitter.pw" --plain';
function _newestMtime(p) {
  const st = fs.statSync(p, { throwIfNoEntry: false });
  if (!st) return 0;
  if (!st.isDirectory()) return st.mtimeMs;
  // Directory mtimes count too: deleting/renaming a file touches its parent
  // dir, so a removed source file still invalidates the build.
  let m = st.mtimeMs;
  for (const f of fs.readdirSync(p)) m = Math.max(m, _newestMtime(path.join(p, f)));
  return m;
}
export function ensureFreshBuild({ extPath = path.resolve('semex-build'), srcDir = path.resolve('semex') } = {}) {
  const marker = path.join(extPath, 'manifest.json');
  if (!fs.existsSync(marker)) {
    throw new Error(`stale build: ${extPath} not found — verify scripts would test nothing real. ${REBUILD_HINT}`);
  }
  const buildMtime = fs.statSync(marker).mtimeMs;
  // A missing expected source path means the build was made from a DIFFERENT
  // source tree (e.g. a dir was deleted wholesale) — never trust it.
  for (const s of SRC_PATHS) {
    if (!fs.existsSync(path.join(srcDir, s))) {
      throw new Error(`stale build: expected source path semex/${s} is missing — the build cannot be trusted. ${REBUILD_HINT}`);
    }
  }
  // Deleting/renaming anything directly under semex/ bumps the src dir itself.
  for (const s of ['', ...SRC_PATHS]) {
    const m = _newestMtime(path.join(srcDir, s));
    if (m > buildMtime) {
      throw new Error(
        `semex-build is STALE: semex/${s} changed after the build ` +
        `(source ${new Date(m).toISOString()} > build ${new Date(buildMtime).toISOString()}). ` +
        `Verify results would silently reflect OLD extension code. ${REBUILD_HINT}`
      );
    }
  }
}

function findChromium() {
  const pinned = '/repl/tools/bin/chromium';
  if (fs.existsSync(pinned)) return pinned;
  try {
    for (const n of fs.readdirSync('/nix/store')) {
      if (!n.endsWith('-playwright-browsers-chromium')) continue;
      for (const v of fs.readdirSync(path.join('/nix/store', n))) {
        if (!v.startsWith('chromium-')) continue;
        const exe = path.join('/nix/store', n, v, 'chrome-linux', 'chrome');
        if (fs.existsSync(exe)) return exe;
      }
    }
  } catch {}
  return undefined; // let playwright resolve its own
}

// Launch a persistent context with the built extension loaded, wait for the
// MV3 service worker, and capture its console into swLogs (mirrored to stdout).
export async function launchVerifyContext({ extPath = path.resolve('semex-build') } = {}) {
  ensureFreshBuild({ extPath });
  const ctx = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    executablePath: findChromium(),
    headless: true,
    args: [`--disable-extensions-except=${extPath}`, `--load-extension=${extPath}`, '--no-first-run'],
  });
  let sw = ctx.serviceWorkers()[0];
  if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 15000 }).catch(() => null);
  console.log('service worker:', sw ? sw.url() : 'NONE');
  const swLogs = [];
  if (sw) sw.on('console', m => { const t = m.text().slice(0, 250); swLogs.push(t); console.log('[sw]', t); });
  return { ctx, sw, swLogs };
}

// Open the Whop checkout and wait until the Basis Theory card iframe exists.
export async function openWhopCheckout(page, url = WHOP_URL, { settleMs = 4000 } = {}) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(
    () => Array.from(document.querySelectorAll('iframe')).some(f => (f.src || '').includes('card-number-element')),
    { timeout: 40000 }
  );
  await page.waitForTimeout(settleMs); // let the React app + BT iframes finish rendering
}

// Install the window.__hits collector for the extension's status broadcasts.
export async function watchHitEvents(page) {
  await page.evaluate(() => {
    window.__hits = [];
    window.addEventListener('message', e => {
      if (e.data && (e.data.type === 'PAYMENT_STATUS_DETECTED' || e.data.type === 'SEMEX_NETWORK_RESPONSE')) {
        window.__hits.push({
          type: e.data.type, status: e.data.status, gateway: e.data.gateway,
          declineReason: e.data.declineReason, url: (e.data.url || '').slice(0, 100),
        });
      }
    });
  });
}
export const readHitEvents = (page) => page.evaluate(() => window.__hits);

// Fire SEMEX_FILL_FORM without waiting for completion — for instrumented
// scripts (verify-whop-fill-debug/-trace) that observe the fill mid-flight.
// Anything asserting on the result must use driveExtensionFill instead.
export async function postFillForm(page, card) {
  await page.evaluate(c => window.postMessage({ type: 'SEMEX_FILL_FORM', card: c }, '*'), card);
}

// Drive the extension's own fill path and wait for SEMEX_FILL_FORM_COMPLETE.
// THROWS on timeout/failure — callers must abort the run (a manual iframe
// fill fallback would produce card:null hits that the background drops).
export async function driveExtensionFill(page, card, { timeoutMs = 30000 } = {}) {
  const fillResult = await page.evaluate(([c, to]) => new Promise(res => {
    const t = setTimeout(() => res({ timeout: true }), to);
    window.addEventListener('message', function onMsg(e) {
      if (e.data && e.data.type === 'SEMEX_FILL_FORM_COMPLETE') {
        clearTimeout(t);
        window.removeEventListener('message', onMsg);
        res(e.data);
      }
    });
    window.postMessage({ type: 'SEMEX_FILL_FORM', card: c }, '*');
  }), [card, timeoutMs]);
  console.log('SEMEX_FILL_FORM completion:', JSON.stringify(fillResult));
  if (!fillResult || fillResult.ok !== true) {
    throw new Error('extension fill did not complete — aborting (a manual iframe fill would produce a card:null hit)');
  }
  await page.waitForTimeout(1000); // let any late subframe fills land
  return fillResult;
}

// Tick the terms checkboxes, keep SEMEX overlays from swallowing the click,
// and press the submit button ("Get access").
export async function acceptTermsAndSubmit(page, { buttonName = /get access/i, settleMs = 800 } = {}) {
  await page.evaluate(() => {
    document.querySelectorAll('input[type="checkbox"], [role="checkbox"]').forEach(c => {
      if (!(c.checked || c.getAttribute('aria-checked') === 'true')) c.click();
    });
    document.querySelectorAll('#semex-overlay, [id*="semex"]').forEach(el => { try { el.style.pointerEvents = 'none'; } catch {} });
  });
  await page.waitForTimeout(settleMs);
  await page.getByRole('button', { name: buttonName }).click();
}

// False-hit-drop assertions against the captured service-worker logs: once the
// extension's own fill path supplied the card, these drop warnings must NOT
// appear — the pipeline should proceed to submitStatus instead.
export function falseHitDrops(swLogs) {
  const emptyCard = swLogs.filter(l => /dropping false hit \(empty card/.test(l));
  const noRecentFill = swLogs.filter(l => /dropping false hit \(no recent fill/.test(l));
  const any = swLogs.filter(l => /dropping false hit/.test(l));
  return { emptyCard, noRecentFill, any, dropped: any.length > 0 };
}
export const reachedSubmitStatus = (swLogs) => swLogs.some(l => /submitStatus/.test(l));
