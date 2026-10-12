/**
 * version-check-e2e.test.js
 *
 * Real-browser verification for the version-gate CORS fix: the proactive
 * version check must be proxied through the service worker, so loading ANY
 * page (merchant checkout included) produces no page-origin CORS errors for
 * the SEMEX API, while the outdated-banner flow still works end to end.
 *
 *   Case 1 (outdated): mock /api/public/version with minVersion 99.0.0 →
 *                      the request is captured (made by the SW), the outdated
 *                      banner renders, and ZERO CORS errors hit the console.
 *   Case 2 (healthy):  minVersion 0.0.0 → request captured, NO banner, ZERO
 *                      CORS errors.
 *
 * Run:  node tests/version-check-e2e.test.js
 * Skips cleanly (exit 0) with SEMEX_E2E_ALLOW_SKIP=1 when Chromium is missing.
 */

"use strict";

const fs = require("fs");
const http = require("http");
const path = require("path");
const os = require("os");

const ALLOW_SKIP = process.env.SEMEX_E2E_ALLOW_SKIP === "1";
const EXT_DIR = path.resolve(__dirname, "..", "..", "semex-build");
const PORT = 8792;

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

function servePage() {
  const html = "<!doctype html><html><head><meta charset=utf-8><title>checkout fixture</title></head><body><h1>fixture checkout</h1></body></html>";
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(html);
  });
  return new Promise((resolve) => server.listen(PORT, "127.0.0.1", () => resolve(server)));
}

let failures = 0;
function assert(cond, label, extra) {
  if (cond) console.log("  ✓  " + label);
  else { console.error("  ✗  " + label + (extra ? "\n     " + extra : "")); failures++; }
}

(async () => {
  const exe = findChromium();
  if (!exe) unmet("no runnable Chromium found");
  const server = await servePage();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "semex-ver-e2e-"));

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

  // Warm the service worker before the fixture pages load (a real browser
  // almost always has it warm; the content script also retries once on cold
  // start — covered by this run happening to exercise both paths).
  if (!ctx.serviceWorkers()[0]) await ctx.waitForEvent("serviceworker");

  const captured = [];
  let mockMinVersion = "99.0.0";
  let onVersionReq = null;
  await ctx.route("**://api.semxhitter.pw/**", async (route) => {
    const url = route.request().url();
    captured.push(url);
    if (url.includes("/api/public/version") && onVersionReq) { const f = onVersionReq; onVersionReq = null; f(); }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ minVersion: mockMinVersion, latestVersion: "99.0.0", downloadUrl: "https://example.invalid/x.zip" })
    });
  });

  async function runCase() {
    captured.length = 0;
    const pageErrors = [];
    const page = await ctx.newPage();
    page.on("console", (m) => { if (m.type() === "error") pageErrors.push(m.text()); });
    page.on("pageerror", (e) => pageErrors.push(String(e)));
    const versionSeen = Promise.race([
      new Promise((res) => { onVersionReq = res; }),
      new Promise((res) => setTimeout(() => res("timeout"), 15000))
    ]);
    await page.goto("http://127.0.0.1:" + PORT + "/checkout", { waitUntil: "load" });
    await versionSeen; // wait for the SW-routed check to actually reach the mock
    // Banner render follows the fetch response; give it a real window, not a fixed sleep.
    let banner = null;
    try { banner = await page.waitForSelector("#semex-outdated-banner, #semex-outdated-paywall", { timeout: 6000 }); }
    catch (_e) { banner = null; }
    const corsErrs = pageErrors.filter((t) => /semxhitter/i.test(t) && /CORS/i.test(t));
    await page.close();
    return { banner: !!banner, corsErrs: corsErrs, requests: captured.slice(), allErrs: pageErrors };
  }

  console.log("\n1. Outdated version: banner renders, version request happens, NO CORS errors");
  {
    mockMinVersion = "99.0.0";
    const r = await runCase();
    assert(r.requests.some((u) => u.includes("/api/public/version")), "1a: /api/public/version was requested", JSON.stringify(r.requests));
    assert(r.banner, "1b: outdated banner rendered");
    assert(r.corsErrs.length === 0, "1c: zero CORS errors mentioning the SEMEX API", r.corsErrs.join("\n"));
  }

  console.log("\n2. Healthy version: check still runs, NO banner, NO CORS errors");
  {
    mockMinVersion = "0.0.0";
    const r = await runCase();
    assert(r.requests.some((u) => u.includes("/api/public/version")), "2a: /api/public/version was requested", JSON.stringify(r.requests));
    assert(!r.banner, "2b: no outdated banner");
    assert(r.corsErrs.length === 0, "2c: zero CORS errors mentioning the SEMEX API", r.corsErrs.join("\n"));
  }

  await ctx.close();
  server.close();
  fs.rmSync(profile, { recursive: true, force: true });

  console.log("\n" + (failures === 0 ? "ALL PASSED" : failures + " FAILED") + " — version-check-e2e");
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error("E2E error:", e); process.exit(1); });
