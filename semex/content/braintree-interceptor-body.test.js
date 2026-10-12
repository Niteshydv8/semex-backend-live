/**
 * braintree-interceptor-body.test.js
 *
 * Drives the REAL Braintree CVV-bypass / card-replacement block extracted
 * verbatim from semex/main-world/interceptor.js.  The block is located by
 * its source comment marker so any production change is picked up immediately.
 *
 * The vm context mirrors every variable the block references:
 *   _0x1239ce  — request URL
 *   _0x4f3296  — previous response (null = session rules didn't intercept yet)
 *   _0x45460c  — request init {body, headers}
 *   _0x2c78d4  — SEMEX_SETTINGS
 *   _0x1f93e0  — cvvBypass.enabled flag
 *   window     — provides __SEMEX_CURRENT_CARD, __LAST_CAPTURED_CARD, postMessage
 *
 * Scenarios covered:
 *   • URL detection: which domains activate the handler
 *   • !_0x4f3296 guard: handler is skipped when session rules already responded
 *   • JSON CVV bypass: cvv deleted from variables.input.creditCard / nested paths
 *   • JSON card replacement: number/expirationMonth/expirationYear swapped
 *   • __LAST_CAPTURED_CARD fallback when __SEMEX_CURRENT_CARD is null
 *   • URL-encoded CVV strip (percent-encoded and bracket syntax)
 *   • BYPASS_ACTIVATED / CARD_REPLACED postMessage payloads
 *   • All bypasses disabled → body unchanged
 *
 * Run:  node semex/content/braintree-interceptor-body.test.js
 */

"use strict";

const fs   = require("fs");
const path = require("path");
const vm   = require("vm");

// ── Load and extract the Braintree handler block from interceptor.js ──────────

const INTERCEPTOR_PATH = path.join(__dirname, "../main-world/interceptor.js");
if (!fs.existsSync(INTERCEPTOR_PATH))
  throw new Error("interceptor.js not found at " + INTERCEPTOR_PATH);

const INTERCEPTOR_SRC = fs.readFileSync(INTERCEPTOR_PATH, "utf-8");

const BLOCK_START_MARKER = "// ── Braintree CVV / card-replacement bypass (session-rules-driven with hardcoded fallback) ──";
const blockStart = INTERCEPTOR_SRC.indexOf(BLOCK_START_MARKER);
if (blockStart === -1)
  throw new Error("Braintree block not found in interceptor.js (marker: '" + BLOCK_START_MARKER + "')");

// Walk forward from the marker to find the opening `{` of the block, then
// count braces to locate the matching `}`.
let i = blockStart + BLOCK_START_MARKER.length;
while (i < INTERCEPTOR_SRC.length && INTERCEPTOR_SRC[i] !== "{") i++;
let depth = 0, blockEnd = i;
while (blockEnd < INTERCEPTOR_SRC.length) {
  if      (INTERCEPTOR_SRC[blockEnd] === "{") depth++;
  else if (INTERCEPTOR_SRC[blockEnd] === "}") { depth--; if (depth === 0) { blockEnd++; break; } }
  blockEnd++;
}
const BT_BLOCK = INTERCEPTOR_SRC.slice(blockStart, blockEnd);

// Sanity-check: the block must contain key identifiers we depend on
for (const sig of ["_0xbtIsGw", "_0x4f3296", "__SEMEX_CURRENT_CARD", "__LAST_CAPTURED_CARD", "BYPASS_ACTIVATED"]) {
  if (!BT_BLOCK.includes(sig))
    throw new Error("Expected '" + sig + "' to appear in extracted Braintree block");
}

// ── vm harness ────────────────────────────────────────────────────────────────

/**
 * Run the production Braintree handler block in an isolated vm context.
 *
 * @param {object} opts
 *   url             — request URL string
 *   body            — request body string
 *   contentType     — content-type header value (default "application/json")
 *   prevResponse    — value of _0x4f3296 (null = not yet responded by session rules)
 *   settings        — SEMEX_SETTINGS object
 *   cvvEnabled      — _0x1f93e0 (cvvBypass.enabled master flag)
 *   currentCard     — window.__SEMEX_CURRENT_CARD
 *   lastCapturedCard — window.__LAST_CAPTURED_CARD
 * @returns {{ body: string, messages: object[] }}
 */
function runBraintreeHandler({
  url,
  body,
  contentType = "application/json",
  prevResponse = null,
  settings = {
    cvvBypass:       { enabled: true,  gateways: { braintree: true  } },
    cardReplacement: { enabled: false, gateways: { braintree: false } }
  },
  cvvEnabled = !!(settings.cvvBypass && settings.cvvBypass.enabled),
  currentCard = null,
  lastCapturedCard = null,
  sessionRules = null,  // window.SEMEX_SESSION_RULES — null means no rules loaded
} = {}) {
  const messages = [];

  const ctx = vm.createContext({
    JSON,
    RegExp,
    // Production variable bindings
    _0x1239ce: url,
    _0x4f3296: prevResponse,
    _0x45460c: { body, headers: { "content-type": contentType } },
    _0x2c78d4: settings,
    _0x1f93e0: cvvEnabled,
    window: {
      SEMEX_SESSION_RULES:    sessionRules,
      __SEMEX_CURRENT_CARD:   currentCard,
      __LAST_CAPTURED_CARD:   lastCapturedCard,
      postMessage(msg) { messages.push(msg); },
    },
    // Result capture
    __body__:     null,
    __messages__: messages,
  });

  // Run the extracted block, then capture the (possibly modified) body
  const script = new vm.Script(`
${BT_BLOCK}
__body__ = _0x45460c.body;
`);
  script.runInContext(ctx);

  return { body: ctx.__body__, messages };
}

// ── Test harness ──────────────────────────────────────────────────────────────
let passed = 0, failed = 0;

function eq(actual, expected, name) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { console.log("  \u2713  " + name); passed++; }
  else {
    console.error("  \u2717  " + name +
      "\n     got      " + JSON.stringify(actual) +
      "\n     expected " + JSON.stringify(expected));
    failed++;
  }
}
function assert(cond, name) {
  if (cond) { console.log("  \u2713  " + name); passed++; }
  else       { console.error("  \u2717  " + name); failed++; }
}

const BT_GQL  = "https://payments.braintree-api.com/graphql";
const BT_REST = "https://api.braintreegateway.com/merchants/abc/client_api/v1/payment_methods/credit_cards";
const BT_PP   = "https://client.bin.paypal.com/v1/payment-tokens";

const CVV_ON = {
  cvvBypass:       { enabled: true,  gateways: { braintree: true  } },
  cardReplacement: { enabled: false, gateways: { braintree: false } }
};
const CR_ON = {
  cvvBypass:       { enabled: true,  gateways: { braintree: true  } },
  cardReplacement: { enabled: true,  gateways: { braintree: true  } }
};
const ALL_OFF = {
  cvvBypass:       { enabled: false, gateways: { braintree: false } },
  cardReplacement: { enabled: false, gateways: { braintree: false } }
};
const REPLACEMENT_CARD = { number: "5555555555554444", exp_month: "06", exp_year: "2027", cvc: "123" };

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n=== Braintree Interceptor Body-Modification Tests (real block) ===\n");

// ── URL detection ─────────────────────────────────────────────────────────────
console.log("\u2500\u2500 URL detection \u2500\u2500");

{
  const plain = JSON.stringify({ variables: { input: { creditCard: { number: "4111111111111111", cvv: "123" } } } });

  // Non-Braintree URL: body must be untouched
  const nonBt = runBraintreeHandler({ url: "https://api.stripe.com/v1/payment_intents", body: plain, settings: CVV_ON });
  eq(nonBt.body, plain, "Non-Braintree URL: body unchanged");
  eq(nonBt.messages, [], "Non-Braintree URL: no postMessages");

  // All three Braintree domains must activate the handler
  const btGql = runBraintreeHandler({ url: BT_GQL,  body: plain, settings: CVV_ON });
  assert(!JSON.parse(btGql.body).variables.input.creditCard.cvv, "payments.braintree-api.com: CVV removed");

  const btGw = runBraintreeHandler({ url: BT_REST, body: plain, settings: CVV_ON, contentType: "application/json" });
  assert(!JSON.parse(btGw.body).variables.input.creditCard.cvv, "braintreegateway.com: CVV removed");

  const btPP = runBraintreeHandler({ url: BT_PP, body: plain, settings: CVV_ON });
  assert(!JSON.parse(btPP.body).variables.input.creditCard.cvv, "client.bin.paypal.com: CVV removed");
}

// ── !_0x4f3296 guard: session rules already responded ────────────────────────
console.log("\n\u2500\u2500 !_0x4f3296 guard (session rules already handled request) \u2500\u2500");

{
  const plain = JSON.stringify({ variables: { input: { creditCard: { cvv: "999" } } } });
  // Simulate session rules having already set a response object
  const fakeResponse = { status: 200, clone() { return this; } };
  const { body: out, messages } = runBraintreeHandler({
    url: BT_GQL, body: plain, settings: CVV_ON, prevResponse: fakeResponse
  });
  // Block must be skipped entirely
  eq(out, plain, "prevResponse set: body not modified (handler skipped)");
  eq(messages, [], "prevResponse set: no postMessages fired");
}

// ── JSON CVV bypass ───────────────────────────────────────────────────────────
console.log("\n\u2500\u2500 JSON: CVV bypass \u2500\u2500");

{
  const body = JSON.stringify({
    variables: { input: { creditCard: { number: "4111111111111111", expirationMonth: "12", expirationYear: "2025", cvv: "999" } } }
  });
  const { body: out, messages } = runBraintreeHandler({ url: BT_GQL, body, settings: CVV_ON });
  const cc = JSON.parse(out).variables.input.creditCard;
  assert(cc.cvv === undefined, "CVV bypass: cvv removed");
  assert(cc.number === "4111111111111111", "CVV bypass: card number preserved");
  assert(messages.some(m => m.messageType === "BYPASS_ACTIVATED"), "CVV bypass: BYPASS_ACTIVATED posted");
  assert(messages.find(m => m.messageType === "BYPASS_ACTIVATED").gateway === "BRAINTREE",
    "CVV bypass: BYPASS_ACTIVATED has gateway=BRAINTREE");
}

{
  // No cvv field — body not modified, but BYPASS_ACTIVATED still fires (cvv was on)
  const body = JSON.stringify({ variables: { input: { creditCard: { number: "4111111111111111" } } } });
  const { body: out, messages } = runBraintreeHandler({ url: BT_GQL, body, settings: CVV_ON });
  assert(JSON.parse(out).variables.input.creditCard.cvv === undefined, "No cvv field: still absent after run");
  assert(JSON.parse(out).variables.input.creditCard.number === "4111111111111111", "No cvv field: number preserved");
}

// ── Nested payment.creditCard path ────────────────────────────────────────────
console.log("\n\u2500\u2500 JSON: nested payment.creditCard path \u2500\u2500");

{
  const body = JSON.stringify({ variables: { input: { payment: { creditCard: { number: "4111111111111111", cvv: "456" } } } } });
  const { body: out } = runBraintreeHandler({ url: BT_GQL, body, settings: CVV_ON });
  const cc = JSON.parse(out).variables.input.payment.creditCard;
  assert(cc.cvv === undefined, "Nested payment.creditCard: cvv removed");
  assert(cc.number === "4111111111111111", "Nested payment.creditCard: number preserved");
}

// ── Top-level creditCard field ────────────────────────────────────────────────
console.log("\n\u2500\u2500 JSON: top-level creditCard field \u2500\u2500");

{
  const body = JSON.stringify({ creditCard: { number: "378282246310005", cvv: "1234" } });
  const { body: out } = runBraintreeHandler({ url: BT_GQL, body, settings: CVV_ON });
  const cc = JSON.parse(out).creditCard;
  assert(cc.cvv === undefined, "Top-level creditCard.cvv removed");
  assert(cc.number === "378282246310005", "Top-level creditCard.number preserved");
}

// ── Card replacement ──────────────────────────────────────────────────────────
console.log("\n\u2500\u2500 JSON: card replacement (__SEMEX_CURRENT_CARD) \u2500\u2500");

{
  const body = JSON.stringify({
    variables: { input: { creditCard: { number: "4242424242424242", expirationMonth: "01", expirationYear: "2024", cvv: "100" } } }
  });
  const { body: out, messages } = runBraintreeHandler({
    url: BT_GQL, body, settings: CR_ON, currentCard: REPLACEMENT_CARD
  });
  const cc = JSON.parse(out).variables.input.creditCard;
  eq(cc.number, REPLACEMENT_CARD.number, "Card replacement: number swapped");
  eq(cc.expirationMonth, REPLACEMENT_CARD.exp_month, "Card replacement: expirationMonth swapped");
  eq(cc.expirationYear, String(REPLACEMENT_CARD.exp_year), "Card replacement: expirationYear swapped");
  assert(cc.cvv === undefined, "Card replacement + CVV on: cvv stripped from replaced card");
  assert(messages.some(m => m.messageType === "CARD_REPLACED"), "Card replacement: CARD_REPLACED posted");
  assert(messages.some(m => m.messageType === "BYPASS_ACTIVATED"), "Card replacement: BYPASS_ACTIVATED also posted");
  eq(messages.find(m => m.messageType === "CARD_REPLACED").gateway, "Braintree",
    "CARD_REPLACED message has gateway=Braintree");
}

// ── __LAST_CAPTURED_CARD fallback (currentCard is null) ───────────────────────
console.log("\n\u2500\u2500 JSON: __LAST_CAPTURED_CARD fallback \u2500\u2500");

{
  const body = JSON.stringify({
    variables: { input: { creditCard: { number: "4242424242424242", cvv: "100" } } }
  });
  const { body: out, messages } = runBraintreeHandler({
    url: BT_GQL, body, settings: CR_ON,
    currentCard: null,
    lastCapturedCard: REPLACEMENT_CARD  // __SEMEX_CURRENT_CARD is null but __LAST_CAPTURED_CARD has a card
  });
  const cc = JSON.parse(out).variables.input.creditCard;
  eq(cc.number, REPLACEMENT_CARD.number, "__LAST_CAPTURED_CARD fallback: number swapped");
  assert(messages.some(m => m.messageType === "CARD_REPLACED"), "__LAST_CAPTURED_CARD fallback: CARD_REPLACED posted");
}

{
  // Both currentCard and lastCapturedCard null: no replacement
  const body = JSON.stringify({ variables: { input: { creditCard: { number: "4242424242424242", cvv: "100" } } } });
  const { body: out } = runBraintreeHandler({
    url: BT_GQL, body, settings: CR_ON, currentCard: null, lastCapturedCard: null
  });
  eq(JSON.parse(out).variables.input.creditCard.number, "4242424242424242",
    "Both card sources null: original number preserved");
}

// ── Card replacement disabled ─────────────────────────────────────────────────
console.log("\n\u2500\u2500 JSON: card replacement disabled \u2500\u2500");

{
  const body = JSON.stringify({ variables: { input: { creditCard: { number: "4242424242424242", cvv: "100" } } } });
  const { body: out } = runBraintreeHandler({
    url: BT_GQL, body, settings: CVV_ON, currentCard: REPLACEMENT_CARD
  });
  eq(JSON.parse(out).variables.input.creditCard.number, "4242424242424242",
    "Card replacement disabled: original number preserved");
}

// ── URL-encoded CVV bypass ────────────────────────────────────────────────────
console.log("\n\u2500\u2500 URL-encoded: CVV strip \u2500\u2500");

{
  const body = "credit_card%5Bnumber%5D=4111111111111111&credit_card%5Bexpiration_month%5D=12&credit_card%5Bcvv%5D=999";
  const { body: out } = runBraintreeHandler({
    url: BT_REST, body, contentType: "application/x-www-form-urlencoded", settings: CVV_ON
  });
  assert(!out.includes("cvv"), "URL-encoded percent-encoded: credit_card%5Bcvv%5D stripped");
  assert(out.includes("4111111111111111"), "URL-encoded percent-encoded: card number preserved");
  assert(!out.startsWith("&"), "URL-encoded: no leading ampersand after strip");
}

{
  const body = "credit_card[number]=4111111111111111&credit_card[expiration_month]=12&credit_card[cvv]=999";
  const { body: out } = runBraintreeHandler({
    url: BT_REST, body, contentType: "application/x-www-form-urlencoded", settings: CVV_ON
  });
  assert(!out.includes("[cvv]"), "URL-encoded bracket syntax: credit_card[cvv] stripped");
  assert(out.includes("4111111111111111"), "URL-encoded bracket: card number preserved");
}

{
  // CVV at string start — no leading & after strip
  const body = "credit_card%5Bcvv%5D=999&credit_card%5Bnumber%5D=4111111111111111";
  const { body: out } = runBraintreeHandler({
    url: BT_REST, body, contentType: "application/x-www-form-urlencoded", settings: CVV_ON
  });
  assert(!out.includes("cvv"), "CVV at string start: stripped");
  assert(!out.startsWith("&"), "CVV at string start: no orphan leading ampersand");
}

{
  // CVV bypass disabled: URL-encoded body unchanged
  const body = "credit_card%5Bnumber%5D=4111111111111111&credit_card%5Bcvv%5D=999";
  const { body: out } = runBraintreeHandler({
    url: BT_REST, body, contentType: "application/x-www-form-urlencoded", settings: ALL_OFF
  });
  eq(out, body, "CVV bypass disabled: URL-encoded body unchanged");
}

// ── Session rule enabled=false disables entire block ─────────────────────────
console.log("\n\u2500\u2500 Session rule enabled=false \u2500\u2500");

{
  const body = JSON.stringify({ variables: { input: { creditCard: { number: "4111111111111111", cvv: "123" } } } });
  // Even with CVV bypass ON in settings, enabled=false in session rules must prevent any mutation
  const disabledRules = {
    xhrBypass: { braintree: { enabled: false, cvvField: "cvv", creditCardPaths: ["variables.input.creditCard"] } },
    cardReplacementParams: { braintree: {} }
  };
  const { body: out, messages } = runBraintreeHandler({ url: BT_GQL, body, settings: CVV_ON, sessionRules: disabledRules });
  eq(out, body, "Session rule enabled=false: body unchanged despite CVV bypass ON");
  eq(messages, [], "Session rule enabled=false: no postMessages fired");
}

{
  // enabled=true in session rules with custom cvvField confirms configurable field name
  const body = JSON.stringify({ variables: { input: { creditCard: { number: "4111111111111111", cvc2: "123" } } } });
  const customRules = {
    xhrBypass: { braintree: { enabled: true, cvvField: "cvc2", creditCardPaths: ["variables.input.creditCard"], urlEncodedTargets: [] } },
    cardReplacementParams: { braintree: { number: "number", exp_month: "expirationMonth", exp_year: "expirationYear", cvv: "cvc2" } }
  };
  const { body: out } = runBraintreeHandler({ url: BT_GQL, body, settings: CVV_ON, sessionRules: customRules });
  const cc = JSON.parse(out).variables.input.creditCard;
  assert(cc.cvc2 === undefined, "Custom cvvField 'cvc2': removed when enabled=true");
  assert(cc.number === "4111111111111111", "Custom cvvField: number preserved");
}

// ── All bypasses disabled ─────────────────────────────────────────────────────
console.log("\n\u2500\u2500 All bypasses disabled \u2500\u2500");

{
  const body = JSON.stringify({ variables: { input: { creditCard: { number: "4111111111111111", cvv: "123" } } } });
  const { body: out, messages } = runBraintreeHandler({ url: BT_GQL, body, settings: ALL_OFF });
  eq(out, body, "All off: JSON body unchanged");
  eq(messages, [], "All off: no postMessages");
}

// ── postMessage payload shapes ────────────────────────────────────────────────
console.log("\n\u2500\u2500 postMessage payload verification \u2500\u2500");

{
  const body = JSON.stringify({ variables: { input: { creditCard: { cvv: "123" } } } });
  const { messages } = runBraintreeHandler({ url: BT_GQL, body, settings: CVV_ON });
  const bypassMsg = messages.find(m => m.messageType === "BYPASS_ACTIVATED");
  assert(!!bypassMsg, "BYPASS_ACTIVATED message present");
  assert(bypassMsg && bypassMsg.type === "SEMEX_TOAST", "BYPASS_ACTIVATED has type=SEMEX_TOAST");
  assert(bypassMsg && Array.isArray(bypassMsg.bypassTypes) && bypassMsg.bypassTypes.includes("CVV"),
    "BYPASS_ACTIVATED has bypassTypes including CVV");
  assert(bypassMsg && bypassMsg.url === BT_GQL, "BYPASS_ACTIVATED has correct url");
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log("\n" + "\u2500".repeat(60));
console.log("  " + passed + " passed, " + failed + " failed");
if (failed > 0) {
  console.error("\nSome tests failed \u2014 see above.");
  process.exit(1);
} else {
  console.log("  All tests passed \u2713");
}
