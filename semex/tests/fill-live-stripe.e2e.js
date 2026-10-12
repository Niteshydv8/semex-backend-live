/**
 * fill-live-stripe.e2e.js — OPT-IN live Stripe Checkout fill confirmation
 *                           (task #136, live-validation half)
 *
 * This is the companion to the deterministic fixture test (fill-e2e.test.js).
 * Where the fixture test proves the extension's message/fill pipeline against a
 * production-ID DOM, THIS test drives the extension against a REAL Stripe
 * hosted-checkout page created from a controlled TEST-MODE session — so it
 * exercises Stripe's live markup, real cross-origin js.stripe.com iframe layout,
 * and runtime behavior.
 *
 * It is OPT-IN because it needs (a) a Stripe TEST-MODE secret key and (b)
 * outbound network to api.stripe.com + checkout.stripe.com. Neither belongs in
 * the default portable suite. Provide the key via the STRIPE_TEST_SECRET_KEY
 * secret/env (must start with "sk_test_"). Credentials are read from the
 * environment only and are never written to source or logged.
 *
 * Run:  STRIPE_TEST_SECRET_KEY=sk_test_... npm run test:e2e:live   (from semex/)
 *
 * Exit codes:
 *   0  all live-fill assertions passed.
 *   1  an assertion failed, or a prerequisite that IS present but broken failed
 *      (e.g. Stripe session creation errored, Chromium launch failed).
 *   0  SKIP — no STRIPE_TEST_SECRET_KEY provided (this test is opt-in) OR
 *      SEMEX_E2E_ALLOW_SKIP=1 with a missing tool. A skip is clearly logged and
 *      never counts as a passed live validation.
 */

"use strict";

const fs   = require("fs");
const path = require("path");
const os   = require("os");

const KEY = process.env.STRIPE_TEST_SECRET_KEY || "";
const ALLOW_SKIP = process.env.SEMEX_E2E_ALLOW_SKIP === "1";
const LAUNCH_TIMEOUT_MS = 60000;
const NAV_TIMEOUT_MS    = 45000;

function skip(reason) { console.log("SKIP: " + reason); process.exit(0); }
function fail(reason) { console.error("FAIL: " + reason); process.exit(1); }

if (!KEY) {
  skip("STRIPE_TEST_SECRET_KEY not set — live Stripe checkout test is opt-in. " +
       "Set a sk_test_... key to run it.");
}
if (!/^sk_test_/.test(KEY)) {
  fail("STRIPE_TEST_SECRET_KEY must be a TEST-MODE key (starts with 'sk_test_'). " +
       "Refusing to run against a live key.");
}

let chromium;
try {
  ({ chromium } = require(path.join(__dirname, "../../node_modules/playwright")));
} catch (_e) {
  if (ALLOW_SKIP) skip("playwright not installed.");
  fail("playwright not installed (npm i -D playwright).");
}

const EXT_DIR = path.resolve(__dirname, "../../semex-build");
if (!fs.existsSync(path.join(EXT_DIR, "manifest.json"))) {
  fail("built extension not found at " + EXT_DIR + " (run ./semex/build.sh first).");
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
  try { const p = chromium.executablePath(); if (p && fs.existsSync(p)) return p; } catch (_e) {}
  return null;
}

// ─── create a controlled test-mode Checkout Session (no SDK dependency) ──────

async function createCheckoutSession() {
  // Inline price_data so the test needs no pre-created product/price.
  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("success_url", "https://example.com/success?s={CHECKOUT_SESSION_ID}");
  form.set("cancel_url", "https://example.com/cancel");
  form.set("line_items[0][quantity]", "1");
  form.set("line_items[0][price_data][currency]", "usd");
  form.set("line_items[0][price_data][unit_amount]", "1000");
  form.set("line_items[0][price_data][product_data][name]", "SEMEX E2E test item");

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + KEY,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.url) {
    // Never print the key; Stripe error bodies do not echo the auth header.
    throw new Error("Stripe session creation failed (HTTP " + res.status + "): " +
      (json && json.error ? json.error.message : "no url returned"));
  }
  return json.url;
}

// ─── assertions ─────────────────────────────────────────────────────────────

let passed = 0, failed = 0;
function assert(cond, name) {
  if (cond) { console.log("  \u2713  " + name); passed++; }
  else      { console.error("  \u2717  " + name); failed++; }
}

const CARD = { number: "4242424242424242", month: "12", year: "2030", cvv: "123" };

// Read a Stripe payment field value from whichever frame currently hosts it
// (top frame on /c/pay/, cross-origin js.stripe.com iframe on /g/pay/).
async function readFieldAcrossFrames(page, selector) {
  for (const fr of page.frames()) {
    try {
      const v = await fr.evaluate((sel) => {
        const el = document.querySelector(sel);
        return el ? (el.value || "") : null;
      }, selector);
      if (v !== null && v !== "") return { value: v, frame: fr.url() };
    } catch (_e) {}
  }
  return { value: "", frame: null };
}

async function main() {
  const exe = findChromium();
  if (!exe) { if (ALLOW_SKIP) skip("no runnable Chromium."); fail("no runnable Chromium found."); }
  console.log("Using Chromium: " + exe);

  let sessionUrl;
  try {
    sessionUrl = await createCheckoutSession();
  } catch (e) {
    fail(String(e.message));
  }
  console.log("Created test-mode Checkout session (host: " + new URL(sessionUrl).host + ")");

  const profile = path.join(os.tmpdir(), "semex-live-profile-" + Date.now());
  let ctx;
  try {
    ctx = await chromium.launchPersistentContext(profile, {
      headless: false,
      executablePath: exe,
      timeout: LAUNCH_TIMEOUT_MS,
      args: [
        "--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
        "--disable-extensions-except=" + EXT_DIR,
        "--load-extension=" + EXT_DIR,
      ],
    });
  } catch (e) {
    if (ALLOW_SKIP) skip("Chromium launch failed: " + String(e.message).split("\n")[0]);
    fail("Chromium launch failed within " + LAUNCH_TIMEOUT_MS + "ms: " + String(e.message).split("\n")[0]);
  }

  try {
    let sw = ctx.serviceWorkers()[0];
    if (!sw) sw = await ctx.waitForEvent("serviceworker", { timeout: 15000 }).catch(() => null);
    assert(!!sw, "MV3 service worker (background.js) booted");

    // Keep the extension's own version gate happy without touching Stripe traffic.
    await ctx.route(/https?:\/\/([a-z0-9.-]*\.)?semxhitter\.pw\/api\/public\/version.*/i, (r) =>
      r.fulfill({ status: 200, contentType: "application/json",
                  body: JSON.stringify({ minVersion: "0.0.1", latestVersion: "0.0.1" }) }));

    const page = await ctx.newPage();
    page.setDefaultTimeout(NAV_TIMEOUT_MS);

    let navigations = 0;
    page.on("framenavigated", (fr) => { if (fr === page.mainFrame()) navigations++; });

    await page.goto(sessionUrl, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
    assert(/checkout\.stripe\.com/.test(page.url()), "landed on a real checkout.stripe.com page");

    // Let Stripe mount its (cross-origin) card fields.
    await page.waitForTimeout(3500);
    const navsAfterLoad = navigations;

    // Install a completion listener in the top frame.
    await page.evaluate(() => {
      window.__LIVE_FILL = null;
      window.addEventListener("message", (ev) => {
        if (ev.data && ev.data.type === "SEMEX_FILL_FORM_COMPLETE" &&
            typeof ev.data.ok === "boolean" && window.__LIVE_FILL === null) {
          window.__LIVE_FILL = ev.data;
        }
      });
    });

    // Trigger the real fill exactly the way overlay.js does.
    await page.evaluate((card) => window.postMessage({ type: "SEMEX_FILL_FORM", card }, "*"), CARD);

    // The relay path (cross-origin) can take a moment; poll fields directly too.
    const deadline = Date.now() + 20000;
    let cardVal = "", expVal = "", cvcVal = "";
    while (Date.now() < deadline) {
      cardVal = (await readFieldAcrossFrames(page, 'input[id="payment-numberInput"], input[id="Field-numberInput"], input[name="cardNumber"], input[autocomplete="cc-number"]')).value;
      if (cardVal) break;
      await page.waitForTimeout(500);
    }
    expVal = (await readFieldAcrossFrames(page, 'input[id="payment-expiryInput"], input[id="Field-expiryInput"], input[name="expiry"], input[autocomplete="cc-exp"]')).value;
    cvcVal = (await readFieldAcrossFrames(page, 'input[id="payment-cvcInput"], input[id="Field-cvcInput"], input[name="cvc"], input[autocomplete="cc-csc"]')).value;

    assert(cardVal.replace(/\s/g, "") === CARD.number, "card number filled in the live Stripe frame (got " + JSON.stringify(cardVal) + ")");
    assert(/12\s*\/?\s*30/.test(expVal), "expiry filled in the live Stripe frame (got " + JSON.stringify(expVal) + ")");
    assert(cvcVal === CARD.cvv, "CVV filled in the live Stripe frame (got " + JSON.stringify(cvcVal) + ")");

    // No main-frame reload during the fill.
    assert(navigations === navsAfterLoad, "no main-frame navigation/reload during fill");

  } finally {
    if (ctx) await ctx.close().catch(() => {});
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (_e) {}
  }

  console.log("\n" + "=".repeat(45));
  console.log("  Live results: " + passed + " passed, " + failed + " failed");
  console.log("=".repeat(45) + "\n");
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error("Live E2E harness error:", e); process.exit(1); });
