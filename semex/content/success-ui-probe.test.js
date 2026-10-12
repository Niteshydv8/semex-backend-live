/**
 * success-ui-probe.test.js
 *
 * Integration tests for the success-aware screenshot probe (v4.0.8).
 *
 * IMPORTANT: reads and executes the REAL production source files at runtime —
 *   semex/content/content.js   (detector + SEMEX_SUCCESS_UI_PROBE listener)
 *   semex/background.js        (probe loop timing block)
 * Regressions in the actual detector heuristics, listener registration, probe
 * handler, or timing constants will immediately break these tests.
 *
 * Parts:
 *   A) _semexDetectSuccessUi() extracted from content.js — all four heuristics
 *   B) Real SEMEX_SUCCESS_UI_PROBE listener from content.js run in vm — verifies
 *      ready:true / ready:false responses and the sub-frame guard
 *   C) Background probe loop extracted from background.js — timing verification
 *      with direct settle-gap assertion (readyReceivedAt → return ≥ 330ms)
 *   D) Full end-to-end pipeline:
 *        • Real content.js listener registered and dispatched inside vm
 *        • Real background.js probe loop drives the polling
 *        • DOM flips from "loading" to Stripe green tick mid-run
 *        • Mock captureVisibleTab timestamped; asserts it fires only AFTER tick
 *          appears AND that the gap from ready:true to capture ≥ 330ms (350ms
 *          settle constant minus 20ms timer jitter)
 *
 * Run:  node semex/content/success-ui-probe.test.js
 *       (or: cd semex && npm test)
 */

"use strict";

const fs   = require("fs");
const path = require("path");
const vm   = require("vm");

// ─── Source files ─────────────────────────────────────────────────────────────

const CONTENT_JS = path.join(__dirname, "content.js");
const BG_JS      = path.join(__dirname, "..", "background/background.js");

for (const f of [CONTENT_JS, BG_JS]) {
  if (!fs.existsSync(f)) throw new Error("Source file not found: " + f);
}

const CONTENT_SRC = fs.readFileSync(CONTENT_JS, "utf8");
const BG_SRC      = fs.readFileSync(BG_JS, "utf8");

// ─── Source extraction ────────────────────────────────────────────────────────

/** Extract `function name() { … }` from src by counting braces. */
function extractNamedFn(src, name) {
  const marker = "function " + name + "()";
  const start = src.indexOf(marker);
  if (start === -1) throw new Error("Not found in source: " + name);
  let depth = 0, i = start;
  while (i < src.length) {
    if      (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) { i++; break; } }
    i++;
  }
  return src.slice(start, i);
}

/**
 * Extract the `chrome.runtime.onMessage.addListener(callback)` call that
 * contains `containingMarker`, by counting parentheses.
 */
function extractOnMessageListener(src, containingMarker) {
  const midx = src.indexOf(containingMarker);
  if (midx === -1) throw new Error("Marker not found: " + containingMarker);
  const listenerStr = "chrome.runtime.onMessage.addListener(";
  const listStart   = src.lastIndexOf(listenerStr, midx);
  if (listStart === -1) throw new Error("addListener not found before marker");
  // The ( that opens the call argument list
  const openParen = listStart + listenerStr.length - 1;
  let depth = 0, i = openParen;
  while (i < src.length) {
    if      (src[i] === "(") depth++;
    else if (src[i] === ")") { depth--; if (depth === 0) { i++; break; } }
    i++;
  }
  if (src[i] === ";") i++;
  return src.slice(listStart, i);
}

/**
 * Find `marker` in src, then walk FORWARD from that position to the next `{`,
 * and extract the complete `{ … }` block (including nested braces).
 * Used to extract the full probe+capture block that follows the dedup-cache
 * cleanup line in background.js.
 */
function extractBlockAfterMarker(src, marker) {
  const midx = src.indexOf(marker);
  if (midx === -1) throw new Error("Marker not found: " + marker);
  let open = midx;
  while (open < src.length && src[open] !== "{") open++;
  if (open >= src.length) throw new Error("No { found after marker: " + marker);
  let depth = 0, i = open;
  while (i < src.length) {
    if      (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) { i++; break; } }
    i++;
  }
  return src.slice(open, i);
}

/**
 * Find `containingMarker` in src, walk BACK to the nearest `{`, then forward
 * to its matching `}`.  Returns the complete `{ … }` block.
 */
function extractBlockBeforeMarker(src, marker) {
  const midx = src.indexOf(marker);
  if (midx === -1) throw new Error("Marker not found: " + marker);
  let open = midx - 1;
  while (open >= 0 && src[open] !== "{") open--;
  if (open < 0) throw new Error("No { found before marker: " + marker);
  let depth = 0, i = open;
  while (i < src.length) {
    if      (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) { i++; break; } }
    i++;
  }
  return src.slice(open, i);
}

// ─── Pre-extract and sanity-check all real source snippets ───────────────────

// A/B: detector function from content.js
const DETECTOR_SRC = extractNamedFn(CONTENT_SRC, "_semexDetectSuccessUi");
for (const sig of [
  "success|succeed|complete|thank|receipt|confirm",
  "Checkmark",
  "semex-overlay",
  "payment (successful|complete|confirmed|received)",
]) {
  if (!DETECTOR_SRC.includes(sig))
    throw new Error("_semexDetectSuccessUi missing heuristic in source: " + sig);
}

// B/D: full onMessage listener from content.js (includes SEMEX_SUCCESS_UI_PROBE handler)
const LISTENER_SRC = extractOnMessageListener(CONTENT_SRC, '"SEMEX_SUCCESS_UI_PROBE"');
if (!LISTENER_SRC.includes("_semexDetectSuccessUi"))
  throw new Error("Extracted listener does not call _semexDetectSuccessUi");
if (!LISTENER_SRC.includes("window !== window.top"))
  throw new Error("Sub-frame guard not found in extracted listener");

// C: probe loop block from background.js (probe wait only — for timing unit tests)
const BG_PROBE_BLOCK = extractBlockBeforeMarker(BG_SRC, "const _semexWaitT0 = Date.now();");
if (!BG_PROBE_BLOCK.includes("SEMEX_SUCCESS_UI_PROBE"))
  throw new Error("Probe block does not send SEMEX_SUCCESS_UI_PROBE");
if (!BG_PROBE_BLOCK.includes("350"))
  throw new Error("350ms settle constant missing from probe block");
if (!BG_PROBE_BLOCK.includes("800"))
  throw new Error("800ms fallback constant missing from probe block");

// D: full probe+capture block from background.js (lines ~686-800).
// The outer block `{ try { <probe loop> <_semexCaptureOnce> } catch { } }` is
// located by finding the `{` that follows the dedup-cache cleanup line.
// Free vars: chrome, _0x393846 (sender), _0x234d07/_0x53c06c/_0x2fc074/_0x2f65a1
// (var-hoisted in the outer handler), and _0x4f463b (outer IIFE result var).
const BG_SHOT_BLOCK = extractBlockAfterMarker(BG_SRC, "_semexShotCache.delete(_k0); }");
if (!BG_SHOT_BLOCK.includes("SEMEX_SUCCESS_UI_PROBE"))
  throw new Error("Shot block missing probe: " + BG_SHOT_BLOCK.slice(0, 80));
if (!BG_SHOT_BLOCK.includes("captureVisibleTab"))
  throw new Error("Shot block missing captureVisibleTab — extraction boundary wrong");
if (!BG_SHOT_BLOCK.includes("_semexCaptureOnce"))
  throw new Error("Shot block missing _semexCaptureOnce function");

// ─── Test harness ─────────────────────────────────────────────────────────────

let passed = 0, failed = 0;

function assert(cond, name) {
  if (cond) { console.log("  \u2713  " + name); passed++; }
  else       { console.error("  \u2717  " + name); failed++; }
}
function assertEquals(actual, expected, name) {
  if (actual === expected) {
    console.log("  \u2713  " + name); passed++;
  } else {
    console.error("  \u2717  " + name + "  (expected " + JSON.stringify(expected) + ", got " + JSON.stringify(actual) + ")");
    failed++;
  }
}

// ─── Helper: run the real detector in an isolated vm context ─────────────────

function runDetector({ pathname = "/", querySelector = () => null,
                       overlayText = null, bodyText = "" }) {
  const ctx = vm.createContext({
    window:   { location: { pathname } },
    document: {
      querySelector,
      getElementById: (id) =>
        id === "semex-overlay" && overlayText !== null ? { textContent: overlayText } : null,
      body: { textContent: bodyText },
    },
    __result__: null,
  });
  new vm.Script(DETECTOR_SRC + "\n__result__ = _semexDetectSuccessUi();").runInContext(ctx);
  return ctx.__result__;
}

// ─── Helper: register the real listener in vm, dispatch one probe message ─────

/**
 * Builds a vm context that includes the REAL content.js addListener call with
 * all its handlers (FILL_FORM, CARD_DATA_CAPTURED, SEMEX_SUCCESS_UI_PROBE).
 * Stubs that are required by the other handlers are provided so the vm does not
 * throw; only SEMEX_SUCCESS_UI_PROBE behaviour is asserted.
 *
 * Returns { sendProbe(isTopFrame, document) → Promise<{ready}|null> }
 */
function buildContentVmWithListener(liveDocument) {
  const WIN = {};

  // vm context: provide all symbols the extracted listener body references
  const ctx = vm.createContext({
    window: WIN,
    document: liveDocument,
    chrome: {
      runtime:  { onMessage: { addListener: (cb) => { ctx.__registeredHandler__ = cb; } } },
      storage:  { session: { set: () => Promise.resolve() } },
    },
    fillForm:        async () => {},   // stub for FILL_FORM handler
    lastFilledCard:  null,             // stub for CARD_DATA_CAPTURED handler
    __name:          (fn) => fn,       // obfuscation helper present in minified source
    __registeredHandler__: null,
  });

  // Build the script: stubs + real detector (function-hoisted) + real listener call
  // `let lastFilledCard` is also referenced as an lvalue inside the listener body,
  // so declare it at script level as well to avoid ReferenceError.
  const script = new vm.Script(
    "let lastFilledCard = null;\n" +
    "function fillForm() { return Promise.resolve(); }\n" +
    DETECTOR_SRC + "\n" +
    LISTENER_SRC
  );
  script.runInContext(ctx);

  if (!ctx.__registeredHandler__)
    throw new Error("chrome.runtime.onMessage.addListener was not called by the extracted code");

  /**
   * Simulate dispatching SEMEX_SUCCESS_UI_PROBE through the REAL registered
   * handler, with window.top configured per `isTopFrame`.
   *
   * Returns the value passed to sendResponse, or null if the handler returned
   * without calling it (sub-frame guard path).
   */
  function sendProbe(isTopFrame) {
    return new Promise((resolve) => {
      // Configure window.top before each probe (mirrors real Chrome behaviour)
      WIN.top = isTopFrame ? WIN : {};
      const msg    = { type: "SEMEX_SUCCESS_UI_PROBE" };
      const sender = {};
      let responded = false;
      ctx.__registeredHandler__(msg, sender, (resp) => {
        responded = true;
        resolve(resp);
      });
      // If handler returned synchronously without calling sendResponse (sub-frame guard)
      if (!responded) resolve(null);
    });
  }

  return { sendProbe, ctx };
}

// ─── Helper: run background probe loop with settle-gap tracking ───────────────

/**
 * Execute the real background.js probe loop block as an async function.
 * Tracks when sendMessage first returns {ready:true} so the settle gap
 * (readyReceivedAt → probe loop returns) can be asserted independently of
 * polling time.
 */
async function runRealProbeLoop({ tabId, readyAfterMs, probeThrows }) {
  const t0 = Date.now();
  let readyReceivedAt = null;

  const chromeMock = {
    tabs: {
      sendMessage: async (_tId, _msg) => {
        if (probeThrows) throw new Error("Could not establish connection");
        const elapsed = Date.now() - t0;
        const isReady = readyAfterMs != null && elapsed >= readyAfterMs;
        if (isReady && readyReceivedAt === null) readyReceivedAt = Date.now();
        return { ready: isReady };
      },
    },
  };

  // eslint-disable-next-line no-eval
  const bgFn = (0, eval)("(async (_tabIdForShotEarly, chrome) => " + BG_PROBE_BLOCK + ")");
  await bgFn(tabId, chromeMock);

  const returnedAt = Date.now();
  const elapsed    = returnedAt - t0;

  // Classify by whether ready:true was ever observed — NOT by elapsed time.
  // With readyAfterMs near the 3s cap, settle (350ms) pushes total elapsed over
  // the cap, so a timing threshold misclassifies late-but-valid early exits.
  let probePath;
  if (readyReceivedAt !== null)          probePath = "early";    // got ready signal + settled
  else if (tabId == null || probeThrows) probePath = "fallback"; // no probe was possible
  else                                   probePath = "timeout";  // probed, cap reached

  return {
    elapsed,
    path: probePath,
    settleGapMs: readyReceivedAt ? returnedAt - readyReceivedAt : null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART A — _semexDetectSuccessUi() heuristics (real source)
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\n=== A. _semexDetectSuccessUi() — real code from content.js ===\n");

console.log("Group A1: success URL pathnames trigger ready");
for (const [p, lbl] of [
  ["/success",           "success"],  ["/payment/succeed",    "succeed"],
  ["/checkout/complete", "complete"], ["/thank-you",           "thank"],
  ["/receipt/123",       "receipt"],  ["/order/confirm",       "confirm"],
]) {
  assert(runDetector({ pathname: p }), "pathname \"" + p + "\" (" + lbl + ") \u2192 ready");
}
assert(!runDetector({ pathname: "/cart" }), "pathname \"/cart\" \u2192 not ready");
assert(!runDetector({ pathname: "/"    }), "pathname \"/\" (root) \u2192 not ready");

console.log("\nGroup A2: Stripe success-UI DOM selectors trigger ready");
for (const cls of ["ResultIcon--success", "Checkmark", "checkmark", "success-icon", "SuccessIcon"]) {
  assert(
    runDetector({ pathname: "/pay", querySelector: (sel) => sel.includes(cls) ? {} : null }),
    "class \"" + cls + "\" in DOM \u2192 ready"
  );
}
assert(!runDetector({ pathname: "/pay", querySelector: () => null }), "no matching selector \u2192 not ready");

console.log("\nGroup A3: SEMEX overlay text triggers ready");
for (const [txt, lbl] of [
  ["Card charged successfully", "charged"],
  ["Payment success!",          "success"],
  ["LIVE — card validated",     "live"],
  ["CHARGED – 4242",            "CHARGED (upper)"],
]) {
  assert(runDetector({ overlayText: txt }), "overlay \"" + lbl + "\" \u2192 ready");
}
assert(!runDetector({ overlayText: "Processing…" }), "overlay \"Processing\" \u2192 not ready");
assert(!runDetector({ overlayText: null }),           "no overlay element \u2192 not ready");

console.log("\nGroup A4: Stripe confirmation page body text triggers ready");
for (const [txt, lbl] of [
  ["Payment successful! Your order is on its way.",   "Payment successful"],
  ["Payment complete — see your email.",              "Payment complete"],
  ["Payment confirmed by Stripe.",                   "Payment confirmed"],
  ["Payment received. Thank you!",                   "Payment received"],
  ["Thank you for your purchase.",                   "Thank you for your purchase"],
  ["Thank you for your order.",                      "Thank you for your order"],
  ["Thank you for your payment.",                    "Thank you for your payment"],
  ["Order confirmed — check your inbox.",            "Order confirmed"],
  ["Payment approved by issuing bank.",              "Payment approved"],
]) {
  assert(runDetector({ bodyText: txt }), "body \"" + lbl + "\" \u2192 ready");
}
assert(!runDetector({ bodyText: "Enter your card details." }), "checkout form text \u2192 not ready");
assert(!runDetector({ bodyText: "" }),                         "empty body \u2192 not ready");

assert(
  !runDetector({ pathname: "/pay", querySelector: () => null, overlayText: null, bodyText: "Card number" }),
  "active checkout page (no success signal) \u2192 not ready"
);

// ═══════════════════════════════════════════════════════════════════════════════
// PART B — Real SEMEX_SUCCESS_UI_PROBE listener (real source, real registration)
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\n=== B. SEMEX_SUCCESS_UI_PROBE handler — real listener from content.js ===\n");

// We build one vm per scenario because document state varies.

console.log("Group B1: top-frame — ready:true when Stripe success DOM present");
{
  // Scenario: /success URL (pathname heuristic)
  const liveDoc = {
    querySelector:  () => null,
    getElementById: () => null,
    body: { textContent: "" },
  };
  const { sendProbe, ctx } = buildContentVmWithListener(liveDoc);
  ctx.window.location = { pathname: "/success" };

  sendProbe(true /* isTopFrame */).then(resp => {
    assert(resp !== null,       "sendResponse called (main frame, /success)");
    assert(resp.ready === true, "response.ready === true (/success URL)");
  });
}
{
  // Scenario: ResultIcon--success class in DOM
  const liveDoc = {
    querySelector:  (sel) => sel.includes("ResultIcon--success") ? {} : null,
    getElementById: () => null,
    body: { textContent: "" },
  };
  const { sendProbe, ctx } = buildContentVmWithListener(liveDoc);
  ctx.window.location = { pathname: "/pay" };

  sendProbe(true).then(resp => {
    assert(resp !== null,       "sendResponse called (main frame, DOM tick)");
    assert(resp.ready === true, "response.ready === true (ResultIcon--success)");
  });
}
{
  // Scenario: confirmation page body text
  const liveDoc = {
    querySelector:  () => null,
    getElementById: () => null,
    body: { textContent: "Payment successful! Thank you for your purchase." },
  };
  const { sendProbe, ctx } = buildContentVmWithListener(liveDoc);
  ctx.window.location = { pathname: "/pay" };

  sendProbe(true).then(resp => {
    assert(resp !== null,       "sendResponse called (body text)");
    assert(resp.ready === true, "response.ready === true (body text heuristic)");
  });
}

console.log("\nGroup B2: top-frame — ready:false when no success signal");
{
  const liveDoc = {
    querySelector:  () => null,
    getElementById: () => null,
    body: { textContent: "Enter your card details." },
  };
  const { sendProbe, ctx } = buildContentVmWithListener(liveDoc);
  ctx.window.location = { pathname: "/pay" };

  sendProbe(true).then(resp => {
    assert(resp !== null,        "sendResponse called (no success signal)");
    assert(resp.ready === false, "response.ready === false (active checkout)");
  });
}

console.log("\nGroup B3: sub-frame guard — sendResponse NOT called from non-top frame");
{
  const liveDoc = {
    querySelector:  () => null,
    getElementById: () => null,
    body: { textContent: "" },
  };
  const { sendProbe, ctx } = buildContentVmWithListener(liveDoc);
  ctx.window.location = { pathname: "/success" }; // would be ready:true — but guard blocks it

  sendProbe(false /* isTopFrame=false */).then(resp => {
    assert(resp === null, "sub-frame guard: sendResponse NOT called");
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART C — Background probe loop timing (real source, settle-gap assertion)
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\n=== C. Background probe loop timing — real code from background.js ===\n");

(async () => {

  // C1 — Early exit: settleGapMs must be >= 330ms (350ms settle minus 20ms jitter)
  console.log("Group C1: green tick detected quickly — early exit + 350ms settle");
  {
    const r = await runRealProbeLoop({ tabId: 1, readyAfterMs: 300, probeThrows: false });
    assertEquals(r.path, "early", "probe path = early");
    assert(r.elapsed < 2500, "elapsed " + r.elapsed + "ms < 2500ms (not 3s cap)");
    assert(r.settleGapMs != null, "settleGapMs recorded");
    assert(r.settleGapMs >= 330,
      "settle gap " + r.settleGapMs + "ms \u2265 330ms (350ms settle constant, \u00b120ms jitter)");
    console.log("    (elapsed: " + r.elapsed + "ms, settleGap: " + r.settleGapMs + "ms)");
  }

  // C2 — 3s cap: no settle gap (probe timed out, not ready)
  console.log("\nGroup C2: success UI never appears — 3s cap");
  {
    const r = await runRealProbeLoop({ tabId: 1, readyAfterMs: null, probeThrows: false });
    assertEquals(r.path, "timeout", "probe path = timeout");
    assert(r.elapsed >= 2900, "elapsed " + r.elapsed + "ms \u2265 2900ms (hit cap)");
    assert(r.settleGapMs === null, "no settle gap (ready:true never received)");
    console.log("    (elapsed: " + r.elapsed + "ms)");
  }

  // C3 — 800ms fallback: sendMessage throws (no content script)
  console.log("\nGroup C3: content script unreachable — 800ms fallback");
  {
    const r = await runRealProbeLoop({ tabId: 1, readyAfterMs: null, probeThrows: true });
    assertEquals(r.path, "fallback", "probe path = fallback (sendMessage threw)");
    assert(r.elapsed >= 700, "elapsed " + r.elapsed + "ms \u2265 700ms");
    assert(r.elapsed < 2500, "elapsed " + r.elapsed + "ms < 2500ms (not 3s cap)");
    console.log("    (elapsed: " + r.elapsed + "ms)");
  }

  // C4 — 800ms fallback: no tab ID
  console.log("\nGroup C4: no tab ID — immediate break + 800ms fallback");
  {
    const r = await runRealProbeLoop({ tabId: null, readyAfterMs: null, probeThrows: false });
    assertEquals(r.path, "fallback", "probe path = fallback (no tabId)");
    assert(r.elapsed >= 700, "elapsed " + r.elapsed + "ms \u2265 700ms");
    assert(r.elapsed < 2500, "elapsed " + r.elapsed + "ms < 2500ms");
    console.log("    (elapsed: " + r.elapsed + "ms)");
  }

  // C5 — Late ready (just before 3s) — still early, settle gap still >= 330ms
  console.log("\nGroup C5: ready:true at 2500ms — still early exit with settle");
  {
    const r = await runRealProbeLoop({ tabId: 1, readyAfterMs: 2500, probeThrows: false });
    assertEquals(r.path, "early", "probe path = early (late but before cap)");
    assert(r.settleGapMs != null && r.settleGapMs >= 330,
      "settle gap " + r.settleGapMs + "ms \u2265 330ms");
    console.log("    (elapsed: " + r.elapsed + "ms, settleGap: " + r.settleGapMs + "ms)");
  }

  // ─── Part D: full end-to-end pipeline ─────────────────────────────────────

  console.log("\n=== D. Full end-to-end pipeline — real listener \u2194 real probe loop ===\n");

  /**
   * Run the complete probe+capture pipeline using the real production code
   * segment extracted from background.js (BG_SHOT_BLOCK: probe wait loop +
   * _semexCaptureOnce + chrome.tabs.captureVisibleTab).
   *
   *  1. Build a live mutable DOM starting as a blank checkout page.
   *  2. Register the REAL content.js onMessage listener in a vm context that
   *     reads from the live DOM.
   *  3. Run the REAL background.js probe+capture block; its sendMessage calls
   *     the real registered listener each poll.  Its captureVisibleTab call
   *     hits the timestamped mock — the timestamp is set inside production code,
   *     not by the test harness after the function returns.
   *  4. After tickAfterMs ms the DOM flips to show ResultIcon--success (the
   *     Stripe green tick).
   *
   * Returns:
   *   { tickAppearedAt, readyReceivedAt, captureCalledAt, settleGapMs }
   *   all in ms from pipelineT0 (the start of the probe+capture block).
   */
  async function runFullPipeline({ tickAfterMs }) {
    // Mutable live DOM — mutated from outside via closure
    const dom = {
      pathname:    "/pay",
      hasTickClass: false,
      bodyText:    "",
    };

    // Live document that always reads current dom state
    const liveDoc = {
      querySelector:  (sel) => dom.hasTickClass && sel.includes("ResultIcon--success") ? {} : null,
      getElementById: () => null,
      body: { get textContent() { return dom.bodyText; } },
    };

    // Set up real content.js listener in vm, reading from liveDoc
    const { sendProbe, ctx } = buildContentVmWithListener(liveDoc);
    // Start on the checkout page; location.pathname will be updated when tick appears
    ctx.window.location = { pathname: dom.pathname };

    // Schedule DOM flip to Stripe success state
    const pipelineT0     = Date.now();
    let tickAppearedAt   = null;
    let readyReceivedAt  = null;
    let captureCalledAt  = null;  // set INSIDE production captureVisibleTab mock

    const tickTimer = setTimeout(() => {
      dom.pathname      = "/success";
      dom.hasTickClass  = true;
      ctx.window.location = { pathname: "/success" }; // visible to vm
      tickAppearedAt    = Date.now() - pipelineT0;
    }, tickAfterMs);

    // ── Chrome mock provided to the real extracted production code ───────────
    //
    // sendMessage        → real content.js listener (SEMEX_SUCCESS_UI_PROBE handler)
    // captureVisibleTab  → timestamped mock; timestamp is set when the REAL extracted
    //                      code calls it (not by the test harness after the fact)
    // tabs.update        → no-op stub for _semexFocusShotTab tab-focus call
    // storage.local.get  → returns {} (no saved settings; local save gated on downloads)
    // downloads          → undefined so the local-save branch is skipped
    // runtime.lastError  → accessed via `void chrome.runtime.lastError` in the update cb
    const chromeMock = {
      tabs: {
        sendMessage: (_tId, _msg) =>
          sendProbe(/* isTopFrame */ true).then(resp => {
            if (resp && resp.ready && readyReceivedAt === null)
              readyReceivedAt = Date.now() - pipelineT0;
            return resp || { ready: false };
          }),
        // Production _semexCaptureOnce calls this after the probe settle.
        // The timestamp recorded here proves captureVisibleTab was invoked by
        // the real extracted code path, not injected by the test after the fact.
        captureVisibleTab: async (_winId, _opts) => {
          captureCalledAt = Date.now() - pipelineT0;
          // Return a data URL longer than 100 chars so the acceptance check
          // `_0xf70d33.length > 100` passes and the retry loop exits.
          return "data:image/png;base64," + "A".repeat(200);
        },
        // _semexFocusShotTab calls chrome.tabs.update — stub to no-op
        update: (_tabId, _props, cb) => { if (cb) cb(); return Promise.resolve(); },
      },
      windows: {
        // _semexFocusShotTab also calls chrome.windows.update but only when
        // windowId != null.  Our sender has windowId: null so this is never
        // reached, but stub it anyway for completeness.
        update: (_winId, _props, cb) => { if (cb) cb(); return Promise.resolve(); },
      },
      storage: { local: { get: async () => ({}) } },
      downloads: undefined, // skip local save
      runtime: { lastError: undefined }, // accessed via `void chrome.runtime.lastError` in tabs.update cb
    };

    // Sender object: background.js reads _0x393846.tab.id for probe + capture tab IDs.
    // windowId: null ensures chrome.windows.update is never called.
    const sender = { tab: { id: 1, windowId: null } };

    // Build and run the REAL production code block extracted from background.js.
    // The block includes:
    //   • chrome.storage.local.get (settings load)
    //   • the SEMEX_SUCCESS_UI_PROBE poll loop with 350ms settle
    //   • _semexFocusShotTab (tab focus before capture)
    //   • _semexCaptureOnce → chrome.tabs.captureVisibleTab  ← real call
    //
    // Wrapper declares the var-hoisted outer-scope variables (_0x234d07 etc.) and
    // the IIFE result variable (_0x4f463b) so all assignments inside the block work.
    // eslint-disable-next-line no-eval
    const bgShotFn = (0, eval)(
      "(async function bgShotRoutine(_0x393846, chrome) {" +
      "  var _0x234d07, _0x53c06c, _0x2fc074, _0x2f65a1;" +
      "  let _0x4f463b = null;" +
      "  " + BG_SHOT_BLOCK +
      "  return _0x4f463b;" +
      "})"
    );
    await bgShotFn(sender, chromeMock);

    clearTimeout(tickTimer);

    const settleGapMs = readyReceivedAt != null ? captureCalledAt - readyReceivedAt : null;

    return { tickAppearedAt, readyReceivedAt, captureCalledAt, settleGapMs };
  }

  // D1 — Tick at 500ms: capture must fire AFTER tick + at least 330ms settle
  console.log("Group D1: tick at 500ms — capture fires after tick with 350ms settle");
  {
    const r = await runFullPipeline({ tickAfterMs: 500 });
    console.log("    tick=" + r.tickAppearedAt + "ms, ready=" + r.readyReceivedAt +
                "ms, capture=" + r.captureCalledAt + "ms, settle=" + r.settleGapMs + "ms");

    assert(r.tickAppearedAt !== null, "green tick DOM flip occurred");
    assert(r.readyReceivedAt !== null, "ready:true received from real listener");
    assert(r.captureCalledAt !== null, "captureVisibleTab was called");

    assert(
      r.captureCalledAt > r.tickAppearedAt,
      "capture (" + r.captureCalledAt + "ms) fired AFTER tick appeared (" + r.tickAppearedAt + "ms)"
    );
    assert(
      r.settleGapMs >= 330,
      "settle gap " + r.settleGapMs + "ms \u2265 330ms (350ms settle constant)"
    );
    assert(r.captureCalledAt < 2500, "total " + r.captureCalledAt + "ms < 2500ms (fast path)");
  }

  // D2 — Tick at 1200ms: probe loops several times before tick, then settles
  console.log("\nGroup D2: tick at 1200ms — probe loops, waits, then captures");
  {
    const r = await runFullPipeline({ tickAfterMs: 1200 });
    console.log("    tick=" + r.tickAppearedAt + "ms, ready=" + r.readyReceivedAt +
                "ms, capture=" + r.captureCalledAt + "ms, settle=" + r.settleGapMs + "ms");

    assert(r.captureCalledAt > r.tickAppearedAt,
      "capture fired after tick (" + r.captureCalledAt + "ms > " + r.tickAppearedAt + "ms)");
    assert(r.settleGapMs >= 330, "settle gap " + r.settleGapMs + "ms \u2265 330ms");
    assert(r.captureCalledAt < 2800, "resolved before 3s cap (" + r.captureCalledAt + "ms)");
  }

  // D3 — Tick never appears: probe hits 3s cap, captureVisibleTab still called
  console.log("\nGroup D3: tick never appears — 3s cap, fallback capture still fires");
  {
    const r = await runFullPipeline({ tickAfterMs: 99999 });
    console.log("    tick=never, capture=" + r.captureCalledAt + "ms");

    assert(r.tickAppearedAt === null, "tick never appeared (correct)");
    assert(r.captureCalledAt !== null, "captureVisibleTab still called after 3s cap");
    assert(r.captureCalledAt >= 2900, "waited to 3s cap (" + r.captureCalledAt + "ms)");
    assert(r.settleGapMs === null, "no settle gap (ready:true never received)");
  }

  // ─── Summary ──────────────────────────────────────────────────────────────
  console.log("\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
  console.log("  Results: " + passed + " passed, " + failed + " failed");
  console.log("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n");

  if (failed > 0) process.exit(1);
})();
