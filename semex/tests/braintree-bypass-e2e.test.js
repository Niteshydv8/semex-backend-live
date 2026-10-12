/**
 * braintree-bypass-e2e.test.js
 *
 * Real-browser integration test confirming the SEMEX Braintree CVV bypass and
 * card-replacement interceptor fire correctly in a live Chromium environment.
 *
 * Architecture:
 *   1. Loads the BUILT SEMEX extension into real Chromium via Playwright.
 *   2. Navigates to checkout.stripe.com — the extension's manifest matches
 *      <all_urls> so the MAIN-world interceptor.js runs on every page.
 *   3. Playwright routes Braintree API calls to a mock handler instead of the
 *      real Braintree network; the mock captures the exact request body that
 *      the BROWSER SENT (i.e. AFTER the interceptor had a chance to modify it).
 *   4. Asserts that cvv is absent from the captured body (bypass fired),
 *      the card number was swapped (replacement fired), and the corresponding
 *      SEMEX_TOAST postMessages appeared in the page.
 *
 * Why a real browser is required:
 *   The interceptor patches window.fetch at document_start in the MAIN world.
 *   Only a real extension context (not vm/eval) wires the Chrome extension
 *   APIs, storage, and content-script message bus that activate the patch.
 *   Playwright's route interception captures the post-modification HTTP body,
 *   giving a definitive, network-level assertion that the bypass fired BEFORE
 *   the request left the browser.
 *
 * Test cards used (Braintree sandbox test numbers, no real credentials needed):
 *   4111 1111 1111 1111 — Visa test card (Braintree sandbox, always succeeds)
 *   5555 5555 5555 4444 — Mastercard replacement card
 *
 * Run (after `npm run test:e2e` builds the extension):
 *   node semex/tests/braintree-bypass-e2e.test.js
 *
 * Or via npm:
 *   npm run test:e2e:braintree    (from semex/)
 *
 * Exit codes:
 *   0  all assertions passed
 *   1  assertion failed or prerequisite missing (extension not built, no browser)
 *   0  when SEMEX_E2E_ALLOW_SKIP=1 and prerequisite is missing (explicit opt-out)
 */

"use strict";

const fs   = require("fs");
const path = require("path");
const os   = require("os");

const ALLOW_SKIP      = process.env.SEMEX_E2E_ALLOW_SKIP === "1";
const LAUNCH_TIMEOUT  = 60_000;
const NAV_TIMEOUT     = 20_000;
const FETCH_TIMEOUT   = 10_000;

function unmet(reason) {
  if (ALLOW_SKIP) {
    console.log("SKIP (SEMEX_E2E_ALLOW_SKIP=1): " + reason);
    process.exit(0);
  }
  console.error("FAIL: " + reason);
  process.exit(1);
}

// ── Locate Playwright + Chromium ──────────────────────────────────────────────
let chromium;
try {
  ({ chromium } = require(path.join(__dirname, "../../node_modules/playwright")));
} catch (_e) {
  unmet("playwright is not installed (npm i -D playwright in workspace root).");
}

const EXT_DIR = path.resolve(__dirname, "../../semex-build");
if (!fs.existsSync(path.join(EXT_DIR, "manifest.json"))) {
  console.error("FAIL: built extension not found at " + EXT_DIR);
  console.error("      Run: cd semex && bash build.sh https://api.semxhitter.pw --plain");
  process.exit(1);
}

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

// ── Test fixture: minimal page that captures SEMEX_TOAST postMessages ─────────
// Served at checkout.stripe.com so the <all_urls> MAIN-world content script injects.
const FIXTURE_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>Braintree E2E Test Fixture</title></head>
<body>
  <p>Braintree E2E fixture — SEMEX interceptor active</p>
  <script>
    // Capture every SEMEX_TOAST postMessage fired by the MAIN-world interceptor
    window.__BT_TOASTS__   = [];
    window.__BT_FETCHED__  = false;
    window.__BT_RESPONSE__ = null;
    window.addEventListener("message", function(ev) {
      if (ev.data && ev.data.type === "SEMEX_TOAST") {
        window.__BT_TOASTS__.push(ev.data);
      }
    });
  </script>
</body></html>`;

// ── Test harness ──────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
function assert(cond, name) {
  if (cond) { console.log("  \u2713  " + name); passed++; }
  else       { console.error("  \u2717  " + name); failed++; }
}
function assertEq(actual, expected, name) {
  if (actual === expected) { console.log("  \u2713  " + name); passed++; }
  else {
    console.error("  \u2717  " + name +
      "  (expected " + JSON.stringify(expected) + ", got " + JSON.stringify(actual) + ")");
    failed++;
  }
}

// ── Braintree test cards (standard Braintree sandbox test numbers) ─────────────
const ORIGINAL_CARD = {
  number: "4111111111111111",   // Visa — always succeeds in Braintree sandbox
  expirationMonth: "12",
  expirationYear:  "2030",
  cvv:             "999",
};
const REPLACEMENT_CARD = {
  number:    "5555555555554444",   // Mastercard replacement card
  exp_month: "06",
  exp_year:  "2027",
  cvc:       "777",
};

const BT_GQL_URL = "https://payments.braintree-api.com/graphql";

// Realistic Braintree tokenizeCreditCard success response (sandbox shape)
const BT_TOKENIZE_SUCCESS = JSON.stringify({
  data: {
    tokenizeCreditCard: {
      paymentMethod: {
        id: "fake-valid-nonce-sandbox-tokenize",
        details: { bin: "411111", lastTwo: "11" }
      }
    }
  }
});

async function main() {
  const exe = findChromium();
  if (!exe) unmet("no runnable Chromium found (run: npx playwright install chromium).");
  console.log("Using Chromium: " + exe);

  const profile = path.join(os.tmpdir(), "semex-bt-e2e-" + Date.now());
  let ctx;
  try {
    ctx = await chromium.launchPersistentContext(profile, {
      headless: false,
      executablePath: exe,
      timeout: LAUNCH_TIMEOUT,
      args: [
        "--headless=new",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-extensions-except=" + EXT_DIR,
        "--load-extension=" + EXT_DIR,
      ],
    });
  } catch (e) {
    unmet("Chromium failed to launch with extension (" + String(e.message).split("\n")[0] + ").");
  }

  try {
    // ── Wait for the MV3 service worker (background.js) to boot ───────────────
    let sw = ctx.serviceWorkers()[0];
    if (!sw) sw = await ctx.waitForEvent("serviceworker", { timeout: 15_000 }).catch(() => null);
    assert(!!sw, "MV3 service worker (background.js) booted");

    // ── Stub all SEMEX backend calls — no auth needed ─────────────────────────
    await ctx.route(/https?:\/\/([a-z0-9.-]*\.)?semxhitter\.pw\/.*/i, (route) => {
      const u = route.request().url();
      if (u.includes("/api/public/version")) {
        return route.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify({ minVersion: "0.0.1", latestVersion: "0.0.1" }) });
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });

    // ── Serve the fixture HTML at checkout.stripe.com ─────────────────────────
    await ctx.route("https://checkout.stripe.com/**", (route) => {
      if (route.request().resourceType() === "document")
        return route.fulfill({ status: 200, contentType: "text/html", body: FIXTURE_HTML });
      return route.fulfill({ status: 200, contentType: "text/plain", body: "" });
    });

    const page = await ctx.newPage();
    page.setDefaultTimeout(NAV_TIMEOUT);

    await page.goto("https://checkout.stripe.com/c/pay/bt_e2e_test", {
      waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT,
    });

    // Give document_idle content scripts (content.js etc.) time to attach
    await page.waitForTimeout(1500);

    // ═══════════════════════════════════════════════════════════════════════════
    // Suite A: CVV bypass — cvv stripped from outgoing Braintree request
    // ═══════════════════════════════════════════════════════════════════════════
    console.log("\n=== A. CVV bypass — cvv stripped from outgoing Braintree request ===\n");

    // Capture the request body that ACTUALLY leaves the browser via Playwright
    let capturedBodyA = null;
    await ctx.route(BT_GQL_URL + "**", async (route) => {
      capturedBodyA = route.request().postData();
      await route.fulfill({
        status: 200, contentType: "application/json", body: BT_TOKENIZE_SUCCESS,
      });
    });

    // Inject settings + fire a Braintree tokenization fetch from the page
    await page.evaluate(async ({ btUrl, card }) => {
      // Tell the MAIN-world interceptor that Braintree CVV bypass is enabled.
      // The interceptor reads window.SEMEX_SETTINGS at the time of each fetch call.
      window.SEMEX_SETTINGS = {
        cvvBypass:       { enabled: true, gateways: { braintree: true  } },
        cardReplacement: { enabled: false, gateways: { braintree: false } },
      };
      // Clear any toasts from previous runs
      window.__BT_TOASTS__ = [];

      // Braintree GraphQL tokenizeCreditCard request (exact production shape)
      await window.fetch(btUrl, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          query: "mutation TokenizeCreditCard($input: TokenizeCreditCardInput!) { tokenizeCreditCard(input: $input) { paymentMethod { id } } }",
          variables: { input: { creditCard: card } }
        }),
      });
    }, { btUrl: BT_GQL_URL, card: ORIGINAL_CARD });

    // Remove the route so it doesn't affect later tests
    await ctx.unroute(BT_GQL_URL + "**");

    // Assert: the body that reached the mock has NO cvv field
    assert(capturedBodyA !== null, "A1: Braintree request was intercepted by Playwright route");
    if (capturedBodyA) {
      let bodyA;
      try { bodyA = JSON.parse(capturedBodyA); } catch (_e) { bodyA = null; }
      assert(bodyA !== null, "A2: intercepted body is valid JSON");
      const ccA = bodyA && bodyA.variables && bodyA.variables.input && bodyA.variables.input.creditCard;
      assert(!!ccA, "A3: creditCard object present in intercepted request");
      assert(ccA && ccA.cvv === undefined, "A4: cvv field is ABSENT from the HTTP request body (bypass fired)");
      assertEq(ccA && ccA.number, ORIGINAL_CARD.number, "A5: card number preserved correctly");
    }

    // Assert: BYPASS_ACTIVATED postMessage was fired into the page
    await page.waitForTimeout(200); // allow async postMessage to propagate
    const toastsA = await page.evaluate(() => window.__BT_TOASTS__);
    const bypassToast = toastsA.find(t => t.messageType === "BYPASS_ACTIVATED");
    assert(!!bypassToast, "A6: SEMEX_TOAST BYPASS_ACTIVATED postMessage fired");
    assert(bypassToast && bypassToast.gateway === "BRAINTREE",
      "A7: BYPASS_ACTIVATED has gateway=BRAINTREE");
    assert(bypassToast && Array.isArray(bypassToast.bypassTypes) && bypassToast.bypassTypes.includes("CVV"),
      "A8: BYPASS_ACTIVATED includes CVV in bypassTypes");

    // ═══════════════════════════════════════════════════════════════════════════
    // Suite B: Card replacement — number/expiry swapped, CARD_REPLACED posted
    // ═══════════════════════════════════════════════════════════════════════════
    console.log("\n=== B. Card replacement — card number swapped in outgoing request ===\n");

    let capturedBodyB = null;
    await ctx.route(BT_GQL_URL + "**", async (route) => {
      capturedBodyB = route.request().postData();
      await route.fulfill({
        status: 200, contentType: "application/json", body: BT_TOKENIZE_SUCCESS,
      });
    });

    await page.evaluate(async ({ btUrl, card, replacementCard }) => {
      // Enable card replacement + cvv bypass
      window.SEMEX_SETTINGS = {
        cvvBypass:       { enabled: true, gateways: { braintree: true } },
        cardReplacement: { enabled: true, gateways: { braintree: true } },
      };
      // Set the replacement card — the interceptor reads this
      window.__SEMEX_CURRENT_CARD = replacementCard;
      window.__BT_TOASTS__ = [];

      await window.fetch(btUrl, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          variables: { input: { creditCard: {
            number:          card.number,
            expirationMonth: card.expirationMonth,
            expirationYear:  card.expirationYear,
            cvv:             card.cvv,
          }}}
        }),
      });
    }, { btUrl: BT_GQL_URL, card: ORIGINAL_CARD, replacementCard: REPLACEMENT_CARD });

    await ctx.unroute(BT_GQL_URL + "**");

    assert(capturedBodyB !== null, "B1: Braintree request intercepted for card replacement test");
    if (capturedBodyB) {
      let bodyB;
      try { bodyB = JSON.parse(capturedBodyB); } catch (_e) { bodyB = null; }
      const ccB = bodyB && bodyB.variables && bodyB.variables.input && bodyB.variables.input.creditCard;
      assert(!!ccB, "B2: creditCard object present in replacement test request");
      assertEq(ccB && ccB.number, REPLACEMENT_CARD.number,
        "B3: card number replaced with " + REPLACEMENT_CARD.number + " in HTTP request");
      assertEq(ccB && ccB.expirationMonth, REPLACEMENT_CARD.exp_month,
        "B4: expirationMonth replaced correctly");
      assertEq(ccB && ccB.expirationYear, String(REPLACEMENT_CARD.exp_year),
        "B5: expirationYear replaced correctly");
      assert(ccB && ccB.cvv === undefined, "B6: cvv stripped from replaced card");
    }

    await page.waitForTimeout(200);
    const toastsB = await page.evaluate(() => window.__BT_TOASTS__);
    assert(toastsB.some(t => t.messageType === "CARD_REPLACED"),
      "B7: SEMEX_TOAST CARD_REPLACED postMessage fired");
    assert(toastsB.some(t => t.messageType === "BYPASS_ACTIVATED"),
      "B8: SEMEX_TOAST BYPASS_ACTIVATED also fired alongside card replacement");
    const crToast = toastsB.find(t => t.messageType === "CARD_REPLACED");
    assert(crToast && crToast.gateway === "Braintree",
      "B9: CARD_REPLACED has gateway=Braintree");

    // ═══════════════════════════════════════════════════════════════════════════
    // Suite C: __LAST_CAPTURED_CARD fallback
    // (card replaced even when __SEMEX_CURRENT_CARD is null)
    // ═══════════════════════════════════════════════════════════════════════════
    console.log("\n=== C. __LAST_CAPTURED_CARD fallback — replacement fires from fallback card ===\n");

    let capturedBodyC = null;
    await ctx.route(BT_GQL_URL + "**", async (route) => {
      capturedBodyC = route.request().postData();
      await route.fulfill({
        status: 200, contentType: "application/json", body: BT_TOKENIZE_SUCCESS,
      });
    });

    await page.evaluate(async ({ btUrl, card, replacementCard }) => {
      window.SEMEX_SETTINGS = {
        cvvBypass:       { enabled: true, gateways: { braintree: true } },
        cardReplacement: { enabled: true, gateways: { braintree: true } },
      };
      window.__SEMEX_CURRENT_CARD  = null;           // primary source absent
      window.__LAST_CAPTURED_CARD  = replacementCard; // fallback source present
      window.__BT_TOASTS__ = [];

      await window.fetch(btUrl, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          variables: { input: { creditCard: {
            number: card.number, expirationMonth: card.expirationMonth,
            expirationYear: card.expirationYear, cvv: card.cvv,
          }}}
        }),
      });
    }, { btUrl: BT_GQL_URL, card: ORIGINAL_CARD, replacementCard: REPLACEMENT_CARD });

    await ctx.unroute(BT_GQL_URL + "**");

    assert(capturedBodyC !== null, "C1: Braintree request intercepted for fallback card test");
    if (capturedBodyC) {
      let bodyC;
      try { bodyC = JSON.parse(capturedBodyC); } catch (_e) { bodyC = null; }
      const ccC = bodyC && bodyC.variables && bodyC.variables.input && bodyC.variables.input.creditCard;
      assertEq(ccC && ccC.number, REPLACEMENT_CARD.number,
        "C2: __LAST_CAPTURED_CARD used when __SEMEX_CURRENT_CARD is null");
    }
    await page.waitForTimeout(200);
    const toastsC = await page.evaluate(() => window.__BT_TOASTS__);
    assert(toastsC.some(t => t.messageType === "CARD_REPLACED"),
      "C3: CARD_REPLACED posted even when using __LAST_CAPTURED_CARD fallback");

    // ═══════════════════════════════════════════════════════════════════════════
    // Suite D: bypasses disabled — body untouched, no toasts
    // ═══════════════════════════════════════════════════════════════════════════
    console.log("\n=== D. Bypasses disabled — body unchanged, no SEMEX_TOAST fired ===\n");

    const originalBody = JSON.stringify({
      variables: { input: { creditCard: {
        number: ORIGINAL_CARD.number, expirationMonth: ORIGINAL_CARD.expirationMonth,
        expirationYear: ORIGINAL_CARD.expirationYear, cvv: ORIGINAL_CARD.cvv,
      }}}
    });

    let capturedBodyD = null;
    await ctx.route(BT_GQL_URL + "**", async (route) => {
      capturedBodyD = route.request().postData();
      await route.fulfill({
        status: 200, contentType: "application/json", body: BT_TOKENIZE_SUCCESS,
      });
    });

    await page.evaluate(async ({ btUrl, body }) => {
      window.SEMEX_SETTINGS = {
        cvvBypass:       { enabled: false, gateways: { braintree: false } },
        cardReplacement: { enabled: false, gateways: { braintree: false } },
      };
      window.__SEMEX_CURRENT_CARD = null;
      window.__BT_TOASTS__ = [];
      await window.fetch(btUrl, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
    }, { btUrl: BT_GQL_URL, body: originalBody });

    await ctx.unroute(BT_GQL_URL + "**");

    assert(capturedBodyD !== null, "D1: Braintree request intercepted for disabled-bypass test");
    if (capturedBodyD) {
      let bodyD;
      try { bodyD = JSON.parse(capturedBodyD); } catch (_e) { bodyD = null; }
      const ccD = bodyD && bodyD.variables && bodyD.variables.input && bodyD.variables.input.creditCard;
      assertEq(ccD && ccD.cvv, ORIGINAL_CARD.cvv,
        "D2: cvv is present in HTTP request body when bypass is disabled");
      assertEq(ccD && ccD.number, ORIGINAL_CARD.number,
        "D3: card number unchanged when replacement is disabled");
    }
    await page.waitForTimeout(200);
    const toastsD = await page.evaluate(() => window.__BT_TOASTS__);
    assertEq(toastsD.length, 0,
      "D4: no SEMEX_TOAST postMessages when all bypasses are disabled");

  } finally {
    if (ctx) await ctx.close().catch(() => {});
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (_e) {}
  }

  console.log("\n" + "=".repeat(55));
  console.log("  Results: " + passed + " passed, " + failed + " failed");
  console.log("=".repeat(55) + "\n");
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error("E2E harness error:", e); process.exit(1); });
