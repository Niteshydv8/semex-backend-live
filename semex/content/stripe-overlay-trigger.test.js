/**
 * stripe-overlay-trigger.test.js
 *
 * Regression guard for Task 114: the SEMEX overlay must NOT appear on pages
 * that merely load Stripe.js (which injects a hidden controller iframe on any
 * site), but MUST appear when a real Stripe Payment/Card Element iframe is
 * present (src contains "elements-inner").
 *
 * Tests the real production source at runtime:
 *   semex/content/content.js  — _semexWatchEmbeddedStripe / _semexHasStripeFrame
 *
 * Run:  node semex/content/stripe-overlay-trigger.test.js
 */

"use strict";

const fs   = require("fs");
const path = require("path");
const vm   = require("vm");

// ─── Source ───────────────────────────────────────────────────────────────────

const CONTENT_JS  = path.join(__dirname, "content.js");
if (!fs.existsSync(CONTENT_JS)) throw new Error("Source file not found: " + CONTENT_JS);

const CONTENT_SRC = fs.readFileSync(CONTENT_JS, "utf8");

// ─── Sanity-check that the guard logic is in the source ───────────────────────

const GUARD_MARKER = '_src.includes("js.stripe.com") && _src.includes("elements-inner")';
if (!CONTENT_SRC.includes(GUARD_MARKER))
  throw new Error(
    "elements-inner guard not found in content.js — the gating logic may have been removed or renamed.\n" +
    "Expected: " + GUARD_MARKER
  );

const CONTROLLER_COMMENT = "controller";
if (!CONTENT_SRC.includes("elements-inner") || !CONTENT_SRC.includes("controller"))
  throw new Error("Surrounding comment about controller-frame vs elements-inner not found");

// ─── Extract _semexHasStripeFrame body ────────────────────────────────────────
//
// The function is a closure arrow defined as:
//   const _semexHasStripeFrame = () => { … };
// We extract just the body (the Array.from … logic) for isolated unit tests,
// then test the full _semexWatchEmbeddedStripe injection flow separately.

function extractHasStripeFrameBody(src) {
  const marker = "const _semexHasStripeFrame = () => {";
  const start  = src.indexOf(marker);
  if (start === -1) throw new Error("_semexHasStripeFrame declaration not found in content.js");

  // Walk from the `{` that opens the arrow body
  const openBrace = src.indexOf("{", start + marker.length - 1);
  let depth = 0, i = openBrace;
  while (i < src.length) {
    if      (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) { i++; break; } }
    i++;
  }
  return src.slice(openBrace, i); // includes the outer { }
}

const HAS_FRAME_BODY = extractHasStripeFrameBody(CONTENT_SRC);

// Confirm the extracted body contains the key guard:
if (!HAS_FRAME_BODY.includes("elements-inner"))
  throw new Error("Extracted _semexHasStripeFrame body does not contain 'elements-inner'");
if (!HAS_FRAME_BODY.includes("js.stripe.com"))
  throw new Error("Extracted _semexHasStripeFrame body does not contain 'js.stripe.com'");

// ─── Helper: run _semexHasStripeFrame with a custom iframe list ───────────────

function runHasStripeFrame(iframeSrcs) {
  // Build a fake document.querySelectorAll("iframe") that returns iframeSrcs
  const iframes = iframeSrcs.map(src => ({ src }));
  const ctx = vm.createContext({
    document: {
      querySelectorAll: (sel) => sel === "iframe" ? iframes : [],
    },
    Array,
    __result__: null,
  });
  // Wrap the body in a function expression and capture its return value
  const script = new vm.Script(
    "__result__ = (function() " + HAS_FRAME_BODY + ")();"
  );
  script.runInContext(ctx);
  return ctx.__result__;
}

// ─── Helper: run _semexWatchEmbeddedStripe and capture sent messages ───────────
//
// Simulates the MutationObserver-free path (initial _semexMaybeInject() call).
// Returns the list of messages passed to safeSendMessage.

function runWatchEmbeddedStripe({ iframeSrcs, overlayAlive }) {
  const sentMessages = [];
  const iframes = iframeSrcs.map(src => ({ src, nodeType: 1, tagName: "IFRAME" }));

  // We re-run _semexWatchEmbeddedStripe from the source, with the minimal
  // stubs it needs. MutationObserver is stubbed to a no-op so we only test
  // the synchronous initial check.
  const WIN = { top: null, location: { href: "https://example.com/" } };
  WIN.top = WIN; // top frame

  const ctx = vm.createContext({
    window:   WIN,
    document: {
      getElementById:   (id) => {
        if (id === "semex-overlay") {
          return overlayAlive ? { hasAttribute: () => true } : null;
        }
        return null;
      },
      querySelectorAll: (sel) => sel === "iframe" ? iframes : [],
      documentElement:  {},
    },
    Array,
    MutationObserver: function(cb) {
      return { observe: () => {}, disconnect: () => {} };
    },
    safeSendMessage: (msg) => { sentMessages.push(msg); },
    setTimeout:      () => {},
  });

  // Extract just the _semexWatchEmbeddedStripe IIFE from the source
  // (it is a named IIFE: (function _semexWatchEmbeddedStripe() { … })();)
  const marker = "(function _semexWatchEmbeddedStripe()";
  const start  = CONTENT_SRC.indexOf(marker);
  if (start === -1) throw new Error("_semexWatchEmbeddedStripe IIFE not found in content.js");

  // Walk to the outer closing `);`
  let depth = 0, i = start;
  let inFn = false;
  while (i < CONTENT_SRC.length) {
    if (CONTENT_SRC[i] === "(") { depth++; inFn = true; }
    else if (CONTENT_SRC[i] === ")") {
      depth--;
      if (inFn && depth === 0) {
        // consume the trailing `;` if present
        if (CONTENT_SRC[i + 1] === ";") i++;
        i++;
        break;
      }
    }
    i++;
  }
  const IIFE_SRC = CONTENT_SRC.slice(start, i);

  // The paren-counter stops at the `)` that closes the function expression:
  //   (function _semexWatchEmbeddedStripe() { … })
  // The trailing `()` invocation is NOT included, so we append it explicitly.
  const IIFE_CALL = IIFE_SRC + "();";
  try {
    new vm.Script(IIFE_CALL).runInContext(ctx);
  } catch (e) {
    // Any errors that aren't about the symbols we care about are fine to swallow —
    // the outer try/catch in the IIFE means most errors are already suppressed.
    // If the extraction hit other parts of the file, rethrow.
    if (!e.message.includes("is not defined")) throw e;
  }

  return sentMessages;
}

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
    console.error("  \u2717  " + name +
      "  (expected " + JSON.stringify(expected) + ", got " + JSON.stringify(actual) + ")");
    failed++;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART A — _semexHasStripeFrame() unit tests (real source body)
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\n=== A. _semexHasStripeFrame() — controller-only pages must return false ===\n");

console.log("Group A1: controller-only frames (common on any Stripe.js-using site)");

assert(
  !runHasStripeFrame([
    "https://js.stripe.com/v3/controller-with-preconnect-c7960ef82efc33ba.html",
  ]),
  "controller-with-preconnect-*.html only → false (no overlay)"
);

assert(
  !runHasStripeFrame([
    "https://js.stripe.com/v3/controller-c7960ef82efc33ba.html",
  ]),
  "controller-*.html only → false"
);

assert(
  !runHasStripeFrame([]),
  "no iframes at all → false"
);

assert(
  !runHasStripeFrame([
    "https://js.stripe.com/v3/m-outer-3a2b.html",
    "https://js.stripe.com/v3/controller-abc.html",
  ]),
  "m-outer + controller frames (no elements-inner) → false"
);

assert(
  !runHasStripeFrame([
    "https://cdn.example.com/payment-ui.html",
    "https://other.com/frame.html",
  ]),
  "non-Stripe iframes only → false"
);

console.log("\nGroup A2: real Payment/Card Element iframes must return true");

assert(
  runHasStripeFrame([
    "https://js.stripe.com/v3/elements-inner-payment-abc123.html",
  ]),
  "elements-inner-payment-* → true (overlay should appear)"
);

assert(
  runHasStripeFrame([
    "https://js.stripe.com/v3/elements-inner-card-xyz456.html",
  ]),
  "elements-inner-card-* → true"
);

assert(
  runHasStripeFrame([
    "https://js.stripe.com/v3/elements-inner-habanero-def.html",
  ]),
  "elements-inner-habanero-* → true (new Stripe UI)"
);

console.log("\nGroup A3: mixed controller + real element → true (real element present)");

assert(
  runHasStripeFrame([
    "https://js.stripe.com/v3/controller-with-preconnect-abc.html",
    "https://js.stripe.com/v3/elements-inner-payment-xyz.html",
  ]),
  "controller + elements-inner-payment → true"
);

assert(
  runHasStripeFrame([
    "https://js.stripe.com/v3/controller-abc.html",
    "https://js.stripe.com/v3/elements-inner-card-xyz.html",
  ]),
  "controller + elements-inner-card → true"
);

// ═══════════════════════════════════════════════════════════════════════════════
// PART B — _semexWatchEmbeddedStripe full injection flow (real IIFE from source)
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\n=== B. _semexWatchEmbeddedStripe — INJECT_OVERLAY message gating ===\n");

console.log("Group B1: controller-only page — INJECT_OVERLAY must NOT be sent");
{
  const msgs = runWatchEmbeddedStripe({
    iframeSrcs: ["https://js.stripe.com/v3/controller-with-preconnect-c7960ef82efc33ba.html"],
    overlayAlive: false,
  });
  const injected = msgs.filter(m => m.type === "INJECT_OVERLAY");
  assertEquals(injected.length, 0,
    "controller-only: INJECT_OVERLAY count === 0");
}

{
  const msgs = runWatchEmbeddedStripe({
    iframeSrcs: [],
    overlayAlive: false,
  });
  const injected = msgs.filter(m => m.type === "INJECT_OVERLAY");
  assertEquals(injected.length, 0,
    "no iframes: INJECT_OVERLAY count === 0");
}

{
  // Replit / SaaS dashboard pattern: Stripe.js loaded but only controller injected
  const msgs = runWatchEmbeddedStripe({
    iframeSrcs: [
      "https://js.stripe.com/v3/m-outer-abc.html",
      "https://js.stripe.com/v3/controller-abc.html",
    ],
    overlayAlive: false,
  });
  const injected = msgs.filter(m => m.type === "INJECT_OVERLAY");
  assertEquals(injected.length, 0,
    "m-outer + controller (no elements-inner): INJECT_OVERLAY count === 0");
}

console.log("\nGroup B2: real elements-inner Payment Element — INJECT_OVERLAY sent exactly once");
{
  const msgs = runWatchEmbeddedStripe({
    iframeSrcs: ["https://js.stripe.com/v3/elements-inner-payment-abc123.html"],
    overlayAlive: false,
  });
  const injected = msgs.filter(m => m.type === "INJECT_OVERLAY");
  assertEquals(injected.length, 1,
    "elements-inner-payment: INJECT_OVERLAY sent exactly once");
}

{
  const msgs = runWatchEmbeddedStripe({
    iframeSrcs: ["https://js.stripe.com/v3/elements-inner-card-xyz456.html"],
    overlayAlive: false,
  });
  const injected = msgs.filter(m => m.type === "INJECT_OVERLAY");
  assertEquals(injected.length, 1,
    "elements-inner-card: INJECT_OVERLAY sent exactly once");
}

{
  const msgs = runWatchEmbeddedStripe({
    iframeSrcs: ["https://js.stripe.com/v3/elements-inner-habanero-xyz.html"],
    overlayAlive: false,
  });
  const injected = msgs.filter(m => m.type === "INJECT_OVERLAY");
  assertEquals(injected.length, 1,
    "elements-inner-habanero (new Stripe UI): INJECT_OVERLAY sent exactly once");
}

console.log("\nGroup B3: overlay already live — INJECT_OVERLAY must NOT be sent again");
{
  // Manifest-injected hosts (checkout.stripe.com etc.) already have the overlay live.
  // The watcher must be a no-op in that case.
  const msgs = runWatchEmbeddedStripe({
    iframeSrcs: ["https://js.stripe.com/v3/elements-inner-payment-abc123.html"],
    overlayAlive: true,
  });
  const injected = msgs.filter(m => m.type === "INJECT_OVERLAY");
  assertEquals(injected.length, 0,
    "elements-inner present but overlay already live: INJECT_OVERLAY count === 0");
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART C — MutationObserver branch: lazy-loaded Payment Element
//
// The existing Part B tests only exercise the synchronous _semexMaybeInject()
// call that runs immediately when the IIFE is invoked (with iframes already in
// the DOM).  The real-world critical path is the MutationObserver branch: the
// elements-inner-* iframe is typically injected *after* page load, which is
// exactly when the observer must fire.  A regression there (e.g. observer
// disconnected too early, wrong addedNodes selector) would silently block the
// overlay on live merchant pages.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Helper: exercise the MutationObserver branch ─────────────────────────────
//
// The page starts with no Stripe iframes (so the synchronous initial check
// sends nothing and the MutationObserver is armed).  We then manually fire the
// observer callback with a newly-added iframe node, simulating the merchant's
// lazy mount.

function runWatchEmbeddedStripeLazy({ mutationIframeSrc }) {
  const sentMessages       = [];
  let   capturedMoCallback = null;

  // Start empty; we push into this array before firing the observer so that
  // document.querySelectorAll("iframe") returns the new frame when
  // _semexMaybeInject → _semexHasStripeFrame runs.
  const iframes = [];

  const WIN = { top: null, location: { href: "https://example.com/" } };
  WIN.top = WIN;

  const ctx = vm.createContext({
    window:   WIN,
    document: {
      getElementById:   ()    => null,           // overlay not alive
      querySelectorAll: (sel) => sel === "iframe" ? iframes : [],
      documentElement:  {},
    },
    Array,
    // Intercept the constructor so we can fire the callback manually later.
    MutationObserver: function (cb) {
      capturedMoCallback = cb;                   // capture via closure (outside vm)
      return { observe: () => {}, disconnect: () => {} };
    },
    safeSendMessage: (msg) => { sentMessages.push(msg); },
    setTimeout:      () => {},
  });

  // ── Extract and invoke the _semexWatchEmbeddedStripe IIFE ─────────────────
  const marker = "(function _semexWatchEmbeddedStripe()";
  const start  = CONTENT_SRC.indexOf(marker);
  if (start === -1) throw new Error("_semexWatchEmbeddedStripe IIFE not found in content.js");

  let depth = 0, i = start, inFn = false;
  while (i < CONTENT_SRC.length) {
    if      (CONTENT_SRC[i] === "(") { depth++; inFn = true; }
    else if (CONTENT_SRC[i] === ")") {
      depth--;
      if (inFn && depth === 0) { if (CONTENT_SRC[i + 1] === ";") i++; i++; break; }
    }
    i++;
  }
  const IIFE_CALL = CONTENT_SRC.slice(start, i) + "();";

  try { new vm.Script(IIFE_CALL).runInContext(ctx); }
  catch (e) { if (!e.message.includes("is not defined")) throw e; }
  // ─────────────────────────────────────────────────────────────────────────

  // Snapshot messages sent during the synchronous initial check (before any
  // mutation fires).
  const sentBeforeMutation = sentMessages.slice();

  // Simulate the merchant's lazy mount: add the iframe to the live list so
  // querySelectorAll sees it, then fire the observer callback.
  if (capturedMoCallback && mutationIframeSrc !== undefined) {
    const newIframe = { src: mutationIframeSrc, nodeType: 1, tagName: "IFRAME" };
    iframes.push(newIframe);
    capturedMoCallback([{ addedNodes: [newIframe] }]);
  }

  return {
    sentBeforeMutation,
    sentMessages,
    observerCaptured: capturedMoCallback !== null,
  };
}

// ─── Part C tests ─────────────────────────────────────────────────────────────

console.log("\n=== C. MutationObserver branch — lazy-loaded Payment Element ===\n");

console.log("Group C1: elements-inner-payment-* injected after page load → INJECT_OVERLAY sent");
{
  const { sentBeforeMutation, sentMessages, observerCaptured } =
    runWatchEmbeddedStripeLazy({
      mutationIframeSrc: "https://js.stripe.com/v3/elements-inner-payment-abc123.html",
    });

  assert(observerCaptured,
    "C1: MutationObserver was armed (initial DOM scan found nothing to inject)");

  const injectedBefore = sentBeforeMutation.filter(m => m.type === "INJECT_OVERLAY");
  assertEquals(injectedBefore.length, 0,
    "C1: INJECT_OVERLAY NOT sent before the mutation fires");

  const injectedAfter = sentMessages.filter(m => m.type === "INJECT_OVERLAY");
  assertEquals(injectedAfter.length, 1,
    "C1: INJECT_OVERLAY sent exactly once after elements-inner-payment mutation");
}

console.log("\nGroup C2: controller-only iframe injected via mutation → INJECT_OVERLAY NOT sent");
{
  const { sentMessages, observerCaptured } =
    runWatchEmbeddedStripeLazy({
      mutationIframeSrc: "https://js.stripe.com/v3/controller-abc123.html",
    });

  assert(observerCaptured,
    "C2: MutationObserver was armed");

  const injectedAfter = sentMessages.filter(m => m.type === "INJECT_OVERLAY");
  assertEquals(injectedAfter.length, 0,
    "C2: controller-only mutation: INJECT_OVERLAY NOT sent");
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n═══════════════════════════════════════`);
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log(`═══════════════════════════════════════\n`);

if (failed > 0) process.exit(1);
