/**
 * fill-selectors-and-cache.test.js
 *
 * Regression guard for the fill-pipeline fixes (task #134).
 *
 * Four independent suites — all run in pure Node.js without a real browser,
 * Chrome extension APIs, or network access:
 *
 *   A. Selector invariants — validates the Stripe CSS selectors in
 *      server-client.js: no duplicate tokens, all required element IDs present.
 *
 *   B. Selector → element matching — lightweight CSS matcher verifies that
 *      the selector strings actually *find* representative Stripe DOM elements
 *      (new-UI payment-*Input IDs, hosted-fields Field-*Input IDs, classic
 *      name/autocomplete attributes).
 *
 *   C. CHECK_CONFIG cache-write — confirms background.js writes to __xcabuf
 *      after building the fill config (so fillFormFromOverlay's
 *      GET_CACHED_FORM_DATA poll resolves in ~120 ms instead of timing out).
 *      Also confirms the old direct FILL_FORM sendMessage was removed.
 *
 *   D. Exception catch → ok:false — confirms the catch block in
 *      fillFormFromOverlay posts { ok: false, error: "exception" } so the
 *      overlay surfaces a visible error rather than silently faking success.
 *
 * Run:  node semex/content/fill-selectors-and-cache.test.js
 */

"use strict";

const fs   = require("fs");
const path = require("path");

// ─── Source files ─────────────────────────────────────────────────────────────

const SERVER_CLIENT_JS = path.join(__dirname, "../shared/server-client.js");
const BACKGROUND_JS    = path.join(__dirname, "../background/background.js");
const CONTENT_JS       = path.join(__dirname, "content.js");

for (const f of [SERVER_CLIENT_JS, BACKGROUND_JS, CONTENT_JS]) {
  if (!fs.existsSync(f)) throw new Error("Source file not found: " + f);
}

const SC_SRC  = fs.readFileSync(SERVER_CLIENT_JS, "utf8");
const BG_SRC  = fs.readFileSync(BACKGROUND_JS,    "utf8");
const CT_SRC  = fs.readFileSync(CONTENT_JS,       "utf8");

// ─── Test harness ─────────────────────────────────────────────────────────────

let passed = 0, failed = 0;

function assert(cond, name) {
  if (cond) {
    console.log("  ✓  " + name);
    passed++;
  } else {
    console.error("  ✗  " + name);
    failed++;
  }
}

function assertEquals(actual, expected, name) {
  if (actual === expected) {
    console.log("  ✓  " + name);
    passed++;
  } else {
    console.error(
      "  ✗  " + name +
      "  (expected " + JSON.stringify(expected) + ", got " + JSON.stringify(actual) + ")"
    );
    failed++;
  }
}

// ─── Helper: extract the Stripe selectors object from server-client.js ────────
//
// Returns a plain JS object: { cardNumber: "...", expiry: "...", cvv: "...", ... }
// by locating the `if (domain.includes('stripe')) return {` block and eval-ing
// just the selectors sub-object with no Chrome or network deps.

function extractStripeSelectors(src) {
  const STRIPE_MARKER = "if (domain.includes('stripe')) return {";
  const start = src.indexOf(STRIPE_MARKER);
  if (start === -1) throw new Error("Stripe selector block not found in server-client.js");

  // Walk from the opening `{` of the returned object literal
  const openBrace = src.indexOf("{", start + STRIPE_MARKER.length - 1);
  let depth = 0, i = openBrace;
  while (i < src.length) {
    if      (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) { i++; break; } }
    i++;
  }
  const RETURN_OBJ = src.slice(openBrace, i);
  // eval in a very limited scope — safe because we wrote this source
  // eslint-disable-next-line no-new-func
  const obj = (new Function("return " + RETURN_OBJ))();
  return obj.selectors;
}

const STRIPE_SEL = extractStripeSelectors(SC_SRC);

// ─── Helper: lightweight CSS selector matcher ──────────────────────────────────
//
// Handles enough CSS to cover the simple attribute/class/tag selectors used
// in getSelectors().  Not a full CSS engine — just sufficient for this test.
//
// Supported:  tag, #id, .class, [attr="value"], compound (tag.class, tag[attr])
// Unsupported: descendant combinators, pseudo-classes, :has(), …

function parseSingleSelector(token) {
  // Returns { tag, id, name, autocomplete, className }
  const sel = {
    tag:          null,   // "input" | "select" | null
    id:           null,
    name:         null,
    autocomplete: null,
    className:    null,
    type:         null,
    value:        null,
    ariaLabel:    null,
  };

  // Extract leading tag name
  const tagMatch = token.match(/^([a-zA-Z][a-zA-Z0-9-]*)/);
  if (tagMatch) sel.tag = tagMatch[1].toLowerCase();

  // Extract class names  .Foo
  const classMatches = token.matchAll(/\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g);
  const classes = [...classMatches].map(m => m[1]);
  if (classes.length) sel.className = classes;

  // Extract [attr="value"] pairs (handles double or single quotes)
  const attrMatches = token.matchAll(/\[([a-zA-Z-]+)=["']?([^"'\]]+)["']?\]/g);
  for (const m of attrMatches) {
    const attr = m[1], val = m[2];
    if (attr === "id")           sel.id           = val;
    else if (attr === "name")    sel.name         = val;
    else if (attr === "autocomplete") sel.autocomplete = val;
    else if (attr === "type")    sel.type         = val;
    else if (attr === "value")   sel.value        = val;
    else if (attr === "aria-label") sel.ariaLabel = val;
  }

  return sel;
}

function selectorMatchesElement(selectorToken, el) {
  const sel = parseSingleSelector(selectorToken.trim());

  // Tag check
  if (sel.tag && el.tagName && sel.tag !== el.tagName.toLowerCase()) return false;

  // id
  if (sel.id !== null && el.id !== sel.id) return false;

  // name attribute
  if (sel.name !== null && el.name !== sel.name) return false;

  // autocomplete
  if (sel.autocomplete !== null && el.autocomplete !== sel.autocomplete) return false;

  // class
  if (sel.className) {
    const elClasses = (el.className || "").split(" ");
    for (const c of sel.className) {
      if (!elClasses.includes(c)) return false;
    }
  }

  return true;
}

/**
 * Returns true if any comma-separated token in `selectorList` matches `el`.
 */
function matches(selectorList, el) {
  const tokens = selectorList.split(",");
  return tokens.some(tok => selectorMatchesElement(tok, el));
}

// ═══════════════════════════════════════════════════════════════════════════════
// A. Selector invariants
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\n=== A. Selector invariants (server-client.js Stripe block) ===\n");

console.log("A1. CVV selector — no duplicate input[name=\"cvc\"]");

function countTokenMatches(selectorList, token) {
  // Split by comma, count how many tokens match the given literal
  return selectorList.split(",").filter(t => t.trim() === token.trim()).length;
}

assertEquals(
  countTokenMatches(STRIPE_SEL.cvv, 'input[name="cvc"]'),
  1,
  'cvv: input[name="cvc"] appears exactly once (duplicate removed)'
);

console.log("\nA2. CVV selector — required hosted-fields ID present");

assert(
  STRIPE_SEL.cvv.includes('input[id="Field-cvcInput"]'),
  'cvv: contains input[id="Field-cvcInput"] (Stripe hosted-fields element)'
);

assert(
  STRIPE_SEL.cvv.includes('input[id="payment-cvcInput"]'),
  'cvv: still contains input[id="payment-cvcInput"] (new Stripe UI)'
);

console.log("\nA3. Name selector — required hosted-fields ID present");

assert(
  STRIPE_SEL.name.includes('[id="Field-nameInput"]'),
  'name: contains [id="Field-nameInput"] (Stripe hosted-fields element)'
);

assert(
  STRIPE_SEL.name.includes('[id="payment-nameInput"]'),
  'name: still contains [id="payment-nameInput"] (new Stripe UI)'
);

console.log("\nA4. Name selector — autocomplete broadened (not over-specified with name=\"name\")");

assert(
  !STRIPE_SEL.name.includes('input[name="name"][autocomplete="cc-name"]'),
  'name: no longer uses over-specified input[name="name"][autocomplete=...] compound'
);

assert(
  STRIPE_SEL.name.includes('input[autocomplete="cc-name"]') ||
  STRIPE_SEL.name.includes('[autocomplete="cc-name"]'),
  'name: contains the broadened autocomplete="cc-name" fallback'
);

console.log("\nA5. Address2 selector — generic autocomplete fallback added");

assert(
  STRIPE_SEL.address2.includes('input[autocomplete="address-line2"]'),
  'address2: contains input[autocomplete="address-line2"] fallback'
);

console.log("\nA6. CardNumber selector — legacy Stripe Elements class");

assert(
  STRIPE_SEL.cardNumber.includes("input.InputElement"),
  'cardNumber: contains input.InputElement (legacy Stripe Elements class-based input)'
);

console.log("\nA7. All required selector keys present");

const REQUIRED_KEYS = ["cardNumber", "expiry", "cvv", "name", "country",
                        "address", "address2", "city", "zip", "email"];
for (const key of REQUIRED_KEYS) {
  assert(
    typeof STRIPE_SEL[key] === "string" && STRIPE_SEL[key].length > 0,
    "selectors." + key + " is a non-empty string"
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// B. Selector → element matching
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\n=== B. Selector → element matching (lightweight CSS matcher) ===\n");

console.log("B1. New Stripe UI — payment-*Input element IDs");

const NEW_UI_ELEMENTS = [
  { field: "cardNumber", el: { tagName: "INPUT", id: "payment-numberInput", name: "", autocomplete: "", className: "" } },
  { field: "expiry",     el: { tagName: "INPUT", id: "payment-expiryInput", name: "", autocomplete: "", className: "" } },
  { field: "cvv",        el: { tagName: "INPUT", id: "payment-cvcInput",    name: "", autocomplete: "", className: "" } },
  { field: "name",       el: { tagName: "INPUT", id: "payment-nameInput",   name: "", autocomplete: "", className: "" } },
];

for (const { field, el } of NEW_UI_ELEMENTS) {
  assert(
    matches(STRIPE_SEL[field], el),
    `${field}: selector matches new-UI element id="${el.id}"`
  );
}

console.log("\nB2. Stripe hosted-fields — Field-*Input element IDs");

const HOSTED_FIELD_ELEMENTS = [
  { field: "cvv",  el: { tagName: "INPUT", id: "Field-cvcInput",  name: "", autocomplete: "", className: "" } },
  { field: "name", el: { tagName: "INPUT", id: "Field-nameInput", name: "", autocomplete: "", className: "" } },
];

for (const { field, el } of HOSTED_FIELD_ELEMENTS) {
  assert(
    matches(STRIPE_SEL[field], el),
    `${field}: selector matches hosted-fields element id="${el.id}"`
  );
}

console.log("\nB3. Classic Stripe checkout — name/autocomplete attributes");

const CLASSIC_ELEMENTS = [
  { field: "cardNumber", el: { tagName: "INPUT", id: "",         name: "cardNumber", autocomplete: "",         className: "" } },
  { field: "cardNumber", el: { tagName: "INPUT", id: "",         name: "",           autocomplete: "cc-number", className: "" } },
  { field: "expiry",     el: { tagName: "INPUT", id: "cardExpiry",name: "",          autocomplete: "",          className: "" } },
  { field: "cvv",        el: { tagName: "INPUT", id: "",          name: "cvc",       autocomplete: "",          className: "" } },
  { field: "name",       el: { tagName: "INPUT", id: "",          name: "",          autocomplete: "cc-name",   className: "" } },
  { field: "address",    el: { tagName: "INPUT", id: "",          name: "",          autocomplete: "address-line1", className: "" } },
  { field: "address2",   el: { tagName: "INPUT", id: "",          name: "",          autocomplete: "address-line2", className: "" } },
  { field: "zip",        el: { tagName: "INPUT", id: "",          name: "",          autocomplete: "postal-code", className: "" } },
];

for (const { field, el } of CLASSIC_ELEMENTS) {
  const label = el.name       ? `name="${el.name}"`
              : el.autocomplete ? `autocomplete="${el.autocomplete}"`
              : el.id          ? `id="${el.id}"`
              : "?";
  assert(
    matches(STRIPE_SEL[field], el),
    `${field}: selector matches classic element (${label})`
  );
}

console.log("\nB4. Legacy Stripe Elements — InputElement class");

assert(
  matches(STRIPE_SEL.cardNumber, {
    tagName: "INPUT", id: "", name: "", autocomplete: "", className: "InputElement"
  }),
  "cardNumber: selector matches legacy input.InputElement"
);

console.log("\nB5. Classic Stripe Elements — id-based inputs");

assert(
  matches(STRIPE_SEL.cardNumber, {
    tagName: "INPUT", id: "cardNumber", name: "", autocomplete: "", className: ""
  }),
  "cardNumber: selector still matches id=\"cardNumber\""
);

// ═══════════════════════════════════════════════════════════════════════════════
// C. CHECK_CONFIG cache-write (background.js)
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\n=== C. CHECK_CONFIG cache-write (background.js) ===\n");

// Extract the CHECK_CONFIG handler block so we don't accidentally match code
// from other handlers (FILL_FORM_SUBFRAMES / GET_CACHED_FORM_DATA also use
// __xcabuf for their own purposes).

function extractCheckConfigBlock(src) {
  const MARKER = 'if (_0x2d827f.type === "CHECK_CONFIG")';
  const start  = src.indexOf(MARKER);
  if (start === -1) throw new Error("CHECK_CONFIG handler not found in background.js");

  // Walk from the opening `{` after the marker
  const openBrace = src.indexOf("{", start + MARKER.length);
  let depth = 0, i = openBrace;
  while (i < src.length) {
    if      (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) { i++; break; } }
    i++;
  }
  return src.slice(openBrace, i);
}

const CC_BLOCK = extractCheckConfigBlock(BG_SRC);

console.log("C1. _cacheEntry is built with address and selectors fields");

assert(
  CC_BLOCK.includes("_cacheEntry"),
  "CHECK_CONFIG block defines _cacheEntry"
);

assert(
  CC_BLOCK.includes("address:"),
  "_cacheEntry includes an address field"
);

assert(
  CC_BLOCK.includes("selectors:"),
  "_cacheEntry includes a selectors field"
);

assert(
  CC_BLOCK.includes("timestamp:"),
  "_cacheEntry includes a timestamp field"
);

console.log("\nC2. __xcabuf buffer write is present");

assert(
  CC_BLOCK.includes('"__xcabuf"'),
  "CHECK_CONFIG handler references the __xcabuf session key"
);

assert(
  CC_BLOCK.includes("_buf.unshift"),
  "new entry is prepended (unshift) so GET_CACHED_FORM_DATA picks it up immediately"
);

assert(
  CC_BLOCK.includes("chrome.storage.session.set"),
  "buffer is written back to session storage"
);

console.log("\nC3. Direct FILL_FORM sendMessage was removed from CHECK_CONFIG");

// The old code did: chrome.tabs.sendMessage(_0x393846.tab.id, { type: "FILL_FORM", ... })
// inside the CHECK_CONFIG block — it caused a double-fill race with
// fillFormFromOverlay.  Verify it is no longer in this handler block.
assert(
  !CC_BLOCK.includes('"FILL_FORM"'),
  'CHECK_CONFIG block does NOT send a direct "FILL_FORM" message to the tab'
);

console.log("\nC4. Card data always included in payload (no cardReplacement gate)");

// Old: if (!cardReplacement.enabled) { set card }
// New: always set card regardless of cardReplacement
assert(
  !CC_BLOCK.includes("if (!_0x4d740f)"),
  "card-exclusion gate (if (!cardReplacement.enabled)) is gone"
);

assert(
  CC_BLOCK.includes("_0x10490c.values.cardNumber"),
  "cardNumber is always written to the payload values"
);

// ═══════════════════════════════════════════════════════════════════════════════
// D. Exception catch → ok:false (content.js)
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\n=== D. Exception catch → ok:false (content.js fillFormFromOverlay) ===\n");

// Locate fillFormFromOverlay's outer catch block in content.js.
// The function is followed by __name(fillFormFromOverlay, "fillFormFromOverlay")
// so we can bound the extraction.

function extractFillFromOverlayCatch(src) {
  const FN_MARKER   = "async function fillFormFromOverlay(";
  const NAME_MARKER = '__name(fillFormFromOverlay, "fillFormFromOverlay")';

  const fnStart   = src.indexOf(FN_MARKER);
  const fnEnd     = src.indexOf(NAME_MARKER, fnStart);
  if (fnStart === -1 || fnEnd === -1)
    throw new Error("fillFormFromOverlay function not found in content.js");

  return src.slice(fnStart, fnEnd);
}

const FILL_FN = extractFillFromOverlayCatch(CT_SRC);

console.log("D1. Outer catch posts ok: false");

assert(
  FILL_FN.includes("ok: false"),
  "catch block posts { ok: false } so overlay shows an error"
);

console.log("\nD2. Outer catch includes error: \"exception\" label");

assert(
  FILL_FN.includes('error: "exception"'),
  'catch block includes error: "exception" for operator visibility'
);

console.log("\nD3. Outer catch does NOT post a bare SEMEX_FILL_FORM_COMPLETE (no ok field)");

// The old catch had: window.postMessage({ type: "SEMEX_FILL_FORM_COMPLETE" }, "*");
// with NO ok field — the overlay treated undefined === false as false → success.
// Verify it no longer exists in the catch by checking for the bare pattern.
const catchIdx = FILL_FN.lastIndexOf("} catch (");
const catchTail = FILL_FN.slice(catchIdx);

// The bare pattern is type:SEMEX_FILL_FORM_COMPLETE without ok:
const barePattern = /postMessage\(\s*\{\s*type:\s*["']SEMEX_FILL_FORM_COMPLETE["']\s*\}/;
assert(
  !barePattern.test(catchTail),
  "catch no longer posts a bare SEMEX_FILL_FORM_COMPLETE without an ok field"
);

console.log("\nD4. config_unavailable path still posts ok: false (not broken by refactor)");

// fillFormFromOverlay has two places that post SEMEX_FILL_FORM_COMPLETE:
//   1. The catch block (exception)
//   2. The config_unavailable path (cache poll timed out)
// Both should post ok:false.
assert(
  FILL_FN.includes('error: "config_unavailable"'),
  'config_unavailable path still present and posts ok:false, error:"config_unavailable"'
);

// ═══════════════════════════════════════════════════════════════════════════════
// E. Required-field empty-after-fill validation (content.js executeFillSequence)
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\n=== E. Required-field validation after fill (content.js executeFillSequence) ===\n");

// Locate executeFillSequence in content.js by bounding between the function
// declaration and the __name sentinel that follows it.

function extractExecuteFillSequence(src) {
  const FN_MARKER   = "async function executeFillSequence(";
  const NAME_MARKER = '__name(executeFillSequence, "executeFillSequence")';

  const fnStart = src.indexOf(FN_MARKER);
  const fnEnd   = src.indexOf(NAME_MARKER, fnStart);
  if (fnStart === -1 || fnEnd === -1)
    throw new Error("executeFillSequence not found in content.js");

  return src.slice(fnStart, fnEnd);
}

const EXEC_FILL = extractExecuteFillSequence(CT_SRC);

console.log("E1. _semexFillOk tracking variable is declared fail-closed (starts false)");

assert(
  EXEC_FILL.includes("_semexFillOk"),
  "executeFillSequence declares _semexFillOk to track validation outcome"
);

// Must start as false (fail-closed) so exceptions before validation don't post success.
// Check the declaration before the try block.
const _execBeforeTry = EXEC_FILL.slice(0, EXEC_FILL.indexOf("try {"));
assert(
  /let\s+_semexFillOk\s*=\s*false/.test(_execBeforeTry),
  "_semexFillOk is initialised to false (fail-closed) before the try block"
);

console.log("\nE2. _semexMissing array is built for required fields");

assert(
  EXEC_FILL.includes("_semexMissing"),
  "executeFillSequence builds a _semexMissing list of empty required fields"
);

console.log("\nE3. All three required fields are checked");

assert(
  EXEC_FILL.includes('"cardNumber"'),
  'validation checks "cardNumber"'
);
assert(
  EXEC_FILL.includes('"expiry"'),
  'validation checks "expiry"'
);
assert(
  EXEC_FILL.includes('"cvv"'),
  'validation checks "cvv"'
);

console.log("\nE4. empty_fields error string is produced when fields are missing");

assert(
  EXEC_FILL.includes('"empty_fields:"'),
  'validation produces an error string prefixed "empty_fields:"'
);

console.log("\nE4a. Absent/falsy selector is treated as a missing field (not silently skipped)");

// The old guard `if (_semexSel)` skipped the check when the selector was
// undefined/null/empty, leaving _semexMissing empty and reporting ok:true even
// though the field was never reachable.  Verify the new code pushes to missing
// when the selector is absent.
assert(
  EXEC_FILL.includes("_semexMissing.push(_semexRc.label)") ||
  EXEC_FILL.includes("_semexMissing.push"),
  "absent selector pushes the field label into _semexMissing"
);
// The old conditional was `if (_semexSel) { ... }` — verify it's now `if (!_semexSel)`
// (i.e. the absent-guard path explicitly pushes to missing).
assert(
  EXEC_FILL.includes("if (!_semexSel)"),
  "absent selector branch uses if (!_semexSel) to push missing immediately"
);

console.log("\nE4b. _semexFillOk is explicitly set to true in the all-fields-present branch");

// Because _semexFillOk starts false, the success branch must explicitly set it
// to true — otherwise every successful fill would post ok:false.
assert(
  EXEC_FILL.includes("_semexFillOk = true"),
  "validation explicitly sets _semexFillOk = true when all required fields are filled"
);

console.log("\nE5. finally block posts ok: _semexFillOk (not a bare message)");

// Extract the finally block (everything from "} finally {" to the closing "}")
const finallyIdx = EXEC_FILL.lastIndexOf("} finally {");
assert(finallyIdx !== -1, "executeFillSequence has a finally block");

const finallyBlock = EXEC_FILL.slice(finallyIdx);

assert(
  finallyBlock.includes("ok: _semexFillOk"),
  "finally block posts ok: _semexFillOk in the local-frame path"
);

// Bare SEMEX_FILL_FORM_COMPLETE (no ok field) must no longer appear in finally
const _semexBarePattern = /postMessage\(\s*\{\s*type:\s*["']SEMEX_FILL_FORM_COMPLETE["']\s*\}/;
assert(
  !_semexBarePattern.test(finallyBlock),
  "finally block no longer posts a bare SEMEX_FILL_FORM_COMPLETE without an ok field"
);

console.log("\nE5b. 1.2-second early-completion timer was removed from executeFillSequence");

// The old setTimeout at the top of executeFillSequence fired a bare
// SEMEX_FILL_FORM_COMPLETE after 1.2 s — before validation ran — allowing
// an empty-field fill to silently succeed on the slow-fill path.
// The body before the try block must not contain an actual setTimeout that
// posts SEMEX_FILL_FORM_COMPLETE (a comment mentioning the old approach is fine).
const beforeTryIdx = EXEC_FILL.indexOf("try {");
const beforeTry = beforeTryIdx !== -1 ? EXEC_FILL.slice(0, beforeTryIdx) : EXEC_FILL;
// Look for a setTimeout that dispatches SEMEX_FILL_FORM_COMPLETE.
// Match: setTimeout( ... SEMEX_FILL_FORM_COMPLETE ... )  — capturing actual call sites,
// not comments (comments are // ... lines, not function call arguments).
const earlyTimerPattern = /setTimeout\s*\([^)]*SEMEX_FILL_FORM_COMPLETE/s;
assert(
  !earlyTimerPattern.test(beforeTry),
  "no early setTimeout posting SEMEX_FILL_FORM_COMPLETE fires before the try block in executeFillSequence"
);

console.log("\nE6. Relay message also carries ok/error (cross-frame path)");

assert(
  finallyBlock.includes("SEMEX_FILL_FORM_COMPLETE_RELAY"),
  "finally has a relay path for cross-origin iframes"
);

assert(
  finallyBlock.includes("ok: _semexFillOk") || finallyBlock.includes("ok:_semexFillOk"),
  "relay sendMessage includes the ok field"
);

console.log("\nE6c. background.js relay handler forwards ok and error fields (not dropped)");

const BG_RELAY_START = BG_SRC.indexOf('"SEMEX_FILL_FORM_COMPLETE_RELAY"');
assert(BG_RELAY_START !== -1, "background.js handles SEMEX_FILL_FORM_COMPLETE_RELAY");

// Walk from the if-block containing the relay handler
const BG_RELAY_OPEN = BG_SRC.indexOf("{", BG_RELAY_START);
let _brd = 0, _bri = BG_RELAY_OPEN;
while (_bri < BG_SRC.length) {
  if (BG_SRC[_bri] === "{") _brd++;
  else if (BG_SRC[_bri] === "}") { _brd--; if (_brd === 0) { _bri++; break; } }
  _bri++;
}
const BG_RELAY_BLOCK = BG_SRC.slice(BG_RELAY_OPEN, _bri);

assert(
  BG_RELAY_BLOCK.includes("ok:") || BG_RELAY_BLOCK.includes("ok :"),
  "background.js relay block forwards ok field to the tab"
);
assert(
  BG_RELAY_BLOCK.includes("error:") || BG_RELAY_BLOCK.includes("error :"),
  "background.js relay block forwards error field to the tab"
);

// The old code sent only { type: "SEMEX_FILL_FORM_COMPLETE_RELAY" } — one field.
// The new code must include at least ok and error alongside type.
const _bgBareRelay = /sendMessage\s*\(\s*_rcTabId\s*,\s*\{\s*type\s*:\s*["']SEMEX_FILL_FORM_COMPLETE_RELAY["']\s*\}/;
assert(
  !_bgBareRelay.test(BG_RELAY_BLOCK),
  "background.js no longer sends a bare relay message with only the type field"
);

console.log("\nE6d. top-frame relay handler is fail-closed (accepts only ok===true)");

// Locate the SEMEX_FILL_FORM_COMPLETE_RELAY handler in content.js (top frame)
// by bounding it between its if-check and the next if-check that follows.
const _rfMarker = '"SEMEX_FILL_FORM_COMPLETE_RELAY"';
const _rfStart  = CT_SRC.indexOf(_rfMarker);
assert(_rfStart !== -1, "top-frame relay handler exists in content.js");

const _rfBlock = CT_SRC.slice(_rfStart, _rfStart + 600);

// Must use === true, not !== false (which accepts undefined as success)
assert(
  _rfBlock.includes(".ok === true"),
  "top-frame relay handler uses ok === true (fail-closed), not ok !== false"
);

console.log("\nE6b. fillComponentFrame posts ok: true (not a bare message)");

// fillComponentFrame is the non-Stripe-Elements fill path (legacy / component
// frames).  It must also include an explicit ok: true so the overlay's
// fail-closed check (ok !== true) doesn't reject it.

function extractFillComponentFrame(src) {
  const FN_MARKER   = "async function fillComponentFrame(";
  const NAME_MARKER = '__name(fillComponentFrame, "fillComponentFrame")';
  const fnStart = src.indexOf(FN_MARKER);
  const fnEnd   = src.indexOf(NAME_MARKER, fnStart);
  if (fnStart === -1 || fnEnd === -1)
    throw new Error("fillComponentFrame not found in content.js");
  return src.slice(fnStart, fnEnd);
}

const FILL_CF = extractFillComponentFrame(CT_SRC);
const _cfBarePattern = /postMessage\(\s*\{\s*type:\s*["']SEMEX_FILL_FORM_COMPLETE["']\s*\}/;
assert(
  !_cfBarePattern.test(FILL_CF),
  "fillComponentFrame no longer posts a bare SEMEX_FILL_FORM_COMPLETE without an ok field"
);
// fillComponentFrame now validates required fields and posts ok: _semexCFFillOk
// (not a hardcoded ok: true) so missing/empty fields report failure.
assert(
  FILL_CF.includes("_semexCFFillOk"),
  "fillComponentFrame uses a validation variable (_semexCFFillOk) rather than hardcoded ok:true"
);
assert(
  FILL_CF.includes("_semexCFMissing"),
  "fillComponentFrame validates required fields and tracks missing ones (_semexCFMissing)"
);
assert(
  FILL_CF.includes('"empty_fields:"'),
  'fillComponentFrame produces an empty_fields: error for missing required fields'
);

console.log("\nE6e. fillFormFromOverlay does NOT post its own ok:true after fillForm()");

// fillFormFromOverlay posts completion signals for error cases (no card, config
// unavailable, exception) but must NOT post ok:true after await fillForm() —
// on subframe paths fillForm() returns before the iframe fill completes, so an
// early ok:true resolves the overlay before required-field validation runs.
function extractFillFormFromOverlay(src) {
  const FN_MARKER   = "async function fillFormFromOverlay(";
  const NAME_MARKER = '__name(fillFormFromOverlay, "fillFormFromOverlay")';
  const fnStart = src.indexOf(FN_MARKER);
  const fnEnd   = src.indexOf(NAME_MARKER, fnStart);
  if (fnStart === -1 || fnEnd === -1)
    throw new Error("fillFormFromOverlay not found in content.js");
  return src.slice(fnStart, fnEnd);
}

const FILL_FROM_OV = extractFillFormFromOverlay(CT_SRC);

// Find the region after the second `await fillForm(` call — that's where the
// old premature ok:true lived.  The `__SEMEX_FILLED_PAGES.add(` landmark
// comes just before the old post.  Verify no ok:true post follows it.
const _fillDoneIdx = FILL_FROM_OV.indexOf("__SEMEX_FILLED_PAGES.add(");
assert(_fillDoneIdx !== -1, "fillFormFromOverlay marks the fill in __SEMEX_FILLED_PAGES");

const _afterFillDone = FILL_FROM_OV.slice(_fillDoneIdx, _fillDoneIdx + 400);
// ok:true should NOT appear as a postMessage right after the mark
const _earlyOkTrue = /postMessage\s*\([^)]*SEMEX_FILL_FORM_COMPLETE[^)]*\)/s;
assert(
  !_earlyOkTrue.test(_afterFillDone),
  "fillFormFromOverlay does NOT post SEMEX_FILL_FORM_COMPLETE ok:true immediately after fillForm() returns"
);

console.log("\nE7a. executeFillSequence returns {ok, error} so callers can gate done-state");

assert(
  EXEC_FILL.includes("return { ok: _semexFillOk"),
  "executeFillSequence returns { ok: _semexFillOk, error } after the finally block"
);

console.log("\nE7b. fillComponentFrame returns {ok, error} so callers can gate done-state");

assert(
  FILL_CF.includes("return { ok: _semexCFFillOk"),
  "fillComponentFrame returns { ok: _semexCFFillOk, error } so callers can gate done-state"
);

console.log("\nE7c. fillForm returns null for subframe paths (result arrives via relay)");

// On subframe paths fillForm dispatches FILL_FORM_SUBFRAMES and returns null
// so fillFormFromOverlay knows not to mark done yet.
function extractFillFormFn(src) {
  const FN_MARKER   = "async function fillForm(";
  const NAME_MARKER = '__name(fillForm, "fillForm")';
  const fnStart = src.indexOf(FN_MARKER);
  const fnEnd   = src.indexOf(NAME_MARKER, fnStart);
  if (fnStart === -1 || fnEnd === -1) throw new Error("fillForm not found in content.js");
  return src.slice(fnStart, fnEnd);
}
const FILL_FORM_FN = extractFillFormFn(CT_SRC);

assert(
  FILL_FORM_FN.includes("return null"),
  "fillForm returns null for async subframe paths (relay carries the actual result)"
);

console.log("\nE7d. fillFormFromOverlay gates done-marking on fill result ok===true");

// The done-markers (__SEMEX_FILLED_PAGES, __SEMEX_FILL_DONE_KEY) must only be
// set inside a block that checks ok === true on the fill result.
assert(
  FILL_FROM_OV.includes("_semexFillResult.ok === true") ||
  FILL_FROM_OV.includes("_semexFillResult && _semexFillResult.ok === true"),
  "fillFormFromOverlay gates __SEMEX_FILLED_PAGES.add() on fill result ok===true"
);

console.log("\nE7. Overlay handles empty_fields: prefix with a descriptive message");

// Load overlay.js
const OVERLAY_JS = path.join(__dirname, "../main-world/overlay.js");
assert(fs.existsSync(OVERLAY_JS), "overlay.js exists in main-world/");

const OV_SRC = fs.existsSync(OVERLAY_JS) ? fs.readFileSync(OVERLAY_JS, "utf8") : "";

assert(
  OV_SRC.includes('"empty_fields:"') || OV_SRC.includes("empty_fields:"),
  'overlay.js handles the "empty_fields:" error prefix'
);

assert(
  OV_SRC.includes("Fields not filled") || OV_SRC.includes("not filled"),
  "overlay shows a descriptive 'Fields not filled' message to the operator"
);

// ═══════════════════════════════════════════════════════════════════════════════
// F. jsdom snapshot tests — selectors vs real Stripe frame HTML
// ═══════════════════════════════════════════════════════════════════════════════
//
// Two committed HTML fixtures represent the element IDs used by Stripe's
// rendered frames.  Each fixture contains ONLY bare <input id="..."> /
// <select id="..."> elements — no name, autocomplete, class, or type attrs —
// so that element.matches(selectorList) can pass ONLY via an ID-based token.
// Fallback tokens (autocomplete="cc-number", class .InputElement, etc.) cannot
// match the fixture elements, meaning a stale or removed ID token causes an
// immediate test failure rather than silently passing via a fallback.
//
// Test pattern:
//   1. doc.getElementById(expectedId) — fixture must contain the element
//   2. el.matches(fullSelectorList)   — getSelectors() must cover this element
//      via the ID-based token; if that token is removed, step 2 fails.
//
// Fixtures:
//   content/fixtures/stripe-habanero-frame.html    — new Payment Element UI (/g/pay/)
//   content/fixtures/stripe-hosted-fields-frame.html — classic hosted-fields (Field-* IDs)
//
// Requires: jsdom (devDependency). jsdom 29.x requires Node >=20; package.json
// engine floor is set to >=20 to match.  A require() failure is a hard error —
// skipping snapshot tests silently is not acceptable.

console.log("\n=== F. jsdom snapshot — selectors vs real Stripe frame HTML ===\n");

// Hard require — not a graceful skip. Snapshot tests are mandatory.
const { JSDOM } = require("jsdom");

const FIXTURE_DIR          = path.join(__dirname, "fixtures");
const HABANERO_FIXTURE     = path.join(FIXTURE_DIR, "stripe-habanero-frame.html");
const HOSTEDFIELDS_FIXTURE = path.join(FIXTURE_DIR, "stripe-hosted-fields-frame.html");

// ── F1: habanero frame (new Stripe Payment Element UI) ──────────────────────
console.log("F1. Habanero frame (new Stripe UI) — element.matches(selector) via ID token\n");

assert(
  fs.existsSync(HABANERO_FIXTURE),
  "stripe-habanero-frame.html fixture exists at content/fixtures/"
);

{
  const habaneroHTML = fs.readFileSync(HABANERO_FIXTURE, "utf8");
  const habaneroDoc  = new JSDOM(habaneroHTML).window.document;

  // Fixture elements have ONLY their `id` attribute — no fallback attrs.
  // Therefore el.matches(selectorList) passes ONLY via an [id="..."] token.
  // Removing or renaming that token causes step 2 to fail, not step 1.
  const HABANERO_FIELDS = [
    // [ selectorKey, expectedElementId ]
    ["cardNumber", "payment-numberInput"],
    ["expiry",     "payment-expiryInput"],
    ["cvv",        "payment-cvcInput"],
    ["name",       "payment-nameInput"],
    ["country",    "payment-countryInput"],
    ["address",    "payment-addressLine1Input"],
    ["address2",   "payment-addressLine2Input"],
    ["city",       "payment-localityInput"],
    ["zip",        "payment-postalCodeInput"],
    ["email",      "paymentForm-emailInput"],
  ];

  for (const [field, expectedId] of HABANERO_FIELDS) {
    const selectorList = STRIPE_SEL[field];
    if (!selectorList) {
      assert(false, `F1 ${field}: selector key missing from getSelectors()`);
      continue;
    }

    // Step 1: element must exist in fixture (update fixture if Stripe renames it)
    const el = habaneroDoc.getElementById(expectedId);
    assert(
      el !== null,
      `F1 ${field}: fixture contains #${expectedId}`
    );
    if (el === null) continue;

    // Step 2: the full selector list covers this element via its ID token
    // (fixture has no fallback attrs, so only an id-based token can match)
    let matched = false;
    try {
      matched = el.matches(selectorList);
    } catch (syntaxErr) {
      assert(false, `F1 ${field}: querySelector threw — malformed selector: ${syntaxErr.message}`);
      continue;
    }
    assert(
      matched,
      `F1 ${field}: getSelectors().${field} covers #${expectedId} via ID token (removing the token fails this test)`
    );
  }
}

// ── F2: hosted-fields frame (Stripe Elements, Field-* IDs) ──────────────────
console.log("\nF2. Hosted-fields frame (Stripe Elements) — element.matches(selector) via Field-* ID token\n");

assert(
  fs.existsSync(HOSTEDFIELDS_FIXTURE),
  "stripe-hosted-fields-frame.html fixture exists at content/fixtures/"
);

{
  const hfHTML = fs.readFileSync(HOSTEDFIELDS_FIXTURE, "utf8");
  const hfDoc  = new JSDOM(hfHTML).window.document;

  const HOSTED_FIELDS = [
    ["cardNumber", "Field-numberInput"],
    ["expiry",     "Field-expiryInput"],
    ["cvv",        "Field-cvcInput"],
    ["name",       "Field-nameInput"],
    ["address",    "Field-addressLine1Input"],
    ["address2",   "Field-addressLine2Input"],
  ];

  for (const [field, expectedId] of HOSTED_FIELDS) {
    const selectorList = STRIPE_SEL[field];
    if (!selectorList) {
      assert(false, `F2 ${field}: selector key missing from getSelectors()`);
      continue;
    }

    // Step 1: element must exist in fixture
    const el = hfDoc.getElementById(expectedId);
    assert(
      el !== null,
      `F2 ${field}: fixture contains #${expectedId}`
    );
    if (el === null) continue;

    // Step 2: the full selector list covers this element via its Field-* ID token
    let matched = false;
    try {
      matched = el.matches(selectorList);
    } catch (syntaxErr) {
      assert(false, `F2 ${field}: querySelector threw — malformed selector: ${syntaxErr.message}`);
      continue;
    }
    assert(
      matched,
      `F2 ${field}: getSelectors().${field} covers #${expectedId} via ID token (removing the token fails this test)`
    );
  }
}

// ── F3: selector strings are syntactically valid (no malformed tokens) ──────
console.log("\nF3. All Stripe selector strings are syntactically valid CSS\n");

// Use an empty jsdom document purely as a CSS parser — if querySelector()
// throws a SyntaxError the selector is malformed and can't be used at runtime.
const emptyDoc = new JSDOM("<html><body></body></html>").window.document;

for (const key of Object.keys(STRIPE_SEL)) {
  const sel = STRIPE_SEL[key];
  if (!sel) continue;
  let threw = false;
  try {
    emptyDoc.querySelector(sel);
  } catch (syntaxErr) {
    threw = true;
    assert(false, `F3 selectors.${key}: malformed CSS — ${syntaxErr.message}`);
  }
  if (!threw) {
    assert(true, `F3 selectors.${key}: syntactically valid CSS selector`);
  }
}

// ── F4: core card-data fields have at least one ID-based token ───────────────
console.log("\nF4. Core card-data fields have at least one ID-based token (not class-only)\n");

// Class names like .CardNumberField can be renamed by Stripe's bundler without
// bumping element IDs.  The selector for each core field must include at least
// one [id=...] or [name=...] token so there is a stable, non-class anchor.
const ID_OR_NAME_RE = /\[(?:id|name)=/;
const CORE_FIELDS = ["cardNumber", "expiry", "cvv"];
for (const field of CORE_FIELDS) {
  assert(
    ID_OR_NAME_RE.test(STRIPE_SEL[field] || ""),
    `F4 selectors.${field}: contains at least one [id=...] or [name=...] anchor token`
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//
// G.  jsdom snapshot — Adyen & Checkout.com selectors vs gateway frame HTML
//
// Each gateway's card fields live in cross-origin iframes at runtime.  The same
// rename-detection gap that existed for Stripe (fixed in Part F) exists here:
// a bundler-rename of data-fieldtype="encryptedCardNumber" on Adyen, or of
// name="card-number" on Checkout.com, would break fills silently without tests.
//
// Two committed HTML fixtures:
//   content/fixtures/adyen-frame.html    — encryptedCardNumber/ExpiryDate/
//                                          SecurityCode data-fieldtype attrs
//   content/fixtures/checkout-frame.html — card-number/card-expiry-date/
//                                          card-cvv/cardholder-name name attrs
//
// Fixture elements carry ONLY their PRIMARY anchor attribute (no id, no class,
// no type) so that element.matches(selectorList) can pass ONLY via that anchor.
// A rename of the primary token fails the test immediately instead of silently
// passing via a fallback class or autocomplete attribute.
//
// Test pattern (same as F1/F2):
//   1. doc.querySelector(primaryAnchorSelector) — fixture must contain element
//   2. el.matches(fullSelectorList)             — getSelectors() must cover it
//
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\n=== G. jsdom snapshot — Adyen & Checkout.com selectors vs gateway frame HTML ===\n");

// ─── Extractor (parameterised variant of extractStripeSelectors) ──────────────
//
// Finds the `return { selectors: { ... } }` object that immediately follows a
// given unique domain-string marker in server-client.js, strips JS single-line
// comments so eval() doesn't choke on annotated blocks, and returns the
// `.selectors` sub-object.

function extractSelectorsAfterMarker(src, domainMarker) {
  const markerIdx = src.indexOf(domainMarker);
  if (markerIdx === -1) throw new Error(
    "Domain marker not found in server-client.js: " + JSON.stringify(domainMarker)
  );
  const returnIdx = src.indexOf("return {", markerIdx);
  if (returnIdx === -1) throw new Error(
    "return { not found after domain marker: " + JSON.stringify(domainMarker)
  );
  // Walk the braces to find the full return-object literal.
  const openBrace = src.indexOf("{", returnIdx);
  let depth = 0, i = openBrace;
  while (i < src.length) {
    if      (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) { i++; break; } }
    i++;
  }
  // Strip // comments before eval (some gateway blocks are annotated).
  const raw = src.slice(openBrace, i).replace(/\/\/[^\n]*/g, "");
  // eslint-disable-next-line no-new-func
  const obj = (new Function("return " + raw))();
  if (!obj || !obj.selectors) throw new Error(
    "Extracted object has no .selectors after marker: " + JSON.stringify(domainMarker)
  );
  return obj.selectors;
}

const ADYEN_FIXTURE_PATH    = path.join(FIXTURE_DIR, "adyen-frame.html");
const CHECKOUT_FIXTURE_PATH = path.join(FIXTURE_DIR, "checkout-frame.html");

// Unique sub-strings that appear inside each domain-array — before the
// `return { selectors: { ... } }` of the respective gateway block.
const ADYEN_SEL    = extractSelectorsAfterMarker(SC_SRC, '"checkoutshopper-live.adyen.com"');
const CHECKOUT_SEL = extractSelectorsAfterMarker(SC_SRC, '"card-acquisition-gateway.checkout.com"');

// ── G1: Adyen frame ──────────────────────────────────────────────────────────
console.log("G1. Adyen frame — doc.querySelector(primary anchor) + el.matches(fullSelector)\n");

assert(
  fs.existsSync(ADYEN_FIXTURE_PATH),
  "adyen-frame.html fixture exists at content/fixtures/"
);

{
  const adyenHTML = fs.readFileSync(ADYEN_FIXTURE_PATH, "utf8");
  const adyenDoc  = new JSDOM(adyenHTML).window.document;

  // [ selectorKey, primaryAnchorCSS, humanDescription ]
  // Primary anchors are the ONLY attrs on fixture elements — matches() can
  // succeed ONLY via these tokens, never via a class/autocomplete fallback.
  const ADYEN_FIELDS = [
    ["cardNumber", 'input[data-fieldtype="encryptedCardNumber"]',   'data-fieldtype="encryptedCardNumber"'],
    ["expiry",     'input[data-fieldtype="encryptedExpiryDate"]',   'data-fieldtype="encryptedExpiryDate"'],
    ["cvv",        'input[data-fieldtype="encryptedSecurityCode"]', 'data-fieldtype="encryptedSecurityCode"'],
    ["name",       'input[name="holderName"]',                      'name="holderName"'],
  ];

  for (const [field, primaryCSS, desc] of ADYEN_FIELDS) {
    const selectorList = ADYEN_SEL[field];
    if (!selectorList) {
      assert(false, `G1 ${field}: selector key missing from getSelectors('adyen.com')`);
      continue;
    }

    // Step 1: the fixture must contain the element (update fixture if Adyen renames it).
    const el = adyenDoc.querySelector(primaryCSS);
    assert(
      el !== null,
      `G1 ${field}: fixture contains ${desc}`
    );
    if (el === null) continue;

    // Step 2: the full comma-separated selector covers this element.
    // Because the fixture element has only its primary anchor attr, this can
    // only pass via the matching token — any other token won't select it.
    let matched = false;
    try {
      matched = el.matches(selectorList);
    } catch (syntaxErr) {
      assert(false, `G1 ${field}: el.matches() threw — malformed selector: ${syntaxErr.message}`);
      continue;
    }
    assert(
      matched,
      `G1 ${field}: getSelectors('adyen.com').${field} covers ${desc} (removing that token breaks this test)`
    );
  }
}

// ── G2: Checkout.com frame ───────────────────────────────────────────────────
console.log("\nG2. Checkout.com frame — doc.querySelector(primary anchor) + el.matches(fullSelector)\n");

assert(
  fs.existsSync(CHECKOUT_FIXTURE_PATH),
  "checkout-frame.html fixture exists at content/fixtures/"
);

{
  const coHTML = fs.readFileSync(CHECKOUT_FIXTURE_PATH, "utf8");
  const coDoc  = new JSDOM(coHTML).window.document;

  // [ selectorKey, primaryAnchorCSS, humanDescription ]
  const CHECKOUT_FIELDS = [
    ["cardNumber", 'input[name="card-number"]',      'name="card-number"'],
    ["expiry",     'input[name="card-expiry-date"]', 'name="card-expiry-date"'],
    ["cvv",        'input[name="card-cvv"]',         'name="card-cvv"'],
    ["name",       'input[name="cardholder-name"]',  'name="cardholder-name"'],
  ];

  for (const [field, primaryCSS, desc] of CHECKOUT_FIELDS) {
    const selectorList = CHECKOUT_SEL[field];
    if (!selectorList) {
      assert(false, `G2 ${field}: selector key missing from getSelectors('checkout.com')`);
      continue;
    }

    // Step 1: fixture must contain the element.
    const el = coDoc.querySelector(primaryCSS);
    assert(
      el !== null,
      `G2 ${field}: fixture contains ${desc}`
    );
    if (el === null) continue;

    // Step 2: full selector covers the fixture element via its name token.
    let matched = false;
    try {
      matched = el.matches(selectorList);
    } catch (syntaxErr) {
      assert(false, `G2 ${field}: el.matches() threw — malformed selector: ${syntaxErr.message}`);
      continue;
    }
    assert(
      matched,
      `G2 ${field}: getSelectors('checkout.com').${field} covers ${desc} (removing that token breaks this test)`
    );
  }
}

// ── G3: All Adyen + Checkout.com selector strings are syntactically valid ─────
console.log("\nG3. Adyen & Checkout.com selector strings are syntactically valid CSS\n");

for (const [gwLabel, gwSel] of [["adyen.com", ADYEN_SEL], ["checkout.com", CHECKOUT_SEL]]) {
  for (const key of Object.keys(gwSel)) {
    const sel = gwSel[key];
    if (!sel) continue;
    let threw = false;
    try {
      emptyDoc.querySelector(sel);
    } catch (syntaxErr) {
      threw = true;
      assert(false, `G3 ${gwLabel} selectors.${key}: malformed CSS — ${syntaxErr.message}`);
    }
    if (!threw) {
      assert(true, `G3 ${gwLabel} selectors.${key}: syntactically valid CSS`);
    }
  }
}

// ── G4: Core card-data fields use a stable non-class anchor ──────────────────
console.log("\nG4. Core card-data fields use a stable non-class anchor\n");
//
// For Adyen the stable anchor is [data-fieldtype=...].
// For Checkout.com the stable anchor is [name=...] or [id=...].
// A class-only selector (e.g. .CardNumberField) can be renamed by a bundler
// without bumping a data attribute or element name.

const DATA_ATTR_OR_NAME_OR_ID_RE = /\[(?:data-[a-z-]+|name|id)=/;
const G4_CORE = ["cardNumber", "expiry", "cvv"];

for (const field of G4_CORE) {
  assert(
    DATA_ATTR_OR_NAME_OR_ID_RE.test(ADYEN_SEL[field] || ""),
    `G4 adyen.com selectors.${field}: has a stable [data-...] / [name=] / [id=] anchor (not class-only)`
  );
  assert(
    DATA_ATTR_OR_NAME_OR_ID_RE.test(CHECKOUT_SEL[field] || ""),
    `G4 checkout.com selectors.${field}: has a stable [name=] / [id=] anchor (not class-only)`
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//
// H.  jsdom snapshot — Xsolla & Recurly selectors vs gateway frame HTML
//
// Two other gateways with their own selector blocks in getSelectors() have no
// fixture or snapshot tests.  A rename of `name="card_number"` on Xsolla, or
// `data-recurly="number"` on Recurly, would silently break fills with no test
// failure.
//
// Two committed HTML fixtures:
//   content/fixtures/xsolla-frame.html  — card_number/card_month/card_year/
//                                         cvv/zip name attrs + unit-v2-email-input id
//   content/fixtures/recurly-frame.html — data-recurly="number|month|year|cvv|
//                                         first_name" attrs
//
// Fixture elements carry ONLY their PRIMARY anchor attribute so that
// element.matches(selectorList) can succeed ONLY via that anchor.
// A rename of the primary token fails the test immediately instead of silently
// passing via a class or autocomplete fallback.
//
// Test pattern (same as G1/G2):
//   1. doc.querySelector(primaryAnchorSelector) — fixture must contain element
//   2. el.matches(fullSelectorList)             — getSelectors() must cover it
//
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\n=== H. jsdom snapshot — Xsolla & Recurly selectors vs gateway frame HTML ===\n");

const XSOLLA_FIXTURE_PATH  = path.join(FIXTURE_DIR, "xsolla-frame.html");
const RECURLY_FIXTURE_PATH = path.join(FIXTURE_DIR, "recurly-frame.html");

// Re-use extractSelectorsAfterMarker defined in Part G.
const XSOLLA_SEL  = extractSelectorsAfterMarker(SC_SRC, '"secure.xsolla.com"');
const RECURLY_SEL = extractSelectorsAfterMarker(SC_SRC, '"js.recurly.com"');

// ── H1: Xsolla frame ─────────────────────────────────────────────────────────
console.log("H1. Xsolla frame — doc.querySelector(primary anchor) + el.matches(fullSelector)\n");

assert(
  fs.existsSync(XSOLLA_FIXTURE_PATH),
  "xsolla-frame.html fixture exists at content/fixtures/"
);

{
  const xsHTML = fs.readFileSync(XSOLLA_FIXTURE_PATH, "utf8");
  const xsDoc  = new JSDOM(xsHTML).window.document;

  // [ selectorKey, primaryAnchorCSS, humanDescription ]
  // Fixture elements have ONLY their primary anchor attr — matches() passes
  // only via that token; removing/renaming it breaks this test immediately.
  const XSOLLA_FIELDS = [
    ["cardNumber", 'input[name="card_number"]',   'name="card_number"'],
    ["expMonth",   'input[name="card_month"]',    'name="card_month"'],
    ["expYear",    'input[name="card_year"]',     'name="card_year"'],
    ["cvv",        'input[name="cvv"]',           'name="cvv"'],
    ["zip",        'input[name="zip"]',           'name="zip"'],
    ["email",      '#unit-v2-email-input',        'id="unit-v2-email-input"'],
  ];

  for (const [field, primaryCSS, desc] of XSOLLA_FIELDS) {
    const selectorList = XSOLLA_SEL[field];
    if (!selectorList) {
      assert(false, `H1 ${field}: selector key missing from getSelectors('xsolla.com')`);
      continue;
    }

    // Step 1: element must exist in fixture (update fixture if Xsolla renames it).
    const el = xsDoc.querySelector(primaryCSS);
    assert(
      el !== null,
      `H1 ${field}: fixture contains ${desc}`
    );
    if (el === null) continue;

    // Step 2: full selector covers the fixture element via its primary anchor.
    // Because the fixture element has only its primary anchor attr, this can
    // only pass via the matching token in the selector list.
    let matched = false;
    try {
      matched = el.matches(selectorList);
    } catch (syntaxErr) {
      assert(false, `H1 ${field}: el.matches() threw — malformed selector: ${syntaxErr.message}`);
      continue;
    }
    assert(
      matched,
      `H1 ${field}: getSelectors('xsolla.com').${field} covers ${desc} (removing that token breaks this test)`
    );
  }
}

// ── H2: Recurly frame ────────────────────────────────────────────────────────
console.log("\nH2. Recurly frame — doc.querySelector(primary anchor) + el.matches(fullSelector)\n");

assert(
  fs.existsSync(RECURLY_FIXTURE_PATH),
  "recurly-frame.html fixture exists at content/fixtures/"
);

{
  const rcHTML = fs.readFileSync(RECURLY_FIXTURE_PATH, "utf8");
  const rcDoc  = new JSDOM(rcHTML).window.document;

  // [ selectorKey, primaryAnchorCSS, humanDescription ]
  const RECURLY_FIELDS = [
    ["cardNumber", 'input[data-recurly="number"]',     'data-recurly="number"'],
    ["expMonth",   'input[data-recurly="month"]',      'data-recurly="month"'],
    ["expYear",    'input[data-recurly="year"]',       'data-recurly="year"'],
    ["cvv",        'input[data-recurly="cvv"]',        'data-recurly="cvv"'],
    ["name",       'input[data-recurly="first_name"]', 'data-recurly="first_name"'],
  ];

  for (const [field, primaryCSS, desc] of RECURLY_FIELDS) {
    const selectorList = RECURLY_SEL[field];
    if (!selectorList) {
      assert(false, `H2 ${field}: selector key missing from getSelectors('js.recurly.com')`);
      continue;
    }

    // Step 1: element must exist in fixture.
    const el = rcDoc.querySelector(primaryCSS);
    assert(
      el !== null,
      `H2 ${field}: fixture contains ${desc}`
    );
    if (el === null) continue;

    // Step 2: full selector covers the fixture element via its data-recurly token.
    let matched = false;
    try {
      matched = el.matches(selectorList);
    } catch (syntaxErr) {
      assert(false, `H2 ${field}: el.matches() threw — malformed selector: ${syntaxErr.message}`);
      continue;
    }
    assert(
      matched,
      `H2 ${field}: getSelectors('js.recurly.com').${field} covers ${desc} (removing that token breaks this test)`
    );
  }
}

// ── H5: Recurly fill-sequence regression — expMonth AND expYear both filled ───
//
// Before the fix, RECURLY_SEL included an `expiry` key mapped to the month
// input.  The fill pipeline set values.expiry = "MM/YY" and filled ONLY the
// month input with that combined string, leaving the year input blank.
// Validation checked only selectors.expiry (the month input, which had a
// value), returned ok:true, and the blank year field went undetected.
//
// After the fix:
//   • RECURLY_SEL has NO `expiry` key (combined string must not land in month)
//   • RECURLY_SEL has separate `expMonth` and `expYear` keys
//   • The values object includes expMonth and expYear
//   • Validation requires both elements to be non-empty
//
// This test simulates the fill dispatch and the subsequent validation using
// the real Recurly fixture HTML so any selector rename breaks it immediately.
console.log("\nH5. Recurly fill-sequence regression — expMonth AND expYear both get a value\n");

{
  const rcHtml5 = fs.readFileSync(RECURLY_FIXTURE_PATH, "utf8");
  const rcDoc5  = new JSDOM(rcHtml5).window.document;

  // ── Guard: RECURLY_SEL must NOT contain an `expiry` key ───────────────────
  assert(
    !("expiry" in RECURLY_SEL),
    "H5 RECURLY_SEL has no `expiry` key — combined MM/YY must not map to the month input"
  );

  // ── Guard: RECURLY_SEL must contain both expMonth and expYear ─────────────
  assert(
    typeof RECURLY_SEL.expMonth === "string" && RECURLY_SEL.expMonth.length > 0,
    "H5 RECURLY_SEL.expMonth is a non-empty string"
  );
  assert(
    typeof RECURLY_SEL.expYear === "string" && RECURLY_SEL.expYear.length > 0,
    "H5 RECURLY_SEL.expYear is a non-empty string"
  );

  // ── Simulate fill-value dispatch ───────────────────────────────────────────
  // Mirror the values object that fillFormFromOverlay now builds for a card
  // with separate expiry support.
  const mockValues = {
    cardNumber: "4111111111111111",
    expMonth:   "08",
    expYear:    "28",
    cvv:        "321",
    name:       "Test User"
  };

  // Iterate selector keys and "fill" each matching element, exactly as
  // executeFillSequence does (values[key] must be truthy for a fill to happen).
  const SKIP_KEYS = new Set(["country","state","cardRadio","cardHeader","cardContainer","stripePass","terms","email"]);
  for (const key of Object.keys(RECURLY_SEL)) {
    if (SKIP_KEYS.has(key)) continue;
    const sel = RECURLY_SEL[key];
    const val = mockValues[key];
    if (!sel || !val) continue;
    let el;
    try { el = rcDoc5.querySelector(sel); } catch (_) {}
    if (el) el.value = val;
  }

  // ── Assertion: all four core elements have a non-empty value ──────────────
  const verifyFilled = [
    ["cardNumber", 'input[data-recurly="number"]',  "card-number input"],
    ["expMonth",   'input[data-recurly="month"]',   "expiry-month input"],
    ["expYear",    'input[data-recurly="year"]',    "expiry-year input"],
    ["cvv",        'input[data-recurly="cvv"]',     "cvv input"],
  ];
  for (const [, primaryCSS, desc] of verifyFilled) {
    let el;
    try { el = rcDoc5.querySelector(primaryCSS); } catch (_) {}
    assert(
      el !== null && (el ? el.value || "" : "").trim().length > 0,
      `H5 ${desc} has a non-empty value after fill dispatch`
    );
  }

  // ── Regression: year must not be blank (the pre-fix failure mode) ─────────
  let yearEl;
  try { yearEl = rcDoc5.querySelector('input[data-recurly="year"]'); } catch (_) {}
  assert(
    yearEl !== null && (yearEl ? yearEl.value || "" : "").trim().length > 0,
    "H5 expiry-year input is NOT blank (would have been blank before separate-expiry fix)"
  );

  // ── Simulate post-fill validation logic (mirrors executeFillSequence) ─────
  // Separate-expiry gate: selectors.expiry absent → check expMonth + expYear.
  const _h5SeparateExpiry = !RECURLY_SEL.expiry && (RECURLY_SEL.expMonth || RECURLY_SEL.expYear);
  const _h5Required = [
    { key: "cardNumber" },
    ...(_h5SeparateExpiry
      ? [{ key: "expMonth" }, { key: "expYear" }]
      : [{ key: "expiry"   }]),
    { key: "cvv" },
  ];
  const _h5Missing = [];
  for (const { key } of _h5Required) {
    const sel = RECURLY_SEL[key];
    if (!sel) { _h5Missing.push(key); continue; }
    let el;
    try { el = rcDoc5.querySelector(sel); } catch (_) {}
    if (!el || !(el.value || "").trim()) _h5Missing.push(key);
  }
  assert(
    _h5Missing.length === 0,
    `H5 post-fill validation passes (no missing required fields) — missing: [${_h5Missing.join(",")}]`
  );
}

// ── H3: All Xsolla + Recurly selector strings are syntactically valid ─────────
console.log("\nH3. Xsolla & Recurly selector strings are syntactically valid CSS\n");

for (const [gwLabel, gwSel] of [["xsolla.com", XSOLLA_SEL], ["js.recurly.com", RECURLY_SEL]]) {
  for (const key of Object.keys(gwSel)) {
    const sel = gwSel[key];
    if (!sel) continue;
    let threw = false;
    try {
      emptyDoc.querySelector(sel);
    } catch (syntaxErr) {
      threw = true;
      assert(false, `H3 ${gwLabel} selectors.${key}: malformed CSS — ${syntaxErr.message}`);
    }
    if (!threw) {
      assert(true, `H3 ${gwLabel} selectors.${key}: syntactically valid CSS`);
    }
  }
}

// ── H4: Core card-data fields use a stable non-class anchor ───────────────────
console.log("\nH4. Core card-data fields use a stable non-class anchor\n");
//
// For Xsolla the stable anchor is [name=...] or [id=...].
// For Recurly the stable anchor is [data-recurly=...].
// A class-only selector (.CardNumberField) can be renamed by a bundler without
// touching data attributes or element names.

const H4_CORE = ["cardNumber", "cvv"];

for (const field of H4_CORE) {
  assert(
    DATA_ATTR_OR_NAME_OR_ID_RE.test(XSOLLA_SEL[field] || ""),
    `H4 xsolla.com selectors.${field}: has a stable [name=] / [id=] anchor (not class-only)`
  );
  assert(
    DATA_ATTR_OR_NAME_OR_ID_RE.test(RECURLY_SEL[field] || ""),
    `H4 js.recurly.com selectors.${field}: has a stable [data-recurly=] anchor (not class-only)`
  );
}

// Also check expiry fields — Xsolla uses expMonth/expYear, Recurly uses expMonth/expYear.
assert(
  DATA_ATTR_OR_NAME_OR_ID_RE.test(XSOLLA_SEL.expMonth || ""),
  "H4 xsolla.com selectors.expMonth: has a stable [name=] / [id=] anchor"
);
assert(
  DATA_ATTR_OR_NAME_OR_ID_RE.test(XSOLLA_SEL.expYear || ""),
  "H4 xsolla.com selectors.expYear: has a stable [name=] / [id=] anchor"
);
assert(
  DATA_ATTR_OR_NAME_OR_ID_RE.test(RECURLY_SEL.expMonth || ""),
  "H4 js.recurly.com selectors.expMonth: has a stable [data-recurly=] anchor"
);
assert(
  DATA_ATTR_OR_NAME_OR_ID_RE.test(RECURLY_SEL.expYear || ""),
  "H4 js.recurly.com selectors.expYear: has a stable [data-recurly=] anchor"
);

// ═══════════════════════════════════════════════════════════════════════════════
//
// I.  Embedded-checkout race — FILL_FORM_SUBFRAMES retry loop
//
// The embedded Stripe Payment Element iframe (js.stripe.com/v3/elements-inner-*)
// often loads AFTER FILL_FORM_SUBFRAMES is first dispatched at Start-click time.
// A single-shot delivery races the iframe mount and silently leaves the card
// fields empty when the frame isn't ready yet.
//
// The fix is a 12-attempt retry loop (~5 s window, 400 ms per gap) in the
// FILL_FORM_SUBFRAMES handler in background.js that:
//   1. Re-enumerates frames on each pass (catches late-mounting iframes).
//   2. Acks only when the card frame (elements-inner / embedded-checkout-inner)
//      explicitly reports fill success (not just any ack from a controller frame).
//   3. Sends SEMEX_FILL_FORM_SUBFRAMES_FAILED to the top frame when no delivery
//      occurs so the overlay exits its waiting state instead of hanging.
//
// Tests I1-I5: structural source-text checks that verify the code is present.
// Test I6: a real simulation that extracts the async retry body and runs it
//          with mocked chrome APIs — first getAllFrames returns only a non-card
//          frame (controller), second returns the card frame; verifies FILL_FORM
//          reaches the card frame on the second pass.
//
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\n=== I. Embedded-checkout race — FILL_FORM_SUBFRAMES retry loop ===\n");

// Extract the FILL_FORM_SUBFRAMES handler block so assertions are scoped to it.
function extractFillFormSubframesBlock(src) {
  const MARKER = 'if (_0x2d827f.type === "FILL_FORM_SUBFRAMES")';
  const start  = src.indexOf(MARKER);
  if (start === -1) throw new Error("FILL_FORM_SUBFRAMES handler not found in background.js");

  const openBrace = src.indexOf("{", start + MARKER.length);
  let depth = 0, i = openBrace;
  while (i < src.length) {
    if      (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) { i++; break; } }
    i++;
  }
  return src.slice(openBrace, i);
}

const SUBFRAMES_BLOCK = extractFillFormSubframesBlock(BG_SRC);

console.log("I1. 12-attempt retry loop is present (handles late-mounting iframes)");

// The loop guard `_sfTry < 12` puts a firm bound on attempts (~4.8 s total at 400 ms/gap).
assert(
  SUBFRAMES_BLOCK.includes("_sfTry < 12"),
  "I1: FILL_FORM_SUBFRAMES handler retries up to 12 times to catch late-mounting iframes"
);

console.log("\nI2. 400 ms inter-attempt sleep present (frames need time to initialise)");

assert(
  SUBFRAMES_BLOCK.includes("setTimeout(_r, 400)"),
  "I2: 400 ms sleep between retry attempts so a loading iframe has time to initialise"
);

console.log("\nI3. Card-frame ack gated on fill success (not any ack)");

// The old code stopped retrying as soon as ANY js.stripe.com frame acked.
// Controller / Link frames ack without filling any card fields — the retry
// must continue until the elements-inner / embedded-checkout-inner frame acks
// with success !== false.
assert(
  SUBFRAMES_BLOCK.includes("_sfCardFrameAcked"),
  "I3: _sfCardFrameAcked flag is only set for the actual card frame (not controller frames)"
);
assert(
  SUBFRAMES_BLOCK.includes("/elements-inner|embedded-checkout-inner|hosted-elements/"),
  "I3: ack guard matches elements-inner, embedded-checkout-inner AND basistheory hosted-elements (Whop) URLs"
);
assert(
  SUBFRAMES_BLOCK.includes("_sfAck.success !== false"),
  "I3: card frame ack is gated on success !== false (explicit fill success, not just delivery)"
);

console.log("\nI4. Re-enumerates frames on every pass (catches post-dispatch late mounts)");

// getAllFrames must be called INSIDE the retry loop — not just once before it.
// Calling it once before the loop misses iframes that mount during the retry window.
const loopStart = SUBFRAMES_BLOCK.indexOf("_sfTry < 12");
const loopBody  = SUBFRAMES_BLOCK.slice(loopStart);
assert(
  loopBody.includes("_sfGetFrames()"),
  "I4: getAllFrames() called inside the retry loop — not once before it — to catch late iframe mounts"
);

console.log("\nI5. SEMEX_FILL_FORM_SUBFRAMES_FAILED sent when no frame was reached");

// If _sfDelivered is still false after all retries, the top frame is notified
// so the overlay can exit its waiting state instead of hanging indefinitely.
assert(
  SUBFRAMES_BLOCK.includes("SEMEX_FILL_FORM_SUBFRAMES_FAILED"),
  "I5: SEMEX_FILL_FORM_SUBFRAMES_FAILED is sent when delivery fails so overlay exits waiting state"
);
assert(
  SUBFRAMES_BLOCK.includes("!_sfDelivered"),
  "I5: fail notification is gated on !_sfDelivered (only sent when truly unreachable)"
);

// ── I6: Simulation — late-mounting card frame reached on second pass ──────────
//
// Extracts the async retry IIFE body from the FILL_FORM_SUBFRAMES handler and
// runs it with mocked chrome APIs under Node.js so we can verify the actual
// retry behavior without a live browser:
//   - First getAllFrames() call: only a non-card controller frame (card not loaded yet)
//   - Second getAllFrames() call: card frame appears (elements-inner URL)
//   - sendMessage() always returns { success: true }
//   Expected: sendMessage is called for the card frame; _sfFail is NOT called.
//
// NOTE: The simulation uses async/await, so it must run inside an async function.
// All synchronous assertions (I1-I5) above have already updated passed/failed.
// main() runs I6, prints the summary, and exits with the correct code.

// ─── IIFE body extractor (used by main) ──────────────────────────────────────

function extractAsyncIIFEBody(block) {
  const MARKER = "(async () => {";
  const start  = block.indexOf(MARKER);
  if (start === -1) throw new Error("Async IIFE not found in FILL_FORM_SUBFRAMES block");
  const bodyStart = block.indexOf("{", start) + 1;
  let depth = 1, i = bodyStart;
  while (i < block.length && depth > 0) {
    if      (block[i] === "{") depth++;
    else if (block[i] === "}") depth--;
    i++;
  }
  return block.slice(bodyStart, i - 1);
}

// ─── Async entry point (I6 + summary) ────────────────────────────────────────
// Wrapped so top-level await never appears in this CJS file (top-level await
// causes Node.js to treat the file as ESM, which breaks require()).

async function main() {

  console.log("\nI6. Simulation — late-mounting card frame reached on second getAllFrames pass\n");

  {
    const asyncBody = extractAsyncIIFEBody(SUBFRAMES_BLOCK);

    // Wrap the async IIFE body in a callable function.  The parameter names shadow
    // the closed-over names from the original handler so mocks are injected cleanly.
    // setTimeout is shadowed so the per-attempt 400 ms sleep executes synchronously.
    // eslint-disable-next-line no-new-func
    const runSubframesSimulation = new Function(
      "chrome", "_sfTabId", "_sfPayload", "_sfFail", "setTimeout",
      "return (async () => {" + asyncBody + "})();"
    );

    const getAllFramesCalls = [];
    const sendMessageCalls = [];
    let failCalled = false;

    const mockChrome = {
      webNavigation: {
        getAllFrames: (opts, cb) => {
          const n = getAllFramesCalls.length;
          getAllFramesCalls.push(n);
          if (n === 0) {
            // First pass: only the non-card controller frame is visible (card iframe loading)
            cb([{ frameId: 1, url: "https://js.stripe.com/v3/controller/index.html" }]);
          } else {
            // Second pass: card iframe has mounted
            cb([
              { frameId: 1, url: "https://js.stripe.com/v3/controller/index.html" },
              { frameId: 2, url: "https://js.stripe.com/v3/elements-inner-habanero/index.html" }
            ]);
          }
        }
      },
      tabs: {
        sendMessage: (tabId, msg, opts, cb) => {
          sendMessageCalls.push({ tabId, frameId: opts && opts.frameId });
          if (cb) cb({ success: true });
        }
      },
      runtime: { lastError: null }
    };

    const _sfFail = () => { failCalled = true; };
    // Stub setTimeout to call fn() synchronously — removes the 400 ms delay so
    // the simulation completes instantly without real timer pauses.
    const syncSetTimeout = (fn) => { fn(); return 0; };

    await runSubframesSimulation(
      mockChrome,
      42,               // _sfTabId — arbitrary fake tab ID
      { card: "4242" }, // _sfPayload
      _sfFail,
      syncSetTimeout
    );

    assert(
      getAllFramesCalls.length >= 2,
      "I6: getAllFrames called ≥2 times — retry loop re-enumerates on each pass, catching late mounts"
    );
    assert(
      sendMessageCalls.some(c => c.frameId === 2),
      "I6: FILL_FORM sent to card frame (frameId 2, elements-inner URL) after it appeared on second pass"
    );
    assert(
      !failCalled,
      "I6: _sfFail NOT called — card frame was successfully reached, not treated as permanently unreachable"
    );
  }

  // ─── Summary ────────────────────────────────────────────────────────────────

  console.log(`\n${"═".repeat(45)}`);
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log("═".repeat(45) + "\n");

  if (failed > 0) process.exit(1);

} // end main()

main().catch(err => { console.error("Unexpected error:", err); process.exit(1); });
