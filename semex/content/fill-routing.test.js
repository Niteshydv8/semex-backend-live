/**
 * fill-routing.test.js
 *
 * Regression guard for Task 85: confirms that the _semexIsNewUIHost branch
 * added in Task 82 does NOT break old-UI (/c/pay/) checkout fill.
 *
 * Tests the routing decision tree extracted from fillForm() in content.js
 * (lines ~2469-2500) in isolation, without requiring a real browser or Chrome
 * extension APIs.
 *
 * Run:  node semex/content/fill-routing.test.js
 */

"use strict";

// ─── Minimal stubs ────────────────────────────────────────────────────────────

let _testPathname = "/";
let _isMainFrame   = true;

/** Reproduce the exact routing logic from fillForm() (content.js ~2469-2500). */
function routeFillForm({
  pathname,
  isMainFrame,
  elementsAlreadyPresent,   // simulates getMainFrameMatches() returning truthy
  waitForElementResult,     // simulates the awaited waitForElement chain result
}) {
  // Mirrors: const _semexIsNewUIHost = IS_MAIN_FRAME && _semexFillPath.startsWith("/g/pay/");
  const isNewUIHost = isMainFrame && pathname.startsWith("/g/pay/");

  // Mirrors: let _0x5aa32b = _0x1c8959();
  let formPresent = !!elementsAlreadyPresent;

  // Mirrors the wait-branch condition
  const shouldWait =
    !formPresent &&
    !isNewUIHost &&
    (pathname.startsWith("/c/pay/cs_live") ||
      pathname.startsWith("/g/pay/cs_live") ||
      pathname.includes("elements-inner-"));

  if (shouldWait && waitForElementResult) {
    formPresent = true;
  }

  // Mirrors the final dispatch
  if (formPresent) {
    return "executeFillSequence";
  } else if (isNewUIHost) {
    return "FILL_FORM_SUBFRAMES";
  } else {
    return "fillComponentFrame";
  }
}

// ─── Test harness ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) {
    console.log(`  ✓  ${name}`);
    passed++;
  } else {
    console.error(`  ✗  ${name}`);
    failed++;
  }
}

function assertEquals(actual, expected, name) {
  if (actual === expected) {
    console.log(`  ✓  ${name}`);
    passed++;
  } else {
    console.error(`  ✗  ${name}  (expected "${expected}", got "${actual}")`);
    failed++;
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

console.log("\n=== Old-UI (/c/pay/) fill routing regression tests ===\n");

// ── 1. /c/pay/ with elements already in DOM ───────────────────────────────────
console.log("Group 1: /c/pay/ — elements already present in the main frame");

assertEquals(
  routeFillForm({
    pathname: "/c/pay/cs_live_abc123",
    isMainFrame: true,
    elementsAlreadyPresent: true,
    waitForElementResult: false,
  }),
  "executeFillSequence",
  "/c/pay/cs_live — elements found immediately → executeFillSequence"
);

// ── 2. /c/pay/ with elements appearing after the wait ─────────────────────────
console.log("\nGroup 2: /c/pay/ — elements appear after async wait");

assertEquals(
  routeFillForm({
    pathname: "/c/pay/cs_live_abc123",
    isMainFrame: true,
    elementsAlreadyPresent: false,  // not in DOM yet
    waitForElementResult: true,     // waitForElement resolves them
  }),
  "executeFillSequence",
  "/c/pay/cs_live — elements found after wait → executeFillSequence (NOT subframes)"
);

assert(
  routeFillForm({
    pathname: "/c/pay/cs_live_abc123",
    isMainFrame: true,
    elementsAlreadyPresent: false,
    waitForElementResult: true,
  }) !== "FILL_FORM_SUBFRAMES",
  "/c/pay/cs_live — MUST NOT dispatch FILL_FORM_SUBFRAMES"
);

// ── 3. /c/pay/ with nothing found (wait times out) ────────────────────────────
console.log("\nGroup 3: /c/pay/ — elements never appear (wait times out)");

assertEquals(
  routeFillForm({
    pathname: "/c/pay/cs_live_abc123",
    isMainFrame: true,
    elementsAlreadyPresent: false,
    waitForElementResult: false,    // waitForElement timed out
  }),
  "fillComponentFrame",
  "/c/pay/cs_live — wait timeout falls through to fillComponentFrame"
);

// ── 4. _semexIsNewUIHost is false for /c/pay/ ─────────────────────────────────
console.log("\nGroup 4: _semexIsNewUIHost must be false for /c/pay/");

function isNewUIHost(isMainFrame, pathname) {
  return isMainFrame && pathname.startsWith("/g/pay/");
}

assert(
  !isNewUIHost(true, "/c/pay/cs_live_abc123"),
  "/c/pay/cs_live — isNewUIHost === false"
);

assert(
  !isNewUIHost(true, "/c/pay/"),
  "/c/pay/ root — isNewUIHost === false"
);

// ── 5. /g/pay/ on main frame DOES use FILL_FORM_SUBFRAMES ─────────────────────
console.log("\nGroup 5: /g/pay/ on main frame → FILL_FORM_SUBFRAMES (new-UI path)");

assertEquals(
  routeFillForm({
    pathname: "/g/pay/cs_live_xyz999",
    isMainFrame: true,
    elementsAlreadyPresent: false,
    waitForElementResult: false,
  }),
  "FILL_FORM_SUBFRAMES",
  "/g/pay/ main frame — routes to FILL_FORM_SUBFRAMES"
);

// ── 6. elements-inner (subframe of new-UI) uses wait-then-execute ─────────────
console.log("\nGroup 6: elements-inner-* iframe — wait then executeFillSequence");

assertEquals(
  routeFillForm({
    pathname: "/elements-inner-habanero/",
    isMainFrame: false,            // this IS a subframe, not the top frame
    elementsAlreadyPresent: false,
    waitForElementResult: true,
  }),
  "executeFillSequence",
  "elements-inner subframe — wait resolves → executeFillSequence"
);

assert(
  routeFillForm({
    pathname: "/elements-inner-habanero/",
    isMainFrame: false,
    elementsAlreadyPresent: false,
    waitForElementResult: true,
  }) !== "FILL_FORM_SUBFRAMES",
  "elements-inner subframe — MUST NOT dispatch FILL_FORM_SUBFRAMES again"
);

// ── 7. /c/pay/ NEVER routes to FILL_FORM_SUBFRAMES regardless of element state ─
console.log("\nGroup 7: /c/pay/ never dispatches FILL_FORM_SUBFRAMES under any condition");

for (const [elemPresent, waitResult] of [
  [false, false],
  [false, true],
  [true,  false],
  [true,  true],
]) {
  const route = routeFillForm({
    pathname: "/c/pay/cs_live_abc123",
    isMainFrame: true,
    elementsAlreadyPresent: elemPresent,
    waitForElementResult: waitResult,
  });
  assert(
    route !== "FILL_FORM_SUBFRAMES",
    `/c/pay/ (elemPresent=${elemPresent}, waitResult=${waitResult}) → "${route}" (not FILL_FORM_SUBFRAMES)`
  );
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n═══════════════════════════════════════`);
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log(`═══════════════════════════════════════\n`);

if (failed > 0) {
  process.exit(1);
}
