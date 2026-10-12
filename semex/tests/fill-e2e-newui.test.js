/**
 * fill-e2e-newui.test.js — real-browser integration test for the card-fill
 *                          pipeline on Stripe's NEW "habanero" /g/pay/ UI
 *                          (task #141)
 *
 * SCOPE (read before changing): this is the cross-origin-iframe sibling of
 * fill-e2e.test.js. That test covers the CLASSIC hosted checkout where the card
 * form renders in the TOP frame at checkout.stripe.com. This test covers the
 * newer `/g/pay/` UI, where the entire payment form renders inside a
 * cross-origin `js.stripe.com/elements-inner-*` iframe and the fill is routed
 * through the FILL_FORM_SUBFRAMES path — the most fragile part of the pipeline,
 * with (until now) no live-browser coverage:
 *
 *     page /g/pay/ (MAIN world)              → window.postMessage SEMEX_FILL_FORM
 *       → content.js fillFormFromOverlay     (TOP-frame ISOLATED world)
 *         → background.js CHECK_CONFIG       → writes __xcabuf cache
 *       → fillForm() sees _semexIsNewUIHost  (IS_MAIN_FRAME && /g/pay/)
 *         → safeSendMessage FILL_FORM_SUBFRAMES
 *           → background.js enumerates frames (chrome.webNavigation.getAllFrames)
 *             → chrome.tabs.sendMessage FILL_FORM to the js.stripe.com subframe
 *               → content.js (subframe) fillForm → executeFillSequence
 *                 fills the REAL cross-origin DOM
 *               → chrome.runtime SEMEX_FILL_FORM_COMPLETE_RELAY
 *           → background relays to TOP frame (frameId 0)
 *       → content.js (top) posts window SEMEX_FILL_FORM_COMPLETE to the overlay
 *
 * The fixture serves a /g/pay/ top page (NO card fields — they are cross-origin)
 * plus a route-fulfilled js.stripe.com/elements-inner-* subframe carrying the
 * production Stripe selector IDs (payment-numberInput / payment-expiryInput /
 * payment-cvcInput / payment-nameInput / payment-countryInput /
 * payment-addressLine1Input / payment-postalCodeInput / payment-localityInput).
 * Serving that subframe from js.stripe.com is what makes both the manifest-
 * matched content script inject there AND the background frame enumeration find
 * it.
 *
 * The COMPLEMENTARY guarantee — that those selector strings still match the
 * markup Stripe ships — is owned by the getSelectors-vs-real-HTML snapshot task;
 * this test owns the SUBFRAME fill + relay-completion + no-reload guarantees.
 *
 * Run:  node semex/tests/fill-e2e-newui.test.js
 *  (build the extension first: bash semex/build.sh <API_URL>)
 *
 * Exit codes match fill-e2e.test.js: 1 on any failed assertion OR missing
 * prerequisite (fail-closed); 0 on all-pass, or on a missing prerequisite ONLY
 * when SEMEX_E2E_ALLOW_SKIP=1 is set.
 */

"use strict";

const fs   = require("fs");
const path = require("path");
const os   = require("os");

const ALLOW_SKIP = process.env.SEMEX_E2E_ALLOW_SKIP === "1";
const LAUNCH_TIMEOUT_MS = 60000;
const NAV_TIMEOUT_MS    = 20000;

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

// ─── fixtures ───────────────────────────────────────────────────────────────
// The js.stripe.com elements-inner subframe URL. Includes "elements-inner" so
// the background's early-break (once the card frame acks) fires, exactly like
// the live "habanero" frame name.
const SUBFRAME_URL = "https://js.stripe.com/v3/elements-inner-habanero-e2e.html";

// TOP page: a /g/pay/ ("habanero") hosted-checkout host. Deliberately carries
// NO card fields — on the real new UI they are all cross-origin — only the
// js.stripe.com iframe that holds the whole form. This proves the fill is
// routed to the SUBFRAME, not the top frame.
const GPAY_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>Checkout</title></head>
<body>
  <div id="app">
    <h1>Complete your purchase</h1>
    <iframe id="stripe-elements" title="Secure payment input frame"
            src="${SUBFRAME_URL}" style="width:480px;height:520px;border:0;"></iframe>
    <button id="host-pay" type="button">Pay</button>
  </div>
  <script>
    (function () {
      var n = Number(sessionStorage.getItem("__e2e_loads") || "0") + 1;
      sessionStorage.setItem("__e2e_loads", String(n));
      window.__E2E_LOADS = n;
      // The overlay-completion trail: capture every SEMEX_FILL_FORM_COMPLETE and
      // expose the first frame carrying an explicit ok flag (the authoritative
      // result relayed from the subframe) so the test never reads mid-fill.
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

// SUBFRAME: the real Stripe elements-inner form. Every id is copied VERBATIM
// from the live selector table in semex/utils/server-client.js getSelectors.
const SUBFRAME_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>Stripe Elements</title></head>
<body>
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
  <script>
    // Subframe reload sentinel — if the subframe reloads mid-fill (resetting the
    // just-typed values) this counter goes above 1.
    (function () {
      var n = Number(sessionStorage.getItem("__e2e_sub_loads") || "0") + 1;
      sessionStorage.setItem("__e2e_sub_loads", String(n));
      window.__E2E_SUB_LOADS = n;
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

  const profile = path.join(os.tmpdir(), "semex-e2e-newui-profile-" + Date.now());
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
    // Wait for the MV3 service worker (background.js) to boot — it owns the
    // FILL_FORM_SUBFRAMES frame enumeration this whole test exercises.
    let sw = ctx.serviceWorkers()[0];
    if (!sw) sw = await ctx.waitForEvent("serviceworker", { timeout: 15000 }).catch(() => null);
    assert(!!sw, "MV3 service worker (background.js) booted");

    // Stub all backend calls so the test needs no network / auth.
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

    // Serve the js.stripe.com elements-inner subframe. Must be a REAL
    // js.stripe.com navigation so (a) the manifest-matched content script
    // injects there and (b) background's getAllFrames sees it as a candidate.
    await ctx.route("https://js.stripe.com/**", (route) => {
      if (route.request().resourceType() === "document" ||
          route.request().resourceType() === "sub_frame") {
        return route.fulfill({ status: 200, contentType: "text/html", body: SUBFRAME_HTML });
      }
      return route.fulfill({ status: 200, contentType: "text/plain", body: "" });
    });

    // Serve the /g/pay/ new-UI host page as checkout.stripe.com.
    await ctx.route("https://checkout.stripe.com/**", (route) => {
      if (route.request().resourceType() === "document") {
        return route.fulfill({ status: 200, contentType: "text/html", body: GPAY_HTML });
      }
      return route.fulfill({ status: 200, contentType: "text/plain", body: "" });
    });

    const page = await ctx.newPage();
    page.setDefaultTimeout(NAV_TIMEOUT_MS);

    // Count real main-frame navigations to prove the fill happens with NO reload.
    let navigations = 0;
    page.on("framenavigated", (fr) => { if (fr === page.mainFrame()) navigations++; });

    // New-UI checkout sessions live under /g/pay/ (old classic used /c/pay/).
    await page.goto("https://checkout.stripe.com/g/pay/cs_test_e2e_newui_session", {
      waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS,
    });

    // Wait for the cross-origin subframe to attach + its document_idle content
    // script to boot.
    const subFrame = await page.waitForFunction(() => {
      const f = document.getElementById("stripe-elements");
      return f && f.contentWindow ? true : false;
    }, { timeout: NAV_TIMEOUT_MS }).then(async () => {
      // Give the subframe's content script a beat to attach its FILL_FORM listener.
      await page.waitForTimeout(1500);
      return page.frames().find(fr => fr.url().includes("js.stripe.com")) || null;
    }).catch(() => null);

    assert(!!subFrame, "js.stripe.com elements-inner subframe attached");

    const navsAfterLoad = navigations;
    assertEq(await page.evaluate(() => window.__E2E_LOADS), 1, "top /g/pay/ page loaded exactly once before fill");

    // The card inputs must be cross-origin — the TOP frame must NOT contain them.
    assertEq(
      await page.evaluate(() => !!document.getElementById("payment-numberInput")),
      false,
      "card fields are NOT in the top frame (cross-origin, as on the real new UI)"
    );

    // Trigger the real fill pipeline exactly the way overlay.js does — from the
    // TOP frame. Everything after this must route through FILL_FORM_SUBFRAMES.
    await page.evaluate((card) => {
      window.postMessage({ type: "SEMEX_FILL_FORM", card }, "*");
    }, CARD);

    // Wait for the AUTHORITATIVE completion relayed from the subframe.
    const result = await page.waitForFunction(
      () => window.__E2E_FILL_RESULT,
      { timeout: 15000 }
    ).then(h => h.jsonValue()).catch(() => null);

    assert(!!result, "overlay received a SEMEX_FILL_FORM_COMPLETE via the relay path");
    assert(result && result.ok === true, "relayed fill completion reported ok:true (got " + JSON.stringify(result) + ")");

    // Read the resulting DOM values from INSIDE the subframe.
    const dom = subFrame ? await subFrame.evaluate(() => ({
      cardNumber: document.getElementById("payment-numberInput").value,
      expiry:     document.getElementById("payment-expiryInput").value,
      cvv:        document.getElementById("payment-cvcInput").value,
      name:       document.getElementById("payment-nameInput").value,
      country:    document.getElementById("payment-countryInput").value,
      address:    document.getElementById("payment-addressLine1Input").value,
      city:       document.getElementById("payment-localityInput").value,
      zip:        document.getElementById("payment-postalCodeInput").value,
      subLoads:   window.__E2E_SUB_LOADS,
    })) : {};

    console.log("\n=== filled SUBFRAME DOM ===");
    console.log("  " + JSON.stringify(dom));
    console.log("");

    assertEq(dom.cardNumber, EXPECT.cardNumber, "cardNumber filled in subframe");
    assertEq(dom.expiry,     EXPECT.expiry,     "expiry filled in subframe (MM/YY)");
    assertEq(dom.cvv,        EXPECT.cvv,         "CVV filled in subframe");
    assert(dom.name && dom.name.length > 0,       "name filled in subframe (non-empty): " + JSON.stringify(dom.name));
    assert(dom.address && dom.address.length > 0, "address filled in subframe (non-empty): " + JSON.stringify(dom.address));
    assert(dom.zip && dom.zip.length > 0,         "zip filled in subframe (non-empty): " + JSON.stringify(dom.zip));
    assertEq(dom.country, "US",                  "country selected in subframe");

    // The core promise of this task: no reload during the fill — neither the
    // top /g/pay/ host nor the cross-origin subframe.
    assertEq(await page.evaluate(() => window.__E2E_LOADS), 1, "no top-page reload occurred during fill (load count still 1)");
    assertEq(dom.subLoads, 1, "no subframe reload occurred during fill (subframe load count still 1)");
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
