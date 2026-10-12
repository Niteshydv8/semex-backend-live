/**
 * basistheory-swap-e2e.test.js
 *
 * Real-browser verification of the Whop / Basis Theory card-replacement swap.
 *
 * Why a harness instead of the live Whop checkout: the swap happens inside the
 * browser's MAIN-world fetch hook BEFORE the request leaves the page, so a
 * local page that (a) stages a pending card exactly like content.js does in a
 * BT iframe and (b) fires the documented BT tokenize request exercises the
 * identical code path — with api.basistheory.com route-mocked, so no payment
 * data ever touches a real server. What this does NOT prove is Whop's live
 * wire format (that remains a manual browser check before release).
 *
 *   Test A (CR disabled)  → body passes through UNCHANGED (fail-safe off)
 *   Test B (CR enabled)   → outgoing body carries the STAGED card, not the decoy
 *                           + CARD_REPLACED "Basis Theory" toast fires
 *   Test C (wrong shape)  → non-card-shaped body passes through UNCHANGED
 *
 * Run:  node tests/basistheory-swap-e2e.test.js
 * Skips cleanly (exit 0) with SEMEX_E2E_ALLOW_SKIP=1 when Chromium is missing.
 */

"use strict";

const fs = require("fs");
const http = require("http");
const path = require("path");
const os = require("os");

const ALLOW_SKIP = process.env.SEMEX_E2E_ALLOW_SKIP === "1";
const EXT_DIR = path.resolve(__dirname, "..", "..", "semex-build");
const FIXTURES_DIR = path.resolve(__dirname, "fixtures");
const PORT = 8791;

function unmet(reason) {
  if (ALLOW_SKIP) { console.log("SKIP (SEMEX_E2E_ALLOW_SKIP=1): " + reason); process.exit(0); }
  console.error("FAIL: " + reason);
  process.exit(1);
}
if (!fs.existsSync(path.join(EXT_DIR, "manifest.json"))) unmet("extension not built at " + EXT_DIR);

let chromium;
try { ({ chromium } = require("playwright-core")); } catch (_e) { unmet("playwright-core not installed"); }

function findChromium() {
  try {
    for (const n of fs.readdirSync("/nix/store")) {
      if (!n.endsWith("-playwright-browsers-chromium")) continue;
      for (const v of fs.readdirSync(path.join("/nix/store", n))) {
        if (!v.startsWith("chromium-")) continue;
        const exe = path.join("/nix/store", n, v, "chrome-linux", "chrome");
        if (fs.existsSync(exe)) return exe;
      }
    }
  } catch (_e) {}
  return null;
}

function serveFixtures() {
  const server = http.createServer((req, res) => {
    const p = path.join(FIXTURES_DIR, (req.url || "/").split("?")[0]);
    fs.readFile(p, (err, data) => {
      if (err) { res.writeHead(404); res.end("nope"); return; }
      res.writeHead(200, { "Content-Type": p.endsWith(".html") ? "text/html" : "application/octet-stream" });
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(PORT, "127.0.0.1", () => resolve(server)));
}

const DECOY_BODY = { type: "card", data: { number: "4111111111111111", expiration_month: 12, expiration_year: 2030, cvc: "123" } };
const REAL_CARD = { number: "5555555555554444", month: "10", year: "2029", cvv: "456" };

let failures = 0;
function assert(cond, label, extra) {
  if (cond) console.log("  ✓  " + label);
  else { console.error("  ✗  " + label + (extra ? "\n     " + extra : "")); failures++; }
}

(async () => {
  const exe = findChromium();
  if (!exe) unmet("no runnable Chromium found");
  const server = await serveFixtures();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "semex-bt-e2e-"));

  const ctx = await chromium.launchPersistentContext(profile, {
    executablePath: exe,
    headless: true,
    args: [
      "--headless=new",
      "--no-sandbox",
      "--disable-extensions-except=" + EXT_DIR,
      "--load-extension=" + EXT_DIR
    ]
  });

  // Mock api.basistheory.com: capture the post-swap body, never continue.
  const captured = [];
  await ctx.route("**://api.basistheory.com/**", async (route) => {
    const req = route.request();
    captured.push({ method: req.method(), url: req.url(), body: req.postData() });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ id: "00000000-0000-4000-8000-000000000000", type: "card", data: {} })
    });
  });

  async function runCase(label, settings, body, realCard) {
    captured.length = 0;
    const page = await ctx.newPage();
    await page.goto("http://127.0.0.1:" + PORT + "/bt-swap-harness.html", { waitUntil: "load" });
    await page.waitForTimeout(1200); // let the MV3 service worker + MAIN-world hook settle
    const result = await page.evaluate(
      ([s, b, c]) => {
        window.SEMEX_SETTINGS = s;
        return window.__runSwapTest(b, c);
      },
      [settings, body, realCard]
    );
    await page.waitForTimeout(300);
    await page.close();
    console.log("  [" + label + "] fetch status:", result && result.status, "err:", result && result.err);
    return { result, req: captured.find((r) => r.method === "POST") || null };
  }

  // ── Test A: CR disabled → passthrough ──────────────────────────────────────
  console.log("\nA. CR disabled: tokenize body passes through UNCHANGED");
  {
    const { result, req } = await runCase(
      "A",
      { cvvBypass: { enabled: false, gateways: {} }, cardReplacement: { enabled: false, gateways: { basistheory: true } } },
      DECOY_BODY,
      null
    );
    assert(!!req, "A1: api.basistheory.com POST captured");
    if (req) {
      const sent = JSON.parse(req.body);
      assert(sent.data && sent.data.number === "4111111111111111", "A2: decoy number unchanged in outgoing body", req.body);
      assert(sent.data.cvc === "123", "A3: cvc unchanged", req.body);
    }
    assert(result && result.cardReplacedToasts.length === 0, "A4: no CARD_REPLACED toast when CR is off");
  }

  // ── Test B: CR enabled → swap fires ────────────────────────────────────────
  console.log("\nB. CR enabled: outgoing body carries the STAGED card, not the decoy");
  {
    const { result, req } = await runCase(
      "B",
      { cvvBypass: { enabled: false, gateways: {} }, cardReplacement: { enabled: true, gateways: { basistheory: true } } },
      DECOY_BODY,
      Object.assign({}, REAL_CARD, { persistent: true, ts: Date.now() })
    );
    assert(!!req, "B1: api.basistheory.com POST captured");
    if (req) {
      const sent = JSON.parse(req.body);
      assert(sent.data && sent.data.number === REAL_CARD.number, "B2: staged real card number swapped in", req.body);
      assert(!req.body.includes("4111111111111111"), "B3: decoy number absent from outgoing body", req.body);
      assert(String(sent.data.expiration_month) === "10", "B4: expiration_month swapped (10)", req.body);
      assert(String(sent.data.expiration_year) === "2029", "B5: expiration_year swapped (2029)", req.body);
      assert(String(sent.data.cvc) === "456", "B6: cvc swapped (456)", req.body);
    }
    const toast = result && result.cardReplacedToasts[0];
    assert(!!toast && toast.gateway === "Basis Theory", "B7: CARD_REPLACED toast (gateway Basis Theory) fired",
      JSON.stringify(result && result.cardReplacedToasts));
  }

  // ── Test C: wrong shape → passthrough (fail-safe exact-match gate) ─────────
  console.log("\nC. Non-card-shaped body: UNCHANGED even with CR on and a card staged");
  {
    const weird = { type: "token", data: { number: "not-a-pan" } };
    const { req } = await runCase(
      "C",
      { cvvBypass: { enabled: false, gateways: {} }, cardReplacement: { enabled: true, gateways: { basistheory: true } } },
      weird,
      Object.assign({}, REAL_CARD, { persistent: true, ts: Date.now() })
    );
    assert(!!req, "C1: request captured");
    if (req) {
      assert(req.body === JSON.stringify(weird), "C2: body byte-identical (no mutation)", req.body);
    }
  }

  await ctx.close();
  server.close();
  fs.rmSync(profile, { recursive: true, force: true });

  console.log("\n" + (failures === 0 ? "ALL PASSED" : failures + " FAILED") + " — basistheory-swap-e2e");
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error("E2E error:", e); process.exit(1); });
