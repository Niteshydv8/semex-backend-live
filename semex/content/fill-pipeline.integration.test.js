/**
 * fill-pipeline.integration.test.js
 *
 * Integration test for the SEMEX Stripe fill pipeline.
 *
 * Extracts executeFillSequence, fill, setFormValue, sleep, waitForElement, and
 * related helpers DIRECTLY from the production semex/content/content.js source
 * and runs them in a vm sandbox against representative fake Stripe DOMs.
 *
 * Mock elements are created INSIDE the vm context (same JS realm) to avoid
 * cross-realm "is not a function" errors — the same pattern used in
 * stripe-overlay-trigger.test.js.
 *
 * Test suites:
 *   A. Classic Stripe checkout  (name/id/autocomplete attribute selectors)
 *   B. New Stripe UI (habanero) (payment-*Input element IDs)
 *   C. Stripe hosted-fields     (Field-*Input element IDs)
 *   D. Legacy Stripe Elements   (input.InputElement class selector)
 *   E. fill() idempotency       (no events when value already matches)
 *   F. fill() graceful no-op    (missing fields don't throw)
 *
 * Fields verified: cardNumber, expiry, CVV, name, address, address2,
 *                  city, zip, country (SELECT), email.
 *
 * Run:  node semex/content/fill-pipeline.integration.test.js
 */

"use strict";

const fs   = require("fs");
const path = require("path");
const vm   = require("vm");

// ─── Source paths ─────────────────────────────────────────────────────────────

const CONTENT_JS = path.join(__dirname, "content.js");
const SC_JS      = path.join(__dirname, "../shared/server-client.js");

for (const f of [CONTENT_JS, SC_JS]) {
  if (!fs.existsSync(f)) throw new Error("Source not found: " + f);
}

const CT_SRC = fs.readFileSync(CONTENT_JS, "utf8");
const SC_SRC = fs.readFileSync(SC_JS,      "utf8");

// ─── Extract source ranges from content.js ────────────────────────────────────

function extractLines(src, start, end) {
  return src.split("\n").slice(start - 1, end).join("\n");
}

// Lines 1-5: __defProp / __name preamble
const PREAMBLE = extractLines(CT_SRC, 1, 5);

// Use function-boundary extraction so the block stays valid when lines shift.
// Anchors: from "async function executeFillSequence(" to the __name sentinel
// for waitForElement, which is the last helper we need.
(function buildFillBlock() {
  const START_MARKER = "async function executeFillSequence(";
  const END_MARKER   = '__name(waitForElement, "waitForElement")';

  const startIdx = CT_SRC.indexOf(START_MARKER);
  const endIdx   = CT_SRC.indexOf(END_MARKER);

  if (startIdx === -1) throw new Error("async function executeFillSequence not found in content.js");
  if (endIdx   === -1) throw new Error('__name(waitForElement, "waitForElement") not found in content.js');

  // Include the full END_MARKER text in the extracted block
  global.FILL_BLOCK = CT_SRC.slice(startIdx, endIdx + END_MARKER.length + 2);
})();

// Sanity-check that the key functions are present in the extracted block
const REQUIRED_FUNS = [
  "async function executeFillSequence",
  "const sleep =",
  "const fill =",
  "async function setFormValue",
  "function waitForElement",
];
for (const fn of REQUIRED_FUNS) {
  if (!FILL_BLOCK.includes(fn))
    throw new Error(fn + " not found in extracted block");
}

// ─── Extract Stripe selectors from server-client.js ───────────────────────────

function extractStripeSelectors(src) {
  const MARKER = "if (domain.includes('stripe')) return {";
  const start  = src.indexOf(MARKER);
  if (start === -1) throw new Error("Stripe selector block not found in server-client.js");
  const openBrace = src.indexOf("{", start + MARKER.length - 1);
  let depth = 0, i = openBrace;
  while (i < src.length) {
    if      (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) { i++; break; } }
    i++;
  }
  // eslint-disable-next-line no-new-func
  return (new Function("return " + src.slice(openBrace, i)))().selectors;
}

const STRIPE_SEL = extractStripeSelectors(SC_SRC);

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

// ─── Fill values used across all suites ──────────────────────────────────────

const FILL_VALUES = {
  cardNumber: "4242424242424242",
  expiry:     "12/26",
  cvv:        "123",
  name:       "John Doe",
  address:    "123 Main St",
  address2:   "Apt 4",
  city:       "New York",
  zip:        "10001",
  country:    "US",
  email:      "test@example.com",
  phone:      "5555555555",
};

// ─── vm harness ───────────────────────────────────────────────────────────────
//
// elementSpecs: array of plain-object descriptions of the fake DOM elements
//   (JSON-serializable so they can be injected into the vm via JSON.stringify).
//   Shape: { tagName: "INPUT"|"SELECT", id?, name?, autocomplete?, className?,
//            type?, value?, _options?: [{value,text}] }
//
// selectors: the Stripe selectors object from getSelectors()
// values:    the fill-values object
//
// Returns: array of the vm-created mock elements (inspectable from outer scope).

async function runFillSequence(elementSpecs, selectors, values) {
  // Build a minimal vm context — only globals the fill helpers actually need
  const ctx = vm.createContext({
    Object,
    Array,
    String,
    Math,
    Promise,
    Set,
    // The vm code creates Event instances; we provide a simple class
    Event: class Event {
      constructor(type, opts) {
        this.type = type;
        if (opts) Object.assign(this, opts);
      }
    },
    // sleep() uses setTimeout; stub it to call the callback immediately so
    // the test doesn't actually wait (all sleep values are tiny anyway)
    setTimeout:   (fn) => { fn(); return 0; },
    clearTimeout: () => {},
    // waitForElement() polls on a light interval for late shadow-DOM mounts;
    // stub it to probe once immediately (mirrors the setTimeout stub).
    setInterval:  (fn) => { try { fn(); } catch (_) {} return 0; },
    clearInterval: () => {},
    // chrome extension stubs
    chrome: {
      runtime: {
        sendMessage: () => {},
        lastError:   null,
      },
    },
    // injected data
    __elementSpecs__: elementSpecs,
    __selectors__:    JSON.parse(JSON.stringify(selectors)),
    __values__:       JSON.parse(JSON.stringify(values)),
    // result capture
    __elements__: null,
    __result__:   null,
  });

  // ── Inner-vm script ─────────────────────────────────────────────────────────
  // Everything here runs in the vm's own realm, so functions on mock elements
  // are callable from the fill helpers without cross-realm issues.

  const INNER = `
// ─── preamble (from content.js lines 1-5) ───────────────────────────────────
${PREAMBLE}

// ─── stubs that executeFillSequence / helpers reference ──────────────────────
var IS_MAIN_FRAME  = true;
var _logHistory    = new Set();
function logOnce() {}

// ─── lightweight CSS token matcher (inside vm) ───────────────────────────────
function __tokenMatchesEl(token, el) {
  var t = token.trim();
  var tagM = t.match(/^([a-zA-Z][a-zA-Z0-9-]*)/);
  var reqTag = tagM ? tagM[1].toLowerCase() : null;
  if (reqTag && el.tagName.toLowerCase() !== reqTag) return false;

  var classMatches = t.match(/\\.([a-zA-Z_\\-][a-zA-Z0-9_\\-]*)/g) || [];
  var elCls = (el.className || "").split(/\\s+/);
  for (var ci = 0; ci < classMatches.length; ci++) {
    if (elCls.indexOf(classMatches[ci].slice(1)) === -1) return false;
  }

  var attrRe = /\\[([a-zA-Z\\-]+)=["']?([^"'\\]]+)["']?\\]/g;
  var attrM;
  while ((attrM = attrRe.exec(t)) !== null) {
    var attr = attrM[1], val = attrM[2];
    if (attr === "id"           && el.id           !== val) return false;
    if (attr === "name"         && el.name         !== val) return false;
    if (attr === "autocomplete" && el.autocomplete !== val) return false;
    if (attr === "type"         && el.type         !== val) return false;
  }
  return true;
}

// ─── mock element factory (inside vm so all methods are same-realm) ──────────
function __makeEl(spec) {
  var events = [];
  if (spec.tagName === "SELECT") {
    return {
      tagName:      "SELECT",
      value:        spec.value || "",
      id:           spec.id    || "",
      name:         spec.name  || "",
      className:    spec.className || "",
      // setFormValue calls focus() before the tagName === "SELECT" branch
      focus:        function() {},
      blur:         function() {},
      setAttribute: function() {},
      getAttribute: function() { return null; },
      options:      (spec._options || []).map(function(o) {
        return { value: o.value, text: o.text, disabled: false };
      }),
      dispatchEvent: function(ev) { events.push(ev.type); },
      _events: events,
    };
  }
  return {
    tagName:      "INPUT",
    value:        spec.value        || "",
    placeholder:  spec.placeholder  || "",
    type:         spec.type         || "text",
    id:           spec.id           || "",
    name:         spec.name         || "",
    autocomplete: spec.autocomplete || "",
    className:    spec.className    || "",
    focus:        function() {},
    blur:         function() {},
    setAttribute: function() {},
    getAttribute: function() { return null; },
    dispatchEvent: function(ev) { events.push(ev.type); },
    _events: events,
  };
}

// Build the mock elements
var __elements = __elementSpecs__.map(__makeEl);
__elements__ = __elements; // expose to outer scope for assertions

// ─── document stub (inside vm — uses __elements for querySelector) ───────────
var document = {
  querySelector: function(sel) {
    if (!sel) return null;
    var tokens = sel.split(",");
    for (var i = 0; i < __elements.length; i++) {
      for (var j = 0; j < tokens.length; j++) {
        if (__tokenMatchesEl(tokens[j], __elements[i])) return __elements[i];
      }
    }
    return null;
  },
  querySelectorAll: function(sel) {
    var result = [];
    if (!sel) return result;
    var tokens = sel.split(",");
    for (var i = 0; i < __elements.length; i++) {
      for (var j = 0; j < tokens.length; j++) {
        if (__tokenMatchesEl(tokens[j], __elements[i])) {
          result.push(__elements[i]);
          break;
        }
      }
    }
    return result;
  },
  getElementById: function() { return null; },
  body: { observe: function() {} },
};

// ─── window stub ─────────────────────────────────────────────────────────────
var window = {
  HTMLInputElement:    { prototype: {} },
  HTMLTextAreaElement: { prototype: {} },
  postMessage:         function() {},
  location:            { href: "https://checkout.stripe.com/c/pay/test" },
};
window.top  = window;
window.self = window;

// ─── MutationObserver stub ───────────────────────────────────────────────────
function MutationObserver(cb) {}
MutationObserver.prototype.observe     = function() {};
MutationObserver.prototype.disconnect  = function() {};

// ─── fill block (from content.js lines 2640-3034) ────────────────────────────
${FILL_BLOCK}

// ─── invoke executeFillSequence ───────────────────────────────────────────────
__result__ = executeFillSequence(__selectors__, __values__);
`;

  new vm.Script(INNER).runInContext(ctx);

  // ctx.__result__ is the Promise returned by the async function
  await ctx.__result__;

  // Return the vm-realm elements array — their .value and ._events are
  // accessible from the outer scope (reading cross-realm properties is fine).
  return Array.from(ctx.__elements__);
}

// Like runFillSequence, but ALSO returns the resolved value of executeFillSequence
// (i.e. the {ok, error} result object) so callers can assert on it.
// Additionally captures all postMessage calls so callers can assert on
// what SEMEX_FILL_FORM_COMPLETE messages were posted.
async function runFillSequenceWithResult(elementSpecs, selectors, values) {
  const ctx = vm.createContext({
    Object, Array, String, Math, Promise, Set,
    Event: class Event {
      constructor(type, opts) { this.type = type; if (opts) Object.assign(this, opts); }
    },
    setTimeout:   (fn) => { fn(); return 0; },
    clearTimeout: () => {},
    // waitForElement() polls on a light interval for late shadow-DOM mounts;
    // stub it to probe once immediately (mirrors the setTimeout stub).
    setInterval:  (fn) => { try { fn(); } catch (_) {} return 0; },
    clearInterval: () => {},
    chrome: { runtime: { sendMessage: () => {}, lastError: null } },
    __elementSpecs__: elementSpecs,
    __selectors__:    JSON.parse(JSON.stringify(selectors)),
    __values__:       JSON.parse(JSON.stringify(values)),
    __elements__:     null,
    __result__:       null,
    __fillResult__:   null,
    __postMessages__: [],
  });

  const INNER2 = `
${PREAMBLE}

var IS_MAIN_FRAME  = true;
var _logHistory    = new Set();
function logOnce() {}

function __tokenMatchesEl(token, el) {
  var t = token.trim();
  var tagM = t.match(/^([a-zA-Z][a-zA-Z0-9-]*)/);
  var reqTag = tagM ? tagM[1].toLowerCase() : null;
  if (reqTag && el.tagName.toLowerCase() !== reqTag) return false;
  var classMatches = t.match(/\\.([a-zA-Z_\\-][a-zA-Z0-9_\\-]*)/g) || [];
  var elCls = (el.className || "").split(/\\s+/);
  for (var ci = 0; ci < classMatches.length; ci++) {
    if (elCls.indexOf(classMatches[ci].slice(1)) === -1) return false;
  }
  var attrRe = /\\[([a-zA-Z\\-]+)=["']?([^"'\\]]+)["']?\\]/g;
  var attrM;
  while ((attrM = attrRe.exec(t)) !== null) {
    var attr = attrM[1], val = attrM[2];
    if (attr === "id"           && el.id           !== val) return false;
    if (attr === "name"         && el.name         !== val) return false;
    if (attr === "autocomplete" && el.autocomplete !== val) return false;
    if (attr === "type"         && el.type         !== val) return false;
  }
  return true;
}

function __makeEl(spec) {
  var events = [];
  if (spec.tagName === "SELECT") {
    return { tagName:"SELECT", value:spec.value||"", id:spec.id||"", name:spec.name||"",
      className:spec.className||"", focus:function(){}, blur:function(){},
      setAttribute:function(){}, getAttribute:function(){return null;},
      options:(spec._options||[]).map(function(o){return{value:o.value,text:o.text,disabled:false};}),
      dispatchEvent:function(ev){events.push(ev.type);}, _events:events };
  }
  return { tagName:"INPUT", value:spec.value||"", placeholder:spec.placeholder||"",
    type:spec.type||"text", id:spec.id||"", name:spec.name||"",
    autocomplete:spec.autocomplete||"", className:spec.className||"",
    focus:function(){}, blur:function(){}, setAttribute:function(){},
    getAttribute:function(){return null;},
    dispatchEvent:function(ev){events.push(ev.type);}, _events:events };
}

var __elements = __elementSpecs__.map(__makeEl);
__elements__ = __elements;

var document = {
  querySelector: function(sel) {
    if (!sel) return null;
    var tokens = sel.split(",");
    for (var i = 0; i < __elements.length; i++)
      for (var j = 0; j < tokens.length; j++)
        if (__tokenMatchesEl(tokens[j], __elements[i])) return __elements[i];
    return null;
  },
  querySelectorAll: function(sel) {
    var result = [];
    if (!sel) return result;
    var tokens = sel.split(",");
    for (var i = 0; i < __elements.length; i++) {
      for (var j = 0; j < tokens.length; j++) {
        if (__tokenMatchesEl(tokens[j], __elements[i])) { result.push(__elements[i]); break; }
      }
    }
    return result;
  },
  getElementById: function(id) {
    // Return a fake overlay so executeFillSequence posts via window.postMessage
    if (id === "semex-overlay") return { hasAttribute: function() { return true; } };
    return null;
  },
  body: { observe: function() {} },
};

var window = {
  HTMLInputElement: { prototype: {} },
  HTMLTextAreaElement: { prototype: {} },
  postMessage: function(msg) { __postMessages__.push(msg); },
  location: { href: "https://checkout.stripe.com/c/pay/test" },
};
window.top = window; window.self = window;

function MutationObserver(cb) {}
MutationObserver.prototype.observe    = function() {};
MutationObserver.prototype.disconnect = function() {};

${FILL_BLOCK}

// Run executeFillSequence and capture its return value
__result__ = (async function() {
  __fillResult__ = await executeFillSequence(__selectors__, __values__);
})();
`;

  new vm.Script(INNER2).runInContext(ctx);
  await ctx.__result__;

  return {
    elements:     Array.from(ctx.__elements__),
    fillResult:   ctx.__fillResult__,
    postMessages: Array.from(ctx.__postMessages__),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// All suites wrapped in main() to avoid top-level await (CJS requirement)
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {

// ═══════════════════════════════════════════════════════════════════════════════
// A. Classic Stripe checkout — name / id / autocomplete selectors
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\n=== A. Classic Stripe checkout — fill values & events ===\n");

{
  const SPECS = [
    { tagName: "INPUT",  name: "cardNumber" },
    { tagName: "INPUT",  id:   "cardExpiry" },
    { tagName: "INPUT",  name: "cvc" },
    { tagName: "INPUT",  autocomplete: "cc-name" },
    { tagName: "INPUT",  autocomplete: "address-line1" },
    { tagName: "INPUT",  autocomplete: "address-line2" },
    { tagName: "INPUT",  autocomplete: "address-level2" },
    { tagName: "INPUT",  autocomplete: "postal-code" },
    { tagName: "INPUT",  type: "email", name: "email" },
    { tagName: "SELECT", name: "billingCountry",
      _options: [{ value: "US", text: "United States" }] },
  ];
  const [elCardNumber, elExpiry, elCvv, elName,
         elAddress, elAddress2, elCity, elZip, elEmail, elCountry] =
    await runFillSequence(SPECS, STRIPE_SEL, FILL_VALUES);

  console.log("Group A1: field values set");
  // Visible card fields hold the decoy test card by design — the interceptor
  // swaps the real card into the Stripe API call (see section E note).
  assertEquals(elCardNumber.value, "4111111111111111", "cardNumber = visible decoy 4111...");
  assertEquals(elExpiry.value,     "12/30",            "expiry = visible decoy 12/30");
  assertEquals(elCvv.value,        FILL_VALUES.cvv,        "CVV = 123");
  assertEquals(elName.value,       FILL_VALUES.name,       "name = John Doe");
  assertEquals(elAddress.value,    FILL_VALUES.address,    "address = 123 Main St");
  assertEquals(elAddress2.value,   FILL_VALUES.address2,   "address2 = Apt 4");
  assertEquals(elCity.value,       FILL_VALUES.city,       "city = New York");
  assertEquals(elZip.value,        FILL_VALUES.zip,        "zip = 10001");
  assertEquals(elCountry.value,    FILL_VALUES.country,    "country SELECT = US");

  console.log("\nGroup A2: DOM events dispatched");
  for (const [label, el] of [
    ["cardNumber", elCardNumber], ["expiry", elExpiry],
    ["cvv", elCvv],               ["name",   elName],
    ["address",   elAddress],     ["zip",    elZip],
    ["country",   elCountry],
  ]) {
    assert(el._events.includes("input"),  `${label}: "input" event dispatched`);
    assert(el._events.includes("change"), `${label}: "change" event dispatched`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// B. New Stripe UI (habanero) — payment-*Input element IDs
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\n=== B. New Stripe UI (habanero) — payment-*Input IDs ===\n");

{
  const SPECS = [
    { tagName: "INPUT",  id: "payment-numberInput" },
    { tagName: "INPUT",  id: "payment-expiryInput" },
    { tagName: "INPUT",  id: "payment-cvcInput", name: "cvc" },  // name flags CVV path
    { tagName: "INPUT",  id: "payment-nameInput" },
    { tagName: "SELECT", id: "payment-countryInput",
      _options: [{ value: "US", text: "United States" }] },
  ];
  const [elCardNumber, elExpiry, elCvv, elName, elCountry] =
    await runFillSequence(SPECS, STRIPE_SEL, FILL_VALUES);

  console.log("Group B1: new-UI field values");
  assertEquals(elCardNumber.value, "4111111111111111", "payment-numberInput = visible decoy 4111...");
  assertEquals(elExpiry.value,     "12/30",            "payment-expiryInput = visible decoy 12/30");
  assertEquals(elCvv.value,        FILL_VALUES.cvv,        "payment-cvcInput = 123");
  assertEquals(elName.value,       FILL_VALUES.name,       "payment-nameInput = John Doe");
  assertEquals(elCountry.value,    FILL_VALUES.country,    "payment-countryInput SELECT = US");

  console.log("\nGroup B2: new-UI events dispatched");
  for (const [label, el] of [
    ["payment-numberInput", elCardNumber],
    ["payment-expiryInput", elExpiry],
    ["payment-cvcInput",    elCvv],
    ["payment-nameInput",   elName],
  ]) {
    assert(el._events.includes("input"),  `${label}: "input" event dispatched`);
    assert(el._events.includes("change"), `${label}: "change" event dispatched`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// C. Stripe hosted-fields — Field-*Input IDs
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\n=== C. Stripe hosted-fields — Field-*Input IDs ===\n");

{
  const SPECS = [
    { tagName: "INPUT", id: "Field-cvcInput",  name: "cvc" },
    { tagName: "INPUT", id: "Field-nameInput" },
    // also include a card number via Field-numberInput to confirm
    { tagName: "INPUT", id: "Field-numberInput" },
  ];
  const [elCvv, elName, elCardNumber] =
    await runFillSequence(SPECS, STRIPE_SEL, FILL_VALUES);

  console.log("Group C1: hosted-fields values");
  assertEquals(elCvv.value,        FILL_VALUES.cvv,        "Field-cvcInput = 123");
  assertEquals(elName.value,       FILL_VALUES.name,       "Field-nameInput = John Doe");
  assertEquals(elCardNumber.value, "4111111111111111", "Field-numberInput = visible decoy 4111...");

  console.log("\nGroup C2: hosted-fields events");
  for (const [label, el] of [
    ["Field-cvcInput",    elCvv],
    ["Field-nameInput",   elName],
    ["Field-numberInput", elCardNumber],
  ]) {
    assert(el._events.includes("input"),  `${label}: "input" event dispatched`);
    assert(el._events.includes("change"), `${label}: "change" event dispatched`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// D. Legacy Stripe Elements — input.InputElement class selector
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\n=== D. Legacy Stripe Elements — input.InputElement class ===\n");

{
  const SPECS = [
    { tagName: "INPUT", className: "InputElement" },
  ];
  const [elCardNumber] = await runFillSequence(SPECS, STRIPE_SEL, FILL_VALUES);

  console.log("Group D1: InputElement value");
  assertEquals(elCardNumber.value, "4111111111111111",
    "input.InputElement = visible decoy 4111...");

  console.log("\nGroup D2: InputElement events");
  assert(elCardNumber._events.includes("input"),  "input.InputElement: \"input\" event dispatched");
  assert(elCardNumber._events.includes("change"), "input.InputElement: \"change\" event dispatched");
}

// ═══════════════════════════════════════════════════════════════════════════════
// E. fill() idempotency — no events when element already has the correct value
// ═══════════════════════════════════════════════════════════════════════════════
//
// NOTE: cardNumber is NOT suitable here. executeFillSequence always performs a
// test-card pre-fill ("4111111111111111") before the main fill loop, so the
// cardNumber element is written at least twice regardless of its initial value —
// the idempotency guard never has a chance to fire for that field.
// CVV is written only once (main fill loop) so it correctly exercises the guard.

console.log("\n=== E. fill() idempotency — no events when value already matches ===\n");

{
  // Pre-set the CVV element to the target value — setFormValue must early-exit
  const SPECS = [
    { tagName: "INPUT", name: "cvc", value: FILL_VALUES.cvv },
  ];
  const [elCvv] = await runFillSequence(SPECS, STRIPE_SEL, FILL_VALUES);

  console.log("Group E1: value unchanged, no events (CVV field)");
  assertEquals(elCvv.value, FILL_VALUES.cvv,
    "cvv: value still correct after fill (no double-write)");
  assertEquals(elCvv._events.length, 0,
    "cvv: dispatchEvent NOT called when value already matches");
}

// ═══════════════════════════════════════════════════════════════════════════════
// F. fill() graceful no-op — missing fields don't throw, present ones still fill
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\n=== F. fill() graceful no-op — missing fields don't throw ===\n");

{
  // Only a CVV element — cardNumber / expiry / name / address all absent
  const SPECS = [
    { tagName: "INPUT", name: "cvc" },
  ];

  let threw = false;
  let elCvv;
  try {
    [elCvv] = await runFillSequence(SPECS, STRIPE_SEL, FILL_VALUES);
  } catch (e) {
    threw = true;
    console.error("    Unexpected throw:", e.message);
  }

  console.log("Group F1: no throw with mostly-absent DOM");
  assert(!threw, "executeFillSequence does not throw when most fields are absent");

  if (!threw) {
    console.log("\nGroup F2: present CVV still filled despite missing siblings");
    assertEquals(elCvv.value, FILL_VALUES.cvv,
      "CVV (only element present) correctly filled to 123");
    assert(elCvv._events.includes("input"),  "CVV (only element): \"input\" event dispatched");
    assert(elCvv._events.includes("change"), "CVV (only element): \"change\" event dispatched");
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// G. Validation result propagation — ok:false returned when required fields empty
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\n=== G. Validation result propagation ===\n");

{
  // G1/G2: cardNumber and expiry selectors point to non-existent elements.
  // executeFillSequence must return {ok:false, error:"empty_fields:cardNumber,expiry"}
  // and SEMEX_FILL_FORM_COMPLETE must be posted with ok !== true.
  const selMissingCard = Object.assign({}, STRIPE_SEL, {
    cardNumber: 'input[name="missingCardNumber"]', // not in DOM
    expiry:     'input[name="missingExpiry"]',      // not in DOM
    cvv:        'input[name="cvc"]',                // present
  });
  // Specs: only CVV is present — cardNumber and expiry selectors won't match.
  const specsG = [{ tagName: "INPUT", name: "cvc" }];

  const { fillResult: resultG, postMessages: msgsG } =
    await runFillSequenceWithResult(specsG, selMissingCard, FILL_VALUES);

  console.log("Group G1: empty required fields → ok:false returned");
  assert(
    resultG && resultG.ok === false,
    "executeFillSequence returns { ok: false } when cardNumber and expiry are absent from DOM"
  );
  assert(
    resultG && typeof resultG.error === "string" && resultG.error.startsWith("empty_fields:"),
    'returned error starts with "empty_fields:" listing the missing fields'
  );
  assert(
    resultG && resultG.error && resultG.error.includes("cardNumber"),
    'returned error lists "cardNumber" as missing'
  );
  assert(
    resultG && resultG.error && resultG.error.includes("expiry"),
    'returned error lists "expiry" as missing'
  );

  console.log("\nGroup G2: SEMEX_FILL_FORM_COMPLETE carries ok:false");
  const completeMsgsG = msgsG.filter(m => m && m.type === "SEMEX_FILL_FORM_COMPLETE");
  assert(
    completeMsgsG.length > 0,
    "SEMEX_FILL_FORM_COMPLETE was posted"
  );
  assert(
    completeMsgsG.every(m => m.ok !== true),
    "none of the posted SEMEX_FILL_FORM_COMPLETE messages has ok:true when required fields are empty"
  );

  console.log("\nGroup G3: all-fields-present DOM → ok:true returned");
  // Full suite: all required inputs present — fill succeeds and returns ok:true.
  const specsG3 = [
    { tagName: "INPUT", name: "cardNumber" },
    { tagName: "INPUT", id: "cardExpiry" },
    { tagName: "INPUT", name: "cvc" },
  ];
  const { fillResult: result3, postMessages: msgs3 } =
    await runFillSequenceWithResult(specsG3, STRIPE_SEL, FILL_VALUES);

  assert(
    result3 && result3.ok === true,
    "executeFillSequence returns { ok: true } when all required fields are found and filled"
  );
  const completeMsgs3 = msgs3.filter(m => m && m.type === "SEMEX_FILL_FORM_COMPLETE");
  assert(
    completeMsgs3.some(m => m.ok === true),
    "SEMEX_FILL_FORM_COMPLETE ok:true is posted when all required fields are filled"
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// H. Habanero lazy-mount — cardNumber absent at fill time → empty_fields:cardNumber
// ═══════════════════════════════════════════════════════════════════════════════
//
// New Stripe UI mounts card inputs lazily AFTER the accordion expands. The fill
// sequence calls waitForElement(cardNumber, 3000) before filling.  When the
// element never appears (waitForElement times out → null), the post-fill
// validation MUST catch the empty cardNumber and report ok:false with
// "empty_fields:cardNumber" instead of silently returning ok:true.
//
// This is the critical fail-closed path: without the post-fill guard, autofill
// would appear to complete while the card number field stayed blank.

console.log("\n=== H. Habanero lazy-mount — absent cardNumber → empty_fields:cardNumber ===\n");

{
  // Only CVV is present; cardNumber and expiry selectors find nothing.
  const specsH = [{ tagName: "INPUT", name: "cvc" }];

  const selHabanero = Object.assign({}, STRIPE_SEL, {
    cardNumber: 'input[id="payment-numberInput"]',  // not in specsH → null
    expiry:     'input[id="payment-expiryInput"]',  // not in specsH → null
    cvv:        'input[name="cvc"]',                // present
  });

  const { fillResult: resultH, postMessages: msgsH } =
    await runFillSequenceWithResult(specsH, selHabanero, FILL_VALUES);

  console.log("Group H1: lazy-mount timeout → ok:false (fail-closed, not silent success)");
  assert(
    resultH && resultH.ok === false,
    "H1: absent habanero cardNumber → ok:false (fail-closed, not silent success)"
  );
  assert(
    resultH && typeof resultH.error === "string" && resultH.error.startsWith("empty_fields:"),
    'H1: error starts with "empty_fields:" listing the unset fields'
  );
  assert(
    resultH && resultH.error && resultH.error.includes("cardNumber"),
    'H1: error lists "cardNumber" as missing (habanero lazy-mount failure)'
  );

  console.log("\nGroup H2: SEMEX_FILL_FORM_COMPLETE carries ok:false (not bare/undefined)");
  const completeMsgsH = msgsH.filter(m => m && m.type === "SEMEX_FILL_FORM_COMPLETE");
  assert(
    completeMsgsH.length > 0,
    "H2: SEMEX_FILL_FORM_COMPLETE was posted"
  );
  assert(
    completeMsgsH.every(m => m.ok !== true),
    "H2: posted message has ok !== true (absent fields reported, not silently ok)"
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// I. Habanero lazy-mount via MutationObserver — element appears just-in-time → ok:true
// ═══════════════════════════════════════════════════════════════════════════════
//
// When card inputs mount lazily during the fill, the MutationObserver inside
// waitForElement fires and resolves with the element (instead of timing out).
// This is the accordion-expand-just-in-time scenario: fill starts, accordion
// expands synchronously, observer fires, cardNumber is found, fill succeeds.
// Result must be ok:true and SEMEX_FILL_FORM_COMPLETE ok:true.

console.log("\n=== I. Habanero lazy-mount via MutationObserver — element appears → ok:true ===\n");

{
  // Build a custom vm context with a MutationObserver that fires immediately on
  // observe() — simulating the accordion expanding just as the fill starts.
  const ctxI = vm.createContext({
    Object, Array, String, Math, Promise, Set,
    Event: class Event {
      constructor(type, opts) { this.type = type; if (opts) Object.assign(this, opts); }
    },
    InputEvent: class InputEvent {
      constructor(type, opts) {
        this.type      = type;
        this.inputType = (opts && opts.inputType) || "";
        this.data      = (opts && opts.data)      || "";
        this.bubbles   = !!(opts && opts.bubbles);
      }
    },
    setTimeout:   (fn) => { fn(); return 0; },
    clearTimeout: () => {},
    // waitForElement() polls on a light interval for late shadow-DOM mounts;
    // stub it to probe once immediately (mirrors the setTimeout stub).
    setInterval:  (fn) => { try { fn(); } catch (_) {} return 0; },
    clearInterval: () => {},
    chrome: { runtime: { sendMessage: () => {}, lastError: null } },
    __fillResult__:   null,
    __result__:       null,
    __postMessages__: [],
    // Inject habanero selectors with only ID-based tokens so we can control
    // exactly when querySelector finds them.
    __selI__: JSON.parse(JSON.stringify(Object.assign({}, STRIPE_SEL, {
      cardNumber: 'input[id="payment-numberInput"]',
      expiry:     'input[id="payment-expiryInput"]',
      cvv:        'input[name="cvc"]',
    }))),
    __valI__: JSON.parse(JSON.stringify(FILL_VALUES)),
  });

  const INNER_I = `
${PREAMBLE}
var IS_MAIN_FRAME = true;
var _logHistory   = new Set();
function logOnce() {}

// ── Element registry — initially only CVV; card+expiry added when observer fires ─
var __allElements = [];
function __makeEl(spec) {
  var events = [];
  return {
    tagName:"INPUT", value:spec.value||"", placeholder:"", type:"text",
    id:spec.id||"", name:spec.name||"", autocomplete:"", className:"",
    focus:function(){}, blur:function(){}, setAttribute:function(){},
    getAttribute:function(){return null;},
    dispatchEvent:function(ev){events.push(ev.type);}, _events:events
  };
}
var __cvvEl    = __makeEl({ name: "cvc" });
var __cardEl   = __makeEl({ id: "payment-numberInput" });
var __expiryEl = __makeEl({ id: "payment-expiryInput" });
__allElements.push(__cvvEl);   // only CVV present initially

// ── MutationObserver fires callback immediately on observe() ──────────────────
// Simulates the accordion expanding: observer attached → element mounts → observer fires.
function MutationObserver(cb) { this._cb = cb; }
MutationObserver.prototype.observe = function() {
  __allElements.push(__cardEl, __expiryEl);  // "elements mounted"
  this._cb([], this);                        // observer fires synchronously
};
MutationObserver.prototype.disconnect = function() {};

// ── Token matcher & document stub ────────────────────────────────────────────
function __tokenMatchesEl(token, el) {
  var t = token.trim();
  var tagM = t.match(/^([a-zA-Z][a-zA-Z0-9-]*)/);
  var reqTag = tagM ? tagM[1].toLowerCase() : null;
  if (reqTag && el.tagName.toLowerCase() !== reqTag) return false;
  var classMatches = t.match(/\\.([a-zA-Z_\\-][a-zA-Z0-9_\\-]*)/g) || [];
  var elCls = (el.className || "").split(/\\s+/);
  for (var ci = 0; ci < classMatches.length; ci++) {
    if (elCls.indexOf(classMatches[ci].slice(1)) === -1) return false;
  }
  var attrRe = /\\[([a-zA-Z\\-]+)=["']?([^"'\\]]+)["']?\\]/g;
  var attrM;
  while ((attrM = attrRe.exec(t)) !== null) {
    var attr = attrM[1], val = attrM[2];
    if (attr === "id"   && el.id   !== val) return false;
    if (attr === "name" && el.name !== val) return false;
    if (attr === "autocomplete" && el.autocomplete !== val) return false;
  }
  return true;
}
var document = {
  querySelector: function(sel) {
    if (!sel) return null;
    var tokens = sel.split(",");
    for (var i = 0; i < __allElements.length; i++)
      for (var j = 0; j < tokens.length; j++)
        if (__tokenMatchesEl(tokens[j], __allElements[i])) return __allElements[i];
    return null;
  },
  querySelectorAll: function(sel) {
    var result = [];
    if (!sel) return result;
    var tokens = sel.split(",");
    for (var i = 0; i < __allElements.length; i++)
      for (var j = 0; j < tokens.length; j++)
        if (__tokenMatchesEl(tokens[j], __allElements[i])) { result.push(__allElements[i]); break; }
    return result;
  },
  getElementById: function(id) {
    if (id === "semex-overlay") return { hasAttribute: function() { return true; } };
    return null;
  },
  body: { observe: function() {} },
};
var window = {
  HTMLInputElement: { prototype: {} }, HTMLTextAreaElement: { prototype: {} },
  postMessage: function(msg) { __postMessages__.push(msg); },
  location: { href: "https://js.stripe.com/v3/elements-inner-habanero/index.html" },
};
window.top = window; window.self = window;

${FILL_BLOCK}

__result__ = (async function() {
  __fillResult__ = await executeFillSequence(__selI__, __valI__);
})();
`;

  new vm.Script(INNER_I).runInContext(ctxI);
  await ctxI.__result__;

  const resultI = ctxI.__fillResult__;
  const msgsI   = Array.from(ctxI.__postMessages__);

  console.log("Group I1: MutationObserver fires → lazy cardNumber found → ok:true");
  assert(
    resultI && resultI.ok === true,
    "I1: MutationObserver lazy-mount path fills cardNumber → ok:true"
  );

  console.log("\nGroup I2: SEMEX_FILL_FORM_COMPLETE posted with ok:true");
  const completeMsgsI = msgsI.filter(m => m && m.type === "SEMEX_FILL_FORM_COMPLETE");
  assert(
    completeMsgsI.length > 0,
    "I2: SEMEX_FILL_FORM_COMPLETE was posted"
  );
  assert(
    completeMsgsI.some(m => m.ok === true),
    "I2: at least one SEMEX_FILL_FORM_COMPLETE has ok:true after lazy-mount fill"
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// J. React-state compatibility — setFormValue dispatches InputEvent(insertFromPaste)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Stripe's React card form uses a controlled input. A plain Event('input') fires
// the DOM listener but does not trigger React's synthetic onInput handler — the
// React state stays stale (empty), so the submit handler reads an empty card
// number even though the DOM value was set. The fix is InputEvent('input',
// { inputType:'insertFromPaste', data:<value> }): React 17/18 synthetic event
// system receives nativeEvent.data and updates its internal state in sync.
//
// This test verifies:
//   J1. At least one InputEvent is dispatched (not only generic Event).
//   J2. That InputEvent has inputType === 'insertFromPaste'.
//   J3. The InputEvent carries the card number as its .data payload so React
//       reads the value from the event (not from a stale element.value snapshot).

console.log("\n=== J. React-state compat — setFormValue dispatches InputEvent(insertFromPaste) ===\n");

{
  const ctxJ = vm.createContext({
    Object, Array, String, Math, Promise, Set,
    // Plain Event class — distinguishable from InputEvent by _kind field.
    Event: class Event {
      constructor(type, opts) {
        this._kind      = "Event";
        this.type       = type;
        this.bubbles    = !!(opts && opts.bubbles);
        this.cancelable = !!(opts && opts.cancelable);
      }
    },
    // InputEvent with full capture of inputType and data.
    InputEvent: class InputEvent {
      constructor(type, opts) {
        this._kind     = "InputEvent";
        this.type      = type;
        this.inputType = (opts && opts.inputType) || "";
        this.data      = (opts && opts.data)      || "";
        this.bubbles   = !!(opts && opts.bubbles);
      }
    },
    setTimeout:   (fn) => { fn(); return 0; },
    clearTimeout: () => {},
    // waitForElement() polls on a light interval for late shadow-DOM mounts;
    // stub it to probe once immediately (mirrors the setTimeout stub).
    setInterval:  (fn) => { try { fn(); } catch (_) {} return 0; },
    clearInterval: () => {},
    chrome: { runtime: { sendMessage: () => {}, lastError: null } },
    __allEvents__: [],
    __result__:    null,
  });

  const INNER_J = `
${PREAMBLE}
var IS_MAIN_FRAME = true;
var _logHistory   = new Set();
function logOnce() {}

// Single card-number element that captures every dispatched event with full type info.
var __cardEl = {
  tagName:"INPUT", value:"", placeholder:"", type:"text",
  id:"payment-numberInput", name:"", autocomplete:"", className:"",
  focus:function(){}, blur:function(){},
  setAttribute:function(k,v){ if(k==="value") this.value=v; },
  getAttribute:function(){return null;},
  dispatchEvent:function(ev) {
    __allEvents__.push({ _kind:ev._kind||"Event", type:ev.type, inputType:ev.inputType||"", data:ev.data||"" });
    // Mirror what React does: read nativeEvent.data during the InputEvent dispatch.
    if (ev._kind === "InputEvent" && ev.inputType === "insertFromPaste" && ev.data) {
      this.value = ev.data;
    }
  },
};

function MutationObserver(cb) {}
MutationObserver.prototype.observe    = function() {};
MutationObserver.prototype.disconnect = function() {};

var document = {
  querySelector: function(sel) {
    if (!sel) return null;
    var tokens = sel.split(",");
    for (var j = 0; j < tokens.length; j++) {
      var t = tokens[j].trim();
      // Match [id="payment-numberInput"] token
      if (t.indexOf("payment-numberInput") !== -1 && t.indexOf("[id=") !== -1) return __cardEl;
    }
    return null;
  },
  querySelectorAll: function() { return []; },
  getElementById: function(id) {
    if (id === "semex-overlay") return { hasAttribute: function() { return true; } };
    return null;
  },
  body: { observe: function() {} },
};
var window = {
  HTMLInputElement: { prototype: {} }, HTMLTextAreaElement: { prototype: {} },
  postMessage: function() {},
  location: { href: "https://checkout.stripe.com/c/pay/test" },
};
window.top = window; window.self = window;

${FILL_BLOCK}

// Exercise setFormValue via executeFillSequence; only cardNumber is wired.
// expiry and cvv selectors are null so the function skips them — we care only
// about the events dispatched for the card number field.
__result__ = (async function() {
  await executeFillSequence(
    { cardNumber: 'input[id="payment-numberInput"]', expiry: null, cvv: null },
    { cardNumber: "4242424242424242" }
  );
})();
`;

  new vm.Script(INNER_J).runInContext(ctxJ);
  await ctxJ.__result__;
  const allEventsJ = Array.from(ctxJ.__allEvents__);

  console.log("Group J1: at least one InputEvent dispatched (not only generic Event)");
  const inputEventsJ = allEventsJ.filter(ev => ev._kind === "InputEvent");
  assert(
    inputEventsJ.length > 0,
    "J1: setFormValue dispatches at least one InputEvent (not only generic Event('input'))"
  );

  console.log("\nGroup J2: InputEvent has inputType='insertFromPaste' (React 17/18 handler path)");
  const pasteEventsJ = inputEventsJ.filter(ev => ev.inputType === "insertFromPaste");
  assert(
    pasteEventsJ.length > 0,
    "J2: InputEvent with inputType='insertFromPaste' dispatched — React synthetic handler updates internal state"
  );

  console.log("\nGroup J3: insertFromPaste event carries card number as .data payload");
  const pasteWithDataJ = pasteEventsJ.filter(ev => ev.data && ev.data.length > 0);
  assert(
    pasteWithDataJ.length > 0,
    "J3: InputEvent.data is set to the card value (React reads nativeEvent.data, not a stale element.value)"
  );
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(50)}`);
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log("═".repeat(50) + "\n");

if (failed > 0) process.exit(1);

} // end main()

main().catch(err => { console.error("Unexpected error:", err); process.exit(1); });
