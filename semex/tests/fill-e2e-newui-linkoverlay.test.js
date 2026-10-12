/**
 * fill-e2e-newui-linkoverlay.test.js — integration test confirming that
 * SEMEX correctly dismisses the Stripe Link overlay when it appears in a
 * SIBLING js.stripe.com frame (not in the elements-inner card frame itself).
 *
 * SCENARIO: On the new /g/pay/ Stripe checkout the payment form lives in the
 * elements-inner-* iframe and the Stripe Link "Pay without Link" button lives
 * in a separate link-authenticate-* sibling iframe.  The old code only searched
 * the elements-inner iframe's own document, so it never found the button and the
 * fill started with the Link overlay still blocking the card fields.
 *
 * This test verifies the new CLICK_PAY_WITHOUT_LINK_SUBFRAMES path:
 *   1.  executeFillSequence (elements-inner) sends CLICK_PAY_WITHOUT_LINK_SUBFRAMES
 *       to the background.
 *   2.  The background broadcasts CLICK_PAY_WITHOUT_LINK to every other
 *       js.stripe.com sibling frame.
 *   3.  The link-authenticate frame receives the message, calls
 *       clickPayWithoutLinkButton(), finds the button, and clicks it.
 *   4.  After dismissal, the elements-inner fill proceeds and the card fields
 *       are populated correctly.
 *   5.  The full relay path (SEMEX_FILL_FORM_COMPLETE_RELAY) completes and the
 *       top frame receives ok:true.
 *
 * Fixture layout:
 *   checkout.stripe.com/g/pay/...         — top /g/pay/ host (no card inputs)
 *     ├── js.stripe.com/elements-inner-*  — card form (payment-*Input fields)
 *     └── js.stripe.com/link-authenticate-*  — Link overlay (pay-without-link btn)
 *
 * Run:  node semex/tests/fill-e2e-newui-linkoverlay.test.js
 *  (build the extension first: bash semex/build.sh <API_URL>)
 *
 * Exit codes: 1 on any failed assertion or missing prerequisite; 0 on all-pass,
 * or on a missing prerequisite ONLY when SEMEX_E2E_ALLOW_SKIP=1 is set.
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

// The elements-inner subframe URL.  Includes "elements-inner" so the
// background's early-break fires on ack (matching production naming).
const ELEMENTS_URL = "https://js.stripe.com/v3/elements-inner-habanero-link-e2e.html";

// The Link authenticate sibling frame URL.  Includes "link-authenticate" so
// we can distinguish it from the card frame in route handling.  The content
// script injects here because the manifest matches all js.stripe.com frames.
const LINK_AUTH_URL = "https://js.stripe.com/v3/link-authenticate-link-e2e.html";

// TOP page: /g/pay/ host embeds BOTH js.stripe.com iframes.  No card inputs
// here — that would prevent the _semexIsNewUIHost path from being taken.
const GPAY_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>Checkout</title></head>
<body>
  <div id="app">
    <h1>Complete your purchase</h1>
    <!-- Card form iframe (elements-inner) -->
    <iframe id="stripe-elements" title="Secure payment input frame"
            src="${ELEMENTS_URL}" style="width:480px;height:520px;border:0;"></iframe>
    <!-- Link overlay iframe (link-authenticate sibling) -->
    <iframe id="stripe-link" title="Stripe Link"
            src="${LINK_AUTH_URL}" style="width:480px;height:200px;border:0;"></iframe>
    <button id="host-pay" type="button">Pay</button>
  </div>
  <script>
    (function () {
      var n = Number(sessionStorage.getItem("__e2e_loads") || "0") + 1;
      sessionStorage.setItem("__e2e_loads", String(n));
      window.__E2E_LOADS = n;
      // Capture every SEMEX_FILL_FORM_COMPLETE from the relay path.
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

// ELEMENTS-INNER subframe: card form with canonical Stripe habanero field IDs.
// No Link button here — it's in the sibling link-authenticate frame.
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
    <button type="submit" data-testid="pay-button">Pay</button>
  </form>
  <script>
    (function () {
      var n = Number(sessionStorage.getItem("__e2e_sub_loads") || "0") + 1;
      sessionStorage.setItem("__e2e_sub_loads", String(n));
      window.__E2E_SUB_LOADS = n;
    })();
  </script>
</body></html>`;

// LINK-AUTHENTICATE sibling frame: simulates the Stripe Link overlay that
// renders SEPARATELY from the card form.  Has a "Pay without Link" button
// with the testid selector clickPayWithoutLinkButton() targets.
// Tracks click count so the test can assert the button was actually clicked.
const LINK_FRAME_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>Stripe Link</title></head>
<body>
  <div id="link-overlay">
    <p>Continue with Link</p>
    <!-- This is the button clickPayWithoutLinkButton() looks for.
         data-testid="pay-without-link" is the highest-priority selector. -->
    <button data-testid="pay-without-link" id="pwl-btn">Pay without Link</button>
  </div>
  <script>
    (function () {
      window.__E2E_LINK_CLICKS = 0;
      var btn = document.getElementById("pwl-btn");
      btn.addEventListener("click", function () {
        window.__E2E_LINK_CLICKS++;
        // Hide the overlay after click, as Stripe does.
        document.getElementById("link-overlay").style.display = "none";
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

const CARD   = { number: "4242424242424242", month: "12", year: "2030", cvv: "123" };
const EXPECT = { cardNumber: "4242424242424242", expiry: "12/30", cvv: "123" };

async function main() {
  const exe = findChromium();
  if (!exe) unmet("no runnable Chromium found (nix playwright-browsers or playwright install).");
  console.log("Using Chromium: " + exe);

  const profile = path.join(os.tmpdir(), "semex-e2e-linkoverlay-profile-" + Date.now());
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

    // Stub all backend calls — no network / auth needed.
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

    // Serve each js.stripe.com URL with its dedicated HTML.
    // The URL segment is the distinguishing factor.
    await ctx.route("https://js.stripe.com/**", (route) => {
      if (route.request().resourceType() !== "document" &&
          route.request().resourceType() !== "sub_frame") {
        return route.fulfill({ status: 200, contentType: "text/plain", body: "" });
      }
      const url = route.request().url();
      if (url.includes("link-authenticate")) {
        // Link overlay sibling frame with "Pay without Link" button.
        return route.fulfill({ status: 200, contentType: "text/html", body: LINK_FRAME_HTML });
      }
      // elements-inner card form frame (default).
      return route.fulfill({ status: 200, contentType: "text/html", body: SUBFRAME_HTML });
    });

    // Serve the /g/pay/ new-UI host page.
    await ctx.route("https://checkout.stripe.com/**", (route) => {
      if (route.request().resourceType() === "document") {
        return route.fulfill({ status: 200, contentType: "text/html", body: GPAY_HTML });
      }
      return route.fulfill({ status: 200, contentType: "text/plain", body: "" });
    });

    const page = await ctx.newPage();
    page.setDefaultTimeout(NAV_TIMEOUT_MS);

    let navigations = 0;
    page.on("framenavigated", (fr) => { if (fr === page.mainFrame()) navigations++; });

    await page.goto("https://checkout.stripe.com/g/pay/cs_test_e2e_linkoverlay", {
      waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS,
    });

    // Wait for BOTH iframes to attach and their content scripts to boot.
    await page.waitForFunction(() => {
      const el = document.getElementById("stripe-elements");
      const lk = document.getElementById("stripe-link");
      return el && el.contentWindow && lk && lk.contentWindow;
    }, { timeout: NAV_TIMEOUT_MS });
    // Give both content scripts a beat to attach their message listeners.
    await page.waitForTimeout(1800);

    const allFrames  = page.frames();
    const elemFrame  = allFrames.find(fr => fr.url().includes("elements-inner")) || null;
    const linkFrame  = allFrames.find(fr => fr.url().includes("link-authenticate")) || null;

    assert(!!elemFrame, "elements-inner subframe attached");
    assert(!!linkFrame, "link-authenticate sibling frame attached");

    const navsBeforeFill = navigations;

    // Confirm the card inputs are NOT in the top frame (cross-origin).
    assertEq(
      await page.evaluate(() => !!document.getElementById("payment-numberInput")),
      false,
      "card fields are NOT in the top frame (cross-origin)"
    );

    // Confirm the Link button is NOT in the elements-inner frame.
    const linkBtnInElemFrame = elemFrame ? await elemFrame.evaluate(() =>
      !!document.querySelector("[data-testid='pay-without-link']")
    ) : false;
    assertEq(linkBtnInElemFrame, false, "'Pay without Link' button is NOT in the elements-inner frame");

    // Confirm the Link button IS in the link-authenticate sibling frame.
    const linkBtnInLinkFrame = linkFrame ? await linkFrame.evaluate(() =>
      !!document.querySelector("[data-testid='pay-without-link']")
    ) : false;
    assert(linkBtnInLinkFrame, "'Pay without Link' button IS present in the link-authenticate sibling frame");

    // Trigger the fill pipeline exactly as overlay.js does — from the TOP frame.
    // Everything after this must route through FILL_FORM_SUBFRAMES.
    await page.evaluate((card) => {
      window.postMessage({ type: "SEMEX_FILL_FORM", card }, "*");
    }, CARD);

    // Wait for the fill completion relayed from the elements-inner frame.
    // The fill includes the 2500ms Link poll + 500ms settle, so allow up to 15s.
    const result = await page.waitForFunction(
      () => window.__E2E_FILL_RESULT,
      { timeout: 15000 }
    ).then(h => h.jsonValue()).catch(() => null);

    assert(!!result, "overlay received SEMEX_FILL_FORM_COMPLETE via relay");
    assert(result && result.ok === true,
      "relayed fill completion reported ok:true (got " + JSON.stringify(result) + ")");

    // Verify the "Pay without Link" button in the sibling frame was clicked.
    // This is the core assertion: CLICK_PAY_WITHOUT_LINK_SUBFRAMES caused
    // clickPayWithoutLinkButton() to run inside the link-authenticate frame.
    const linkClicks = linkFrame ? await linkFrame.evaluate(() => window.__E2E_LINK_CLICKS) : 0;
    assert(linkClicks >= 1,
      "'Pay without Link' button in sibling frame was clicked (clicks=" + linkClicks + ")");

    // Verify card fields were populated in the elements-inner frame.
    const dom = elemFrame ? await elemFrame.evaluate(() => ({
      cardNumber: document.getElementById("payment-numberInput").value,
      expiry:     document.getElementById("payment-expiryInput").value,
      cvv:        document.getElementById("payment-cvcInput").value,
      name:       document.getElementById("payment-nameInput").value,
      country:    document.getElementById("payment-countryInput").value,
      subLoads:   window.__E2E_SUB_LOADS,
    })) : {};

    console.log("\n=== filled SUBFRAME DOM ===");
    console.log("  " + JSON.stringify(dom));
    console.log("");

    assertEq(dom.cardNumber, EXPECT.cardNumber, "cardNumber filled in elements-inner frame");
    assertEq(dom.expiry,     EXPECT.expiry,     "expiry filled in elements-inner frame (MM/YY)");
    assertEq(dom.cvv,        EXPECT.cvv,         "CVV filled in elements-inner frame");
    assert(dom.name && dom.name.length > 0,     "name filled in elements-inner frame (non-empty)");
    assertEq(dom.country, "US",                 "country selected in elements-inner frame");

    // No reload during fill.
    assertEq(await page.evaluate(() => window.__E2E_LOADS), 1,
      "no top-page reload during fill");
    assertEq(dom.subLoads, 1, "no elements-inner frame reload during fill");
    assertEq(navigations, navsBeforeFill, "no main-frame navigation during fill");

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
