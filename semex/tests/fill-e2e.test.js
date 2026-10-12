/**
 * fill-e2e.test.js — real-browser integration test for the card-fill pipeline
 *                    (task #136)
 *
 * SCOPE (read before changing): this is a REAL-BROWSER INTEGRATION test, not a
 * test against a live production Stripe Checkout session. It loads the actual
 * built extension into a real Chromium and drives the genuine end-to-end fill
 * pipeline across the real Chrome extension message bus:
 *
 *     page (MAIN world)                    → window.postMessage SEMEX_FILL_FORM
 *       → content.js  fillFormFromOverlay  (ISOLATED world content script)
 *         → background.js CHECK_CONFIG     (MV3 service worker)
 *           → serverClient.getSelectors()  (local Stripe selector table)
 *           → writes __xcabuf cache
 *         → GET_CACHED_FORM_DATA poll resolves
 *       → executeFillSequence fills the real DOM
 *     → SEMEX_FILL_FORM_COMPLETE { ok:true }
 *
 * Why not a live Stripe session: creating one requires Stripe API credentials
 * and outbound network to checkout.stripe.com, neither of which exists in this
 * sandbox, and a live session URL expires. Instead we intercept the navigation
 * to checkout.stripe.com and serve a fixture whose element IDs are taken
 * VERBATIM from the current production Stripe hosted-checkout selector table in
 * semex/utils/server-client.js (payment-numberInput / payment-expiryInput /
 * payment-cvcInput / payment-nameInput / payment-countryInput /
 * payment-addressLine1Input / payment-postalCodeInput / payment-localityInput /
 * paymentForm-emailInput). Serving it as checkout.stripe.com is what makes the
 * manifest-matched content scripts inject for real.
 *
 * The COMPLEMENTARY guarantee — that those selector strings still match the
 * markup Stripe actually ships — is owned by the getSelectors-vs-real-HTML
 * snapshot task (#138); this test owns the pipeline + fill-behavior guarantee
 * and the "no page reload during fill" guarantee.
 *
 * Run:  npm run test:e2e   (from semex/)   or   node semex/tests/fill-e2e.test.js
 *
 * Exit codes:
 *   0  all fill assertions passed.
 *   1  a fill assertion failed, OR a required prerequisite (Playwright,
 *      Chromium, browser launch) was unavailable. Missing prerequisites FAIL by
 *      default so a CI "test:e2e" step can never report green without actually
 *      exercising a fill.
 *   0  ONLY when SEMEX_E2E_ALLOW_SKIP=1 is set AND a prerequisite is missing —
 *      an explicit opt-out for environments that intentionally do not schedule
 *      the browser job.
 */

"use strict";

const fs   = require("fs");
const path = require("path");
const os   = require("os");

const ALLOW_SKIP = process.env.SEMEX_E2E_ALLOW_SKIP === "1";
const LAUNCH_TIMEOUT_MS = 60000;
const NAV_TIMEOUT_MS    = 20000;

// Missing-prerequisite handling: fail by default, skip only when explicitly
// opted out via SEMEX_E2E_ALLOW_SKIP=1.
function unmet(reason) {
  if (ALLOW_SKIP) {
    console.log("SKIP (SEMEX_E2E_ALLOW_SKIP=1): " + reason);
    process.exit(0);
  }
  console.error("FAIL: " + reason);
  console.error("      (set SEMEX_E2E_ALLOW_SKIP=1 to allow skipping when the browser job is intentionally not scheduled)");
  process.exit(1);
}

// ─── locate playwright + a runnable Chromium ────────────────────────────────

let chromium;
try {
  ({ chromium } = require(path.join(__dirname, "../../node_modules/playwright")));
} catch (_e) {
  unmet("playwright is not installed (npm i -D playwright).");
}

const EXT_DIR = path.resolve(__dirname, "../../semex-build");
if (!fs.existsSync(path.join(EXT_DIR, "manifest.json"))) {
  console.error("FAIL: built extension not found at " + EXT_DIR + " (run ./semex/build.sh first)");
  process.exit(1);
}

// Playwright's own downloaded Chromium needs system libs that are absent on
// NixOS; prefer the nix-provided, fully-wrapped Chromium when present, and fall
// back to Playwright's configured executable otherwise.
function findChromium() {
  const base = "/nix/store";
  try {
    for (const n of fs.readdirSync(base)) {
      if (!n.endsWith("-playwright-browsers-chromium")) continue;
      const c = path.join(base, n);
      for (const v of fs.readdirSync(c)) {
        if (!v.startsWith("chromium-")) continue;
        const exe = path.join(c, v, "chrome-linux", "chrome");
        if (fs.existsSync(exe)) return exe;
      }
    }
  } catch (_e) {}
  try {
    const p = chromium.executablePath();
    if (p && fs.existsSync(p)) return p;
  } catch (_e) {}
  return null;
}

// ─── fixture: current production Stripe hosted-checkout element IDs ──────────
// Every id below is copied from the live Stripe selector table in
// semex/utils/server-client.js getSelectors('stripe').

const CHECKOUT_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>Checkout</title></head>
<body>
  <div id="app">
    <form id="payment-form" onsubmit="return false">
      <input id="paymentForm-emailInput" type="email" autocomplete="email" />
      <input id="payment-numberInput" autocomplete="cc-number" inputmode="numeric" />
      <input id="payment-expiryInput" autocomplete="cc-exp" inputmode="numeric" />
      <input id="payment-cvcInput" autocomplete="cc-csc" inputmode="numeric" />
      <input id="payment-nameInput" autocomplete="cc-name" />
      <select id="payment-countryInput" name="country">
        <option value="">Country</option>
        <option value="US">United States</option>
        <option value="GB">United Kingdom</option>
      </select>
      <input id="payment-addressLine1Input" autocomplete="address-line1" />
      <input id="payment-localityInput" autocomplete="address-level2" />
      <input id="payment-postalCodeInput" autocomplete="postal-code" />
      <button type="submit">Pay</button>
    </form>
  </div>
  <script>
    // Reload sentinel: if the page reloads mid-fill this counter resets to 0.
    (function () {
      var n = Number(sessionStorage.getItem("__e2e_loads") || "0") + 1;
      sessionStorage.setItem("__e2e_loads", String(n));
      window.__E2E_LOADS = n;
      // executeFillSequence posts several bare SEMEX_FILL_FORM_COMPLETE frames
      // (a 1200ms overlay-live heartbeat + a finally/relay frame) BEFORE the
      // authoritative { ok:true } from fillFormFromOverlay lands once the DOM is
      // fully filled. Keep the whole trail, and expose the definitive result
      // (the first frame carrying an explicit ok flag) so the test never reads
      // the DOM mid-fill.
      window.__E2E_FILL_MSGS = [];
      window.__E2E_FILL_RESULT = null;
      window.addEventListener("message", function (ev) {
        if (ev.data && ev.data.type === "SEMEX_FILL_FORM_COMPLETE") {
          window.__E2E_FILL_MSGS.push(ev.data);
          if (typeof ev.data.ok === "boolean" && window.__E2E_FILL_RESULT === null) {
            window.__E2E_FILL_RESULT = ev.data;
          }
        }
      });
    })();
  </script>
</body></html>`;

// ─── test harness ───────────────────────────────────────────────────────────

let passed = 0, failed = 0;
function assert(cond, name) {
  if (cond) { console.log("  \u2713  " + name); passed++; }
  else      { console.error("  \u2717  " + name); failed++; }
}
function assertEq(actual, expected, name) {
  if (actual === expected) { console.log("  \u2713  " + name); passed++; }
  else { console.error("  \u2717  " + name + "  (expected " + JSON.stringify(expected) + ", got " + JSON.stringify(actual) + ")"); failed++; }
}

const CARD = { number: "4242424242424242", month: "12", year: "2030", cvv: "123" };
const EXPECT = { cardNumber: "4242424242424242", expiry: "12/30", cvv: "123" };

async function main() {
  const exe = findChromium();
  if (!exe) unmet("no runnable Chromium found (nix playwright-browsers or playwright install).");
  console.log("Using Chromium: " + exe);

  const profile = path.join(os.tmpdir(), "semex-e2e-profile-" + Date.now());
  let ctx;
  try {
    ctx = await chromium.launchPersistentContext(profile, {
      headless: false,
      executablePath: exe,
      timeout: LAUNCH_TIMEOUT_MS,
      args: [
        "--headless=new",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-extensions-except=" + EXT_DIR,
        "--load-extension=" + EXT_DIR,
      ],
    });
  } catch (e) {
    unmet("Chromium failed to launch with the extension within " +
          LAUNCH_TIMEOUT_MS + "ms (" + String(e.message).split("\n")[0] + ").");
  }

  try {
    // Wait for the MV3 service worker (background.js) to boot.
    let sw = ctx.serviceWorkers()[0];
    if (!sw) sw = await ctx.waitForEvent("serviceworker", { timeout: 15000 }).catch(() => null);
    assert(!!sw, "MV3 service worker (background.js) booted");

    // Stub all backend calls so the test needs no network / auth. The Stripe
    // fill uses local selectors + fallback address, so empty JSON is fine.
    await ctx.route(/https?:\/\/([a-z0-9.-]*\.)?semxhitter\.pw\/.*/i, (route) => {
      const url = route.request().url();
      if (url.includes("/api/public/version")) {
        return route.fulfill({
          status: 200, contentType: "application/json",
          body: JSON.stringify({ minVersion: "0.0.1", latestVersion: "0.0.1" }),
        });
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });

    // Serve the production-ID fixture as checkout.stripe.com so the content
    // script (manifest-matched to that host) injects for real.
    await ctx.route("https://checkout.stripe.com/**", (route) => {
      if (route.request().resourceType() === "document") {
        return route.fulfill({ status: 200, contentType: "text/html", body: CHECKOUT_HTML });
      }
      return route.fulfill({ status: 200, contentType: "text/plain", body: "" });
    });

    const page = await ctx.newPage();
    page.setDefaultTimeout(NAV_TIMEOUT_MS);

    // Count real navigations to prove the fill happens WITHOUT a page reload.
    let navigations = 0;
    page.on("framenavigated", (fr) => { if (fr === page.mainFrame()) navigations++; });

    await page.goto("https://checkout.stripe.com/c/pay/test_e2e_session", {
      waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS,
    });

    // Give the document_idle content scripts a moment to attach their listeners.
    await page.waitForTimeout(1200);
    const navsAfterLoad = navigations;

    assertEq(await page.evaluate(() => window.__E2E_LOADS), 1, "page loaded exactly once before fill");

    // Trigger the real fill pipeline exactly the way overlay.js does.
    await page.evaluate((card) => {
      window.postMessage({ type: "SEMEX_FILL_FORM", card }, "*");
    }, CARD);

    // Wait for the AUTHORITATIVE completion (the first frame carrying an explicit
    // ok flag), not the bare overlay-heartbeat frames that fire mid-fill.
    const result = await page.waitForFunction(
      () => window.__E2E_FILL_RESULT,
      { timeout: 15000 }
    ).then(h => h.jsonValue()).catch(() => null);

    assert(!!result, "pipeline posted a SEMEX_FILL_FORM_COMPLETE with an explicit ok flag");
    assert(result && result.ok === true, "fill completion reported ok:true (got " + JSON.stringify(result) + ")");

    // Read the resulting DOM values (current production Stripe ids).
    const dom = await page.evaluate(() => ({
      cardNumber: document.getElementById("payment-numberInput").value,
      expiry:     document.getElementById("payment-expiryInput").value,
      cvv:        document.getElementById("payment-cvcInput").value,
      name:       document.getElementById("payment-nameInput").value,
      country:    document.getElementById("payment-countryInput").value,
      address:    document.getElementById("payment-addressLine1Input").value,
      city:       document.getElementById("payment-localityInput").value,
      zip:        document.getElementById("payment-postalCodeInput").value,
      loads:      window.__E2E_LOADS,
    }));

    console.log("\n=== filled DOM ===");
    console.log("  " + JSON.stringify(dom));
    console.log("");

    assertEq(dom.cardNumber, EXPECT.cardNumber, "cardNumber filled");
    assertEq(dom.expiry,     EXPECT.expiry,     "expiry filled (MM/YY)");
    assertEq(dom.cvv,        EXPECT.cvv,        "CVV filled");
    assert(dom.name && dom.name.length > 0,       "name filled (non-empty): " + JSON.stringify(dom.name));
    assert(dom.address && dom.address.length > 0, "address filled (non-empty): " + JSON.stringify(dom.address));
    assert(dom.zip && dom.zip.length > 0,         "zip filled (non-empty): " + JSON.stringify(dom.zip));
    assertEq(dom.country, "US",                  "country selected");

    // The core promise of this task: no reload during the fill.
    assertEq(dom.loads, 1, "no page reload occurred during fill (load count still 1)");
    assertEq(navigations, navsAfterLoad, "no main-frame navigation fired during fill");

  } finally {
    if (ctx) await ctx.close().catch(() => {});
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (_e) {}
  }

  console.log("\n" + "=".repeat(45));
  console.log("  Results: " + passed + " passed, " + failed + " failed");
  console.log("=".repeat(45) + "\n");
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error("E2E harness error:", e); process.exit(1); });
