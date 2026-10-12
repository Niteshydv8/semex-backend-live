/**
 * stripe-link-dismiss.test.js
 *
 * Regression guard for dismissStripeLinkSavedPayment() in content.js.
 *
 * Verified scenarios:
 *   A. Stripe Link data-testid button present → clicked, true
 *   B. Text-fallback: card type=hidden + Stripe Link copy → clicked, true
 *   C. Text-fallback: card CSS-hidden (display:none / visibility:hidden) → clicked
 *   D. Card ABSENT — text fallback SKIPPED even for Stripe Link copy (key guard)
 *   E. Card inputs visible → no dismiss, false
 *   F. Merchant "Change address / Change plan" controls NOT clicked (hidden card)
 *   G. No button present → graceful false
 *   H. data-testid fires even when card is visible (bypass guard)
 *
 * Run: node semex/content/stripe-link-dismiss.test.js
 */

"use strict";

const fs   = require("fs");
const path = require("path");
const vm   = require("vm");

// ─── Source ──────────────────────────────────────────────────────────────────

const CONTENT_JS = path.join(__dirname, "content.js");
if (!fs.existsSync(CONTENT_JS)) throw new Error("Source not found: " + CONTENT_JS);
const CT_SRC = fs.readFileSync(CONTENT_JS, "utf8");

// ─── Preamble (__defProp / __name, lines 1-5) ─────────────────────────────────

const PREAMBLE = CT_SRC.split("\n").slice(0, 5).join("\n");

// ─── Extract: sleep + dismissStripeLinkSavedPayment ───────────────────────────
// The block runs from the `const sleep =` definition through to the __name
// sentinel for dismissStripeLinkSavedPayment.

const SLEEP_MARKER   = "const sleep =";
const DISMISS_END    = '__name(dismissStripeLinkSavedPayment, "dismissStripeLinkSavedPayment")';

let DISMISS_BLOCK;
(function buildBlock() {
  const sleepIdx = CT_SRC.indexOf(SLEEP_MARKER);
  const endIdx   = CT_SRC.indexOf(DISMISS_END);

  if (sleepIdx === -1) throw new Error("'const sleep =' not found in content.js");
  if (endIdx   === -1) throw new Error('"dismissStripeLinkSavedPayment" __name sentinel not found in content.js');
  if (CT_SRC.indexOf("async function dismissStripeLinkSavedPayment()") === -1)
    throw new Error("async function dismissStripeLinkSavedPayment not found in content.js");

  DISMISS_BLOCK = CT_SRC.slice(sleepIdx, endIdx + DISMISS_END.length + 2);
})();

// Sanity-check the extraction — confirms the guard logic is present.
for (const marker of [
  "const sleep =",
  "async function dismissStripeLinkSavedPayment()",
  "includes(\"different card\")",
  "includes(\"other card\")",
  "_semexHiddenCardFound",
  "querySelectorAll",
  "getComputedStyle",
]) {
  if (!DISMISS_BLOCK.includes(marker))
    throw new Error("Sanity check failed — marker not found in extracted block: " + marker);
}

// ─── Test harness ─────────────────────────────────────────────────────────────

let passed = 0, failed = 0;

function assert(cond, name) {
  if (cond) { console.log("  \u2713  " + name); passed++; }
  else       { console.error("  \u2717  " + name); failed++; }
}

// ─── vm runner ────────────────────────────────────────────────────────────────
// buttons:    array of { text, testid?, clicked: false, role? }
// cardInputs: array of { id?, autocomplete?, type?, computedDisplay?, computedVisibility? }
// Returns:    { result: boolean, buttons }

async function runDismiss(buttons, cardInputs) {
  const ctx = vm.createContext({
    Object, Array, String, Math, Promise, Set,
    // sleep() uses setTimeout; resolve immediately in tests
    setTimeout:   function(fn) { fn(); return 0; },
    clearTimeout: function() {},
    __buttons__:    buttons,
    __cardInputs__: cardInputs,
    __result__:     null,
  });

  const INNER = `
${PREAMBLE}

// ─── Mock document ────────────────────────────────────────────────────────────
var document = {
  // Handles:
  //   • [data-testid='...']                 — Stripe Link testid selectors
  //   • #Field-numberInput / #cardNumber     — card hidden guard
  //   • [data-elements-stable-field-name='cardNumber'] — card hidden guard
  //   • input[autocomplete='cc-number']      — card hidden guard
  querySelector: function(sel) {
    sel = (sel || "").trim();

    // data-testid match
    var tidM = sel.match(/\\[data-testid=['"]([^'"]+)['"]\\]/);
    if (tidM) {
      var tid = tidM[1];
      for (var i = 0; i < __buttons__.length; i++) {
        if (__buttons__[i].testid === tid) return __buttons__[i];
      }
      return null;
    }

    // card-number selector match — return first hit for querySelector
    var isCardNumSel = (
      sel === "#Field-numberInput" ||
      sel === "#cardNumber" ||
      sel.indexOf("cc-number") !== -1 ||
      sel.indexOf("cardNumber") !== -1
    );
    if (isCardNumSel) {
      for (var k = 0; k < __cardInputs__.length; k++) {
        var ci = __cardInputs__[k];
        var idMatch  = ci.id === "Field-numberInput" || ci.id === "cardNumber";
        var acMatch  = ci.autocomplete === "cc-number";
        if (idMatch || acMatch) return ci;
      }
      return null;
    }

    return null;
  },

  // Returns all matching elements for a selector.
  querySelectorAll: function(sel) {
    sel = (sel || "").trim();

    // button / role=button sweep
    if (sel.indexOf("button") !== -1) return __buttons__.slice();

    // card-number sweep — returns ALL matching card inputs so the guard can
    // check every one for hidden state (prevents a visible sibling masking
    // a hidden one).
    var isCardNumSel = (
      sel === "#Field-numberInput" ||
      sel === "#cardNumber" ||
      sel.indexOf("cc-number") !== -1 ||
      sel.indexOf("cardNumber") !== -1
    );
    if (isCardNumSel) {
      var matches = [];
      for (var k = 0; k < __cardInputs__.length; k++) {
        var ci = __cardInputs__[k];
        var idMatch = ci.id === "Field-numberInput" || ci.id === "cardNumber";
        var acMatch = ci.autocomplete === "cc-number";
        if (idMatch || acMatch) matches.push(ci);
      }
      return matches;
    }

    return [];
  },

  getElementById: function() { return null; },
  body: {},
};

var window = {
  HTMLInputElement: { prototype: {} },
  postMessage: function() {},
  location: { href: "https://example.com/" },
  // getComputedStyle reads the simulated display/visibility from the card mock.
  getComputedStyle: function(el) {
    return {
      display:    (el && el.computedDisplay)    || "",
      visibility: (el && el.computedVisibility) || "",
    };
  },
};
window.top  = window;
window.self = window;

${DISMISS_BLOCK}

// Invoke and capture
__result__ = dismissStripeLinkSavedPayment();
`;

  new vm.Script(INNER).runInContext(ctx);
  const result = await ctx.__result__;
  return { result, buttons: ctx.__buttons__ };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mkBtn(text, testid) {
  return {
    tagName:     "BUTTON",
    textContent: text,
    innerText:   text,
    testid:      testid || null,
    clicked:     false,
    click:       function() { this.clicked = true; },
  };
}

// opts may include: id, autocomplete, type, computedDisplay, computedVisibility
function mkCard(opts) {
  return Object.assign(
    { tagName: "INPUT", type: "text", computedDisplay: "", computedVisibility: "" },
    opts || {}
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {

// ═══════════════════════════════════════════════════════════════════════════════
// A. data-testid hit — Stripe Link's own stable selectors (card state irrelevant)
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\n=== A. data-testid button clicked (card state irrelevant) ===\n");

{
  const testids = [
    "link-change-payment-method",
    "link-change-payment",
    "change-payment-method",
    "link-use-different-card",
  ];
  for (const tid of testids) {
    const b = [mkBtn("placeholder", tid)];
    const { result, buttons: bs } = await runDismiss(b, []);
    assert(result === true,  "A: [data-testid='" + tid + "'] → true");
    assert(bs[0].clicked,   "A: [data-testid='" + tid + "'] button was clicked");
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// B. Text-based fallback — card type=hidden (Stripe Link hid the form)
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\n=== B. Text fallback — Stripe Link copy + card type=hidden ===\n");

{
  const hits = [
    "Use a different card",
    "different payment method",
    "different payment",
    "other card",
    "change",              // exact
    "Change",              // case-insensitive exact
    "change card",
    "Change Card",
    "change payment method",
    "change payment",
  ];
  for (const label of hits) {
    const b    = [mkBtn(label)];
    const card = [mkCard({ id: "cardNumber", type: "hidden" })];
    const { result, buttons: bs } = await runDismiss(b, card);
    assert(result === true, "B: '" + label + "' + type=hidden → true");
    assert(bs[0].clicked,  "B: '" + label + "' button clicked");
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// C. Text-based fallback — card CSS-hidden (display:none / visibility:hidden)
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\n=== C. Text fallback — Stripe Link copy + card CSS-hidden ===\n");

{
  // display:none
  {
    const b    = [mkBtn("Use a different card")];
    const card = [mkCard({ id: "cardNumber", computedDisplay: "none" })];
    const { result, buttons: bs } = await runDismiss(b, card);
    assert(result === true, "C1: display:none → dismiss proceeds");
    assert(bs[0].clicked,   "C1: button was clicked");
  }

  // visibility:hidden
  {
    const b    = [mkBtn("other card")];
    const card = [mkCard({ autocomplete: "cc-number", computedVisibility: "hidden" })];
    const { result, buttons: bs } = await runDismiss(b, card);
    assert(result === true, "C2: visibility:hidden → dismiss proceeds");
    assert(bs[0].clicked,   "C2: button was clicked");
  }

  // Hidden sibling alongside a visible one — must still find the hidden input
  {
    const b = [mkBtn("change payment")];
    const cards = [
      mkCard({ id: "cardNumber", type: "text" }),           // visible — must not block
      mkCard({ autocomplete: "cc-number", type: "hidden" }), // hidden — must trigger
    ];
    const { result, buttons: bs } = await runDismiss(b, cards);
    assert(result === true, "C3: visible sibling + hidden sibling → dismiss proceeds");
    assert(bs[0].clicked,   "C3: button was clicked");
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// D. Card ABSENT — text fallback SKIPPED (key guard: no hidden card = no Stripe Link)
//    Even perfectly matching Stripe Link copy must not fire when no card input
//    exists in the DOM — the page has no Stripe form, so there is nothing to dismiss.
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\n=== D. Card absent — text fallback skipped for ALL phrases ===\n");

{
  const stripeLinkhPhrases = [
    "Use a different card",
    "different payment method",
    "different payment",
    "other card",
    "change",
    "change card",
    "change payment method",
    "change payment",
  ];
  for (const label of stripeLinkhPhrases) {
    const b = [mkBtn(label)];
    // No card inputs at all — guard must skip text matching.
    const { result, buttons: bs } = await runDismiss(b, []);
    assert(result === false,  "D: '" + label + "' + no card → false (guard skips)");
    assert(!bs[0].clicked,    "D: '" + label + "' button NOT clicked");
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// E. Card inputs visible — guard fires, no dismiss
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\n=== E. Card input visible — guard fires, no dismiss ===\n");

{
  const linkButton = mkBtn("Use a different card");

  // Card present by id, type=text (visible)
  const { result: r1, buttons: bs1 } = await runDismiss([linkButton], [mkCard({ id: "cardNumber" })]);
  assert(r1 === false,    "E1: cardNumber visible → false");
  assert(!bs1[0].clicked, "E1: button NOT clicked");

  // Card present by autocomplete, visible
  const linkButton2 = mkBtn("different payment");
  const { result: r2, buttons: bs2 } = await runDismiss([linkButton2], [mkCard({ autocomplete: "cc-number" })]);
  assert(r2 === false,    "E2: cc-number visible → false");
  assert(!bs2[0].clicked, "E2: button NOT clicked");

  // Card present by id=Field-numberInput, visible
  const linkButton3 = mkBtn("other card");
  const { result: r3, buttons: bs3 } = await runDismiss([linkButton3], [mkCard({ id: "Field-numberInput" })]);
  assert(r3 === false,    "E3: Field-numberInput visible → false");
  assert(!bs3[0].clicked, "E3: button NOT clicked");
}

// ═══════════════════════════════════════════════════════════════════════════════
// F. Merchant controls that must NOT be clicked even when a hidden card IS present
//    (text-match is still restricted to Stripe Link-specific phrases)
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\n=== F. Merchant controls NOT mistaken for Stripe Link (hidden card) ===\n");

{
  const falsePositives = [
    // broad "different" variants
    "Use a different shipping address",
    "Use a different delivery method",
    "Different options available",
    "different",                       // bare word — too broad
    // "Change X" where X is not card/payment
    "Change address",
    "Change your plan",
    "Change plan",
    "Change subscription",
    "Change delivery",
    "change shipping",
    // partial payment match that should NOT fire
    "View payment details",
    "Payment added",
  ];
  const hiddenCard = [mkCard({ id: "cardNumber", type: "hidden" })];
  for (const label of falsePositives) {
    const b = [mkBtn(label)];
    // Hidden card present (guard passes) — text match must still reject these.
    const { result, buttons: bs } = await runDismiss(b, hiddenCard);
    assert(result === false,  "F: '" + label + "' → false (not a Link control)");
    assert(!bs[0].clicked,    "F: '" + label + "' button NOT clicked");
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// G. No button present → graceful false
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\n=== G. No button present — graceful false ===\n");

{
  const { result } = await runDismiss([], []);
  assert(result === false, "G1: no card, no button → false");

  // Card present but no button
  const { result: r2 } = await runDismiss([], [mkCard({ id: "cardNumber", type: "hidden" })]);
  assert(r2 === false, "G2: hidden card, no button → false");

  // Visible card, no button
  const { result: r3 } = await runDismiss([], [mkCard({ id: "cardNumber" })]);
  assert(r3 === false, "G3: visible card, no button → false");
}

// ═══════════════════════════════════════════════════════════════════════════════
// H. data-testid bypasses card-hidden guard
//    (data-testid path resolves before the card scan runs)
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\n=== H. data-testid bypasses card guard ===\n");

{
  // data-testid present even with visible card
  const b    = [mkBtn("Link dismiss", "link-change-payment-method")];
  const card = [mkCard({ id: "cardNumber", type: "text" })];
  const { result, buttons: bs } = await runDismiss(b, card);
  assert(result === true,  "H1: data-testid fires with visible card");
  assert(bs[0].clicked,    "H1: button was clicked");

  // data-testid present with no card inputs
  const b2 = [mkBtn("Link dismiss", "link-use-different-card")];
  const { result: r2, buttons: bs2 } = await runDismiss(b2, []);
  assert(r2 === true,  "H2: data-testid fires with no card");
  assert(bs2[0].clicked, "H2: button was clicked");
}

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log("\n" + "─".repeat(60));
console.log("Results: " + passed + " passed, " + failed + " failed");
if (failed > 0) process.exit(1);

} // end main

main().catch(function(err) { console.error(err); process.exit(1); });
