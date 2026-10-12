/**
 * 3ds-relay-error-recovery.test.js
 *
 * Regression guard for the 3DS bypass REPLACE_URL_ONLY fetch-path fix.
 *
 * Tests load the ACTUAL production source files in a vm so that reverting or
 * changing the fix in interceptor.js or content.js causes the tests to fail.
 *
 * Background: the fetch path was leaving window.__CHECK_3DS_FAILURE = true
 * after the proxied fetch resolved.  The fix (interceptor.js ~line 1058) clears
 * the flag immediately after the relay fetch and posts PAYMENT_STATUS_DETECTED
 * with declineCode "3ds_bypass_failed" when the relay returns 4xx/5xx.
 *
 * Architecture note:
 *   fetchBypassInstructions (_0x3ccea3) may fall through to a content-script
 *   message-round-trip when it cannot resolve the bypass action locally.  The
 *   test harness implements a minimal message bus (window.addEventListener +
 *   window.postMessage) that intercepts SEMEX_FETCH_INSTRUCTIONS and
 *   immediately responds with SEMEX_INSTRUCTIONS_RECEIVED carrying
 *   REPLACE_URL_ONLY instructions, matching what the real content script does.
 *   window.setTimeout is a true no-op so the 2-second fallback timer never
 *   fires and clobbers the message-bus response.
 *
 * Test suites:
 *   A. Relay 4xx (JSON body)  — flag cleared, 3ds_bypass_failed posted
 *   B. Relay 5xx (plain body) — same guarantees
 *   C. Relay 4xx (non-JSON)   — catch-branch still posts bypass_failed
 *   D. Relay 2xx              — flag cleared, no bypass_failed
 *   E. Stale-flag false-positive (line ~1258 path) — exercised via production code
 *   F. Card requeue fires (production content.js code)
 *   G. Requeue dedup — same card fires only once within 500 ms
 *   H. Non-bypass declineCode — no requeue
 *   I. Non-main frame — no requeue
 *
 * Run:  node semex/tests/3ds-relay-error-recovery.test.js
 *
 * Exit codes:
 *   0  all assertions passed
 *   1  one or more assertions failed
 */

"use strict";

const fs   = require("fs");
const path = require("path");
const vm   = require("vm");

// ─── Load production sources ──────────────────────────────────────────────────

const INTERCEPTOR_PATH = path.join(__dirname, "../main-world/interceptor.js");
const CONTENT_PATH     = path.join(__dirname, "../content/content.js");

for (const p of [INTERCEPTOR_PATH, CONTENT_PATH]) {
  if (!fs.existsSync(p)) throw new Error("Required source file not found: " + p);
}

const INTERCEPTOR_SRC = fs.readFileSync(INTERCEPTOR_PATH, "utf8");
const CONTENT_SRC     = fs.readFileSync(CONTENT_PATH,     "utf8");

// ─── Source integrity guards ──────────────────────────────────────────────────
// These assertions fail fast if the key fix or requeue code is removed from
// the production sources, making the test suite self-documenting.

const INTEGRITY = [
  // The fix: flag cleared immediately after the relay fetch (fetch-path)
  [INTERCEPTOR_SRC, "window.__CHECK_3DS_FAILURE = false;",
   "interceptor.js is missing the __CHECK_3DS_FAILURE=false fix — line ~1058 may have been removed"],
  // The action label that triggers the relay-URL path
  [INTERCEPTOR_SRC, '"REPLACE_URL_ONLY"',
   "interceptor.js is missing the REPLACE_URL_ONLY action"],
  // The fallback server-call path (message-bus protocol used by our harness)
  [INTERCEPTOR_SRC, '"SEMEX_FETCH_INSTRUCTIONS"',
   "interceptor.js is missing the SEMEX_FETCH_INSTRUCTIONS message — harness protocol changed"],
  // The secondary XHR-path flag check at line ~1258
  [INTERCEPTOR_SRC, "if (window.__CHECK_3DS_FAILURE)",
   "interceptor.js is missing the __CHECK_3DS_FAILURE XHR-path check"],
  // The requeue postMessage in content.js
  [CONTENT_SRC, '"SEMEX_REQUEUE_3DS_FAILED_CARD"',
   "content.js is missing SEMEX_REQUEUE_3DS_FAILED_CARD — requeue code removed?"],
  // The dedup gate in the requeue block
  [CONTENT_SRC, "> 500",
   "content.js requeue dedup gate (> 500) not found — source may be refactored"],
];
for (const [src, needle, msg] of INTEGRITY) {
  if (!src.includes(needle)) throw new Error("SOURCE INTEGRITY FAIL: " + msg);
}

// ─── Extract the requeue block from production content.js ────────────────────
//
// Rather than running all of content.js (which requires the full Chrome
// extension environment), we extract only the requeue if-block using unique
// source anchors.  This means any refactor of the requeue code in content.js
// that moves or renames these anchors breaks the extraction — intentionally.

const REQUEUE_OPEN  = 'if (_0x53ff8e === "3ds_bypass_failed" && _0x9b2f3b && _0x9b2f3b.number && IS_MAIN_FRAME) {';
const REQUEUE_CLOSE = "if (typeof chrome === \"undefined\" || !chrome.runtime || !chrome.runtime.sendMessage)";

const rqStart = CONTENT_SRC.indexOf(REQUEUE_OPEN);
const rqEnd   = CONTENT_SRC.indexOf(REQUEUE_CLOSE, rqStart);

if (rqStart === -1) throw new Error("Requeue opening anchor not found in content.js");
if (rqEnd   === -1) throw new Error("Requeue closing anchor (chrome runtime check) not found after requeue block");
if (rqEnd <= rqStart) throw new Error("Requeue anchors are in unexpected order");

const REQUEUE_BLOCK_SRC = CONTENT_SRC.slice(rqStart, rqEnd).trimEnd();

// ─── Test harness ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(cond, name) {
  if (cond) {
    console.log("  \u2713  " + name);
    passed++;
  } else {
    console.error("  \u2717  " + name);
    failed++;
  }
}

function assertEquals(actual, expected, name) {
  if (actual === expected) {
    console.log("  \u2713  " + name);
    passed++;
  } else {
    console.error(
      "  \u2717  " + name +
      "  (expected " + JSON.stringify(expected) + ", got " + JSON.stringify(actual) + ")"
    );
    failed++;
  }
}

// ─── Mock Response helper ─────────────────────────────────────────────────────

/**
 * Returns a minimal fetch-Response-like object.
 * .clone() always returns a fresh clone with working .json() and .text().
 *
 * @param {number}      status   HTTP status
 * @param {object|null} jsonBody Object to resolve from .json(), or null to reject
 * @param {string}      [url]    Optional response URL
 */
function makeMockResponse(status, jsonBody, url) {
  function makeClone() {
    return {
      url:    url || "",
      status: status,
      ok:     status < 400,
      json:   () => (jsonBody !== null && jsonBody !== undefined)
                      ? Promise.resolve(jsonBody)
                      : Promise.reject(new SyntaxError("not JSON")),
      text:   () => Promise.resolve(
                      (jsonBody !== null && jsonBody !== undefined)
                        ? JSON.stringify(jsonBody)
                        : ""
                    ),
      clone: makeClone,
    };
  }
  return makeClone();
}

// ─── vm context builder ───────────────────────────────────────────────────────
//
// Builds a window object and vm context for running the interceptor.js IIFE.
//
// Message bus:
//   window.addEventListener / removeEventListener store 'message' handlers.
//   window.postMessage spies on all messages AND responds to
//   SEMEX_FETCH_INSTRUCTIONS with SEMEX_INSTRUCTIONS_RECEIVED carrying
//   REPLACE_URL_ONLY instructions — simulating what the real content script
//   does when the interceptor needs bypass instructions from the background.
//
//   window.setTimeout is a TRUE NO-OP (returns 0, never calls the callback).
//   This prevents the 2-second fallback timer inside fetchBypassInstructions
//   from resolving the promise with {action:"NONE"} before the message bus
//   can respond — which would silently suppress the REPLACE_URL_ONLY path.

function buildVmCtx(relayFetchImpl, extraWinProps) {
  const messages      = [];
  const msgListeners  = [];

  // Minimal XHR stub — must be a constructable class; the IIFE extends it.
  class MinimalXHR {
    open(m, u) { this._method = m; this._url = u; }
    send()                {}
    setRequestHeader()    {}
    addEventListener()    {}
    removeEventListener() {}
    abort()               {}
    get readyState()  { return 0; }
    get status()      { return 0; }
    get responseText(){ return ""; }
  }

  // Browser stubs required by the fetch handler's `instanceof` checks.
  class StubRequest {
    constructor(u, i) {
      this.url    = String(u || "");
      this.method = (i && i.method) || "GET";
      this.headers = new StubHeaders();
    }
    clone() { return new StubRequest(this.url, { method: this.method }); }
    text()  { return Promise.resolve(""); }
  }
  class StubHeaders {
    forEach() {}
    get()    { return null; }
    has()    { return false; }
  }
  class StubFormData {
    append() {}
    set()    {}
    get()    { return null; }
    forEach(){}
  }

  const win = Object.assign({
    // Frame identity
    top: null, self: null,
    location: {
      hostname: "checkout.stripe.com",
      href:     "https://checkout.stripe.com/c/pay/cs_live_test",
      pathname: "/c/pay/cs_live_test",
    },

    // The fetch that the IIFE captures as _0x416754 (the "real" fetch).
    // All relay calls flow through this.
    fetch: relayFetchImpl,

    XMLHttpRequest: MinimalXHR,
    Stripe: undefined, TextEncoder: undefined, TextDecoder: undefined, crypto: undefined,

    sessionStorage: { getItem: () => null, setItem: () => {} },
    SEMEX_SETTINGS: {
      threeDSBypass:          { enabled: true },
      cvvBypass:              { enabled: true,  gateways: { stripe: true } },
      paymentUserAgentBypass: { enabled: true },
      cardReplacement:        { enabled: false, gateways: { stripe: false } },
    },
    SEMEX_SESSION_RULES: {
      xhrBypass: {
        stripe:    { enabled: true, action: "REMOVE_FROM_URLENCODED", targets: [], pauTargets: [] },
        stripe3ds: { enabled: true, targetHost: "relay.example.com" },
        adyen: null, checkout: null, recurly: null,
      },
    },
    __CHECK_3DS_FAILURE: false,
    __LAST_CAPTURED_CARD: null,
    IS_STRIPE_CHECKOUT: false,
    parent: null,

    // ── Message bus ──────────────────────────────────────────────────────────
    // Stores 'message' listeners (the IIFE registers these for the bypass
    // instruction round-trip) and auto-responds to SEMEX_FETCH_INSTRUCTIONS
    // with a REPLACE_URL_ONLY instruction response.
    postMessage(data) {
      messages.push(data);
      if (data && data.type === "SEMEX_FETCH_INSTRUCTIONS") {
        // Respond asynchronously (microtask), as the real content script would.
        Promise.resolve().then(() => {
          const event = {
            data: {
              type:         "SEMEX_INSTRUCTIONS_RECEIVED",
              requestId:    data.requestId,
              instructions: {
                action:      "REPLACE_URL_ONLY",
                bypassTypes: ["3DS"],
                targetHost:  "relay.example.com",
              },
            },
          };
          msgListeners.slice().forEach((l) => { try { l(event); } catch (_) {} });
        });
      }
    },
    addEventListener(evt, handler) {
      if (evt === "message") msgListeners.push(handler);
    },
    removeEventListener(evt, handler) {
      const i = msgListeners.indexOf(handler);
      if (i >= 0) msgListeners.splice(i, 1);
    },

    // TRUE NO-OP — prevents the 2-second fallback timer inside
    // fetchBypassInstructions from firing and resolving the promise with
    // {action:"NONE"} before the message bus response arrives.
    setTimeout:   () => 0,
    clearTimeout: () => {},
    setInterval:  () => 0,
    clearInterval:() => {},

    URL: global.URL || require("url").URL,
    document: { querySelector: () => null, querySelectorAll: () => [] },
  }, extraWinProps || {});

  win.top    = win;
  win.self   = win;
  win.window = win;

  const ctx = vm.createContext({
    // Standard JS globals
    Object, Array, String, Number, Boolean, Math, JSON, Promise, Date, Set, Map,
    Error, TypeError, SyntaxError, RangeError, ReferenceError,
    parseInt, parseFloat, isNaN, isFinite,
    encodeURIComponent, decodeURIComponent,
    atob: global.atob || ((s) => Buffer.from(s, "base64").toString("utf8")),
    btoa: global.btoa || ((s) => Buffer.from(s, "utf8").toString("base64")),
    // Browser stubs
    Request:  StubRequest,
    Headers:  StubHeaders,
    FormData: StubFormData,
    // Mock window
    window: win,
    // Top-level aliases used by some IIFE code
    fetch:          win.fetch,
    XMLHttpRequest: win.XMLHttpRequest,
    setTimeout:     win.setTimeout,
    clearTimeout:   win.clearTimeout,
    setInterval:    win.setInterval,
    clearInterval:  win.clearInterval,
    URL:            win.URL,
    console,
  });

  return { win, messages, ctx };
}

// ─── Interceptor vm runner ────────────────────────────────────────────────────

/**
 * Runs the full interceptor.js IIFE in a fresh vm, then calls the patched
 * window.fetch with a Stripe 3DS authenticate URL.  Returns the spy messages
 * and the window state after all microtasks settle.
 *
 * @param {Function}  relayFetchImpl  Async function used as the relay fetch.
 * @param {object}    [extraWinProps] Extra properties merged into window before
 *                                    the patched fetch is called (e.g. to
 *                                    pre-set __CHECK_3DS_FAILURE).
 * @param {string}    [testUrl]       URL to call; defaults to 3DS authenticate.
 */
async function runInterceptorFetch(relayFetchImpl, extraWinProps, testUrl) {
  const { win, messages, ctx } = buildVmCtx(relayFetchImpl, null);

  // Run the production IIFE — patches window.fetch with the full bypass logic
  vm.runInContext(INTERCEPTOR_SRC, ctx, { filename: "interceptor.js" });

  // Apply any extra window mutations AFTER the IIFE but BEFORE the call.
  if (extraWinProps) Object.assign(win, extraWinProps);

  const url  = testUrl || "https://api.stripe.com/v1/3ds2/authenticate";
  const init = { method: "POST", body: "payment_method=pm_card_test" };

  try {
    await win.fetch(url, init);
  } catch (_) { /* network-error paths are not tested here */ }

  // Drain the microtask queue so that all unawaited .then/.catch callbacks
  // inside the IIFE (e.g. on clone.json()) run before we inspect messages.
  // setImmediate runs after all pending microtasks are drained.
  await new Promise((r) => setImmediate(r));

  return { win, messages };
}

// ─── Requeue block vm helper ──────────────────────────────────────────────────

/**
 * Runs the extracted production requeue block from content.js in a vm.
 * The block uses the obfuscated variable names from the original source,
 * which we pass in as vm context bindings.
 */
function runProductionRequeueBlock({ declineCode, card, isMainFrame, win }) {
  const ctx = vm.createContext({
    Object, Date,
    window:        win,
    _0x53ff8e:     declineCode,   // production variable name for declineCode
    _0x9b2f3b:     card,          // production variable name for card
    IS_MAIN_FRAME: isMainFrame,
    // document is accessed in a try/catch inside the block (button reset);
    // a stub prevents any ReferenceError there.
    document: { querySelectorAll: () => [] },
  });
  try {
    vm.runInContext(REQUEUE_BLOCK_SRC, ctx, { filename: "content.js#requeue" });
  } catch (_) {
    // Code after the postMessage (DOM button manipulation) may fail on missing
    // host APIs; that is expected.  The postMessage fires before those lines.
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

(async function main() {
  console.log("\n=== 3DS bypass relay error recovery (production code) ===\n");

  // ── A: relay 4xx with JSON error body ────────────────────────────────────────
  console.log("Group A: relay 4xx (JSON body) — flag cleared, 3ds_bypass_failed posted");

  {
    const relayMock = async (url) =>
      makeMockResponse(402,
        { error: { message: "Card declined by relay", code: "card_declined" } },
        url);

    const { win, messages } = await runInterceptorFetch(relayMock);

    assertEquals(win.__CHECK_3DS_FAILURE, false,
      "A1: __CHECK_3DS_FAILURE cleared to false after relay 4xx " +
      "(production fix, interceptor.js ~line 1058)");

    const detected = messages.filter(
      (m) => m.type === "PAYMENT_STATUS_DETECTED" && m.declineCode === "3ds_bypass_failed");
    assertEquals(detected.length, 1,
      "A2: exactly one PAYMENT_STATUS_DETECTED with declineCode 3ds_bypass_failed");
    assertEquals((detected[0] || {}).status, "DEAD",
      "A3: status is DEAD");
    assertEquals((detected[0] || {}).gateway, "STRIPE",
      "A4: gateway is STRIPE");
  }

  // ── B: relay 5xx with plain message body ─────────────────────────────────────
  console.log("\nGroup B: relay 5xx (plain message) — flag cleared, bypass_failed posted");

  {
    const relayMock = async (url) =>
      makeMockResponse(503, { message: "Relay temporarily unavailable" }, url);

    const { win, messages } = await runInterceptorFetch(relayMock);

    assertEquals(win.__CHECK_3DS_FAILURE, false,
      "B1: flag cleared after 5xx");
    const detected = messages.filter(
      (m) => m.type === "PAYMENT_STATUS_DETECTED" && m.declineCode === "3ds_bypass_failed");
    assertEquals(detected.length, 1,
      "B2: 3ds_bypass_failed posted on relay 5xx");
  }

  // ── C: relay 4xx with non-JSON body ───────────────────────────────────────────
  console.log("\nGroup C: relay 4xx (non-JSON) — catch branch still posts bypass_failed");

  {
    // jsonBody = null → .json() rejects, exercising the .catch() branch
    const relayMock = async (url) => makeMockResponse(400, null, url);

    const { win, messages } = await runInterceptorFetch(relayMock);

    assertEquals(win.__CHECK_3DS_FAILURE, false,
      "C1: flag cleared after non-JSON 4xx");
    const detected = messages.filter(
      (m) => m.type === "PAYMENT_STATUS_DETECTED" && m.declineCode === "3ds_bypass_failed");
    assertEquals(detected.length, 1,
      "C2: 3ds_bypass_failed posted even when relay body is not JSON (via .catch branch)");
  }

  // ── D: relay 2xx — flag cleared, no bypass_failed ────────────────────────────
  console.log("\nGroup D: relay 2xx — flag cleared, no 3ds_bypass_failed");

  {
    const relayMock = async (url) =>
      makeMockResponse(200, { status: "succeeded" }, url);

    const { win, messages } = await runInterceptorFetch(relayMock);

    assertEquals(win.__CHECK_3DS_FAILURE, false,
      "D1: flag cleared after successful relay — no stale flag to contaminate next request");
    const detected = messages.filter(
      (m) => m.type === "PAYMENT_STATUS_DETECTED" && m.declineCode === "3ds_bypass_failed");
    assertEquals(detected.length, 0,
      "D2: no 3ds_bypass_failed for a 2xx relay response");
  }

  // ── E: stale-flag false-positive path (production ~line 1258 check) ──────────
  //
  // The secondary __CHECK_3DS_FAILURE check at ~line 1258 in the fetch handler
  // is designed for the XHR bypass path: when the XHR 3DS request fires, it
  // sets the flag; the NEXT Stripe fetch that passes through line 1258 picks it
  // up and posts 3ds_bypass_failed.
  //
  // The OLD bug: the fetch REPLACE_URL_ONLY path also set the flag and — before
  // the fix — left it true, causing the line-1258 check to re-fire and post a
  // SECOND (spurious) 3ds_bypass_failed for an unrelated Stripe response.
  //
  // Here we exercise the production line-1258 code by pre-setting the flag to
  // true (simulating the XHR path having set it) and then making a Stripe fetch
  // that returns 4xx.  The flag IS consumed (cleared and 3ds_bypass_failed
  // posted) exactly once.  After the fix, the REPLACE_URL_ONLY path clears the
  // flag at line 1058 BEFORE reaching line 1258, so the post there never fires.

  console.log("\nGroup E: stale-flag path (~line 1258) — consumed by production fetch handler");

  {
    // Use a non-3DS Stripe URL so only the line-1258 path fires (not REPLACE_URL_ONLY).
    // Session rules must return NONE for this URL so the fallback fetch runs.
    // pre-set flag = true simulates the XHR bypass having left it set.
    const relayMock = async (url) =>
      makeMockResponse(402, { error: { message: "generic decline" } }, url);

    const { win, messages } = await runInterceptorFetch(
      relayMock,
      { __CHECK_3DS_FAILURE: true },                              // stale flag (XHR path)
      "https://api.stripe.com/v1/payment_intents/pi_abc/confirm" // non-3DS URL
    );

    // The flag should be consumed (cleared) by the production line-1258 check.
    assertEquals(win.__CHECK_3DS_FAILURE, false,
      "E1: stale flag consumed (cleared) by production line-~1258 check on a non-3DS fetch");

    // Exactly one 3ds_bypass_failed should fire from line 1258 (the XHR-path detector).
    const detected = messages.filter(
      (m) => m.type === "PAYMENT_STATUS_DETECTED" && m.declineCode === "3ds_bypass_failed");
    assertEquals(detected.length, 1,
      "E2: line-~1258 path posts exactly one 3ds_bypass_failed for the stale-flag case");
  }

  // ── F: card requeue (production content.js code) ─────────────────────────────
  console.log("\nGroup F: card requeue — production content.js posts SEMEX_REQUEUE_3DS_FAILED_CARD");

  {
    const requeued = [];
    const win = {
      _semex3dsRequeueLastTime: null,
      postMessage(d) { requeued.push(d); },
    };
    const card = { number: "4111111111111111", exp_month: "12", exp_year: "2027", cvc: "123" };

    runProductionRequeueBlock({
      declineCode: "3ds_bypass_failed", card, isMainFrame: true, win,
    });

    const msgs = requeued.filter((m) => m.type === "SEMEX_REQUEUE_3DS_FAILED_CARD");
    assertEquals(msgs.length, 1,
      "F1: production requeue code posts SEMEX_REQUEUE_3DS_FAILED_CARD");
    assert(msgs[0] && msgs[0].card === card,
      "F2: requeue message carries the original card object");
  }

  // ── G: requeue dedup — same card within 500 ms fires only once ───────────────
  console.log("\nGroup G: requeue dedup — same card fires only once within 500 ms");

  {
    const requeued = [];
    const win = {
      _semex3dsRequeueLastTime: null,
      postMessage(d) { requeued.push(d); },
    };
    const card = { number: "5500005555555559", exp_month: "01", exp_year: "2028", cvc: "999" };

    runProductionRequeueBlock({ declineCode: "3ds_bypass_failed", card, isMainFrame: true, win });
    runProductionRequeueBlock({ declineCode: "3ds_bypass_failed", card, isMainFrame: true, win });
    runProductionRequeueBlock({ declineCode: "3ds_bypass_failed", card, isMainFrame: true, win });

    const msgs = requeued.filter((m) => m.type === "SEMEX_REQUEUE_3DS_FAILED_CARD");
    assertEquals(msgs.length, 1,
      "G1: three rapid requeue calls produce only one SEMEX_REQUEUE_3DS_FAILED_CARD (dedup gate)");
  }

  // ── H: requeue does not fire for non-bypass declineCodes ─────────────────────
  console.log("\nGroup H: requeue — non-3ds_bypass_failed declineCode → no requeue");

  {
    const requeued = [];
    const win = {
      _semex3dsRequeueLastTime: null,
      postMessage(d) { requeued.push(d); },
    };
    const card = { number: "4242424242424242", exp_month: "09", exp_year: "2029", cvc: "737" };

    runProductionRequeueBlock({
      declineCode: "insufficient_funds", card, isMainFrame: true, win,
    });

    const msgs = requeued.filter((m) => m.type === "SEMEX_REQUEUE_3DS_FAILED_CARD");
    assertEquals(msgs.length, 0,
      "H1: insufficient_funds declineCode does not trigger card requeue");
  }

  // ── I: requeue does not fire in a non-main frame ──────────────────────────────
  console.log("\nGroup I: requeue — non-main frame → no requeue");

  {
    const requeued = [];
    const win = {
      _semex3dsRequeueLastTime: null,
      postMessage(d) { requeued.push(d); },
    };
    const card = { number: "4111111111111111", exp_month: "12", exp_year: "2027", cvc: "123" };

    runProductionRequeueBlock({
      declineCode: "3ds_bypass_failed", card, isMainFrame: false, win,
    });

    const msgs = requeued.filter((m) => m.type === "SEMEX_REQUEUE_3DS_FAILED_CARD");
    assertEquals(msgs.length, 0,
      "I1: requeue does not fire in a non-main-frame context");
  }

  // ─── Summary ──────────────────────────────────────────────────────────────────

  const bar = "\u2550".repeat(39);
  console.log("\n" + bar);
  console.log("  Results: " + passed + " passed, " + failed + " failed");
  console.log(bar + "\n");

  process.exit(failed > 0 ? 1 : 0);
})();
