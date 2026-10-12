/**
 * braintree-status-parser.test.js
 *
 * Drives the REAL production STATUS_PARSER.parse() from status-parser.js —
 * the file is evaluated directly via Node.js eval() so any change to the
 * Braintree detection block in that file will be caught here immediately.
 *
 * Braintree response shapes covered:
 *   • GraphQL tokenizeCreditCard  (v3/v4 tokenization)
 *   • GraphQL chargePaymentMethod / createTransaction
 *   • REST creditCards array      (v2 client API)
 *   • Merchant result.success wrapper
 *   • Direct transaction.status strings (authorized/settled/processor_declined/…)
 *   • GraphQL top-level errors array
 *   • PayPal-hosted Braintree (client.bin.paypal.com)
 *   • False-positive guard: non-Braintree URLs must return null
 *
 * Run:  node semex/content/braintree-status-parser.test.js
 */

"use strict";

const fs   = require("fs");
const path = require("path");

// ── Load the real production status-parser.js ────────────────────────────────
const SRC_PATH = path.join(__dirname, "status-parser.js");
if (!fs.existsSync(SRC_PATH)) throw new Error("status-parser.js not found at " + SRC_PATH);

const PARSER_SRC = fs.readFileSync(SRC_PATH, "utf-8");

// status-parser.js declares `const STATUS_PARSER` at its top level.
// In a vm script, const/let are scoped to the script and do NOT surface as
// sandbox properties. The cleanest solution is a Function() wrapper: the real
// source runs as the function body, where const IS accessible, and a tacked-on
// return statement exposes the exports to the caller.
//
// Stubs injected as named parameters so window.top works without a global cycle.
const win = { location: { hostname: "test.example.com" } };
win.top = win;

// eslint-disable-next-line no-new-func
const loaderFn = new Function(
  "Object", "Array", "String", "Set", "window",
  PARSER_SRC + "\nreturn { STATUS_PARSER, StatusParserSetSessionRules };\n"
);
const { STATUS_PARSER, StatusParserSetSessionRules } =
  loaderFn(Object, Array, String, Set, win);

if (!STATUS_PARSER || typeof STATUS_PARSER.parse !== "function")
  throw new Error("STATUS_PARSER.parse not exported by status-parser.js");

// No session rules — same as fresh content-script load (fallback mode)
StatusParserSetSessionRules(null);

// ── Thin wrapper matching how content.js calls the parser ────────────────────
// content.js attaches _url to the response body before calling parse().
function parse(body, url) {
  const payload = Object.assign({}, body, { _url: url });
  return STATUS_PARSER.parse(payload, url);
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
function isNull(actual, name) {
  if (actual === null || actual === undefined) { console.log("  \u2713  " + name); passed++; }
  else { console.error("  \u2717  " + name + "  (expected null/undefined, got " + JSON.stringify(actual) + ")"); failed++; }
}
function isNotNull(actual, name) {
  if (actual !== null && actual !== undefined) { console.log("  \u2713  " + name); passed++; }
  else { console.error("  \u2717  " + name + "  (got null/undefined)"); failed++; }
}

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n=== Braintree Status Parser Tests (real STATUS_PARSER) ===\n");

const BT_GQL  = "https://payments.braintree-api.com/graphql";
const BT_REST = "https://api.braintreegateway.com/merchants/abc/client_api/v1/payment_methods/credit_cards";
const BT_PP   = "https://client.bin.paypal.com/v1/payment-tokens";

// ── URL detection ─────────────────────────────────────────────────────────────
console.log("\u2500\u2500 URL detection \u2500\u2500");

isNull(parse({ success: true }, "https://api.stripe.com/v1/payment_intents"),
  "Stripe URL with Braintree-shaped body \u2192 null (no false-positive)");
isNull(parse({ success: true }, "https://api.recurly.com/v2/accounts"),
  "Recurly URL \u2192 null");
isNotNull(parse({ success: true }, BT_GQL),
  "payments.braintree-api.com URL \u2192 not null");
isNotNull(parse({ success: true }, BT_REST),
  "braintreegateway.com URL \u2192 not null");
isNotNull(parse({ success: true }, BT_PP),
  "client.bin.paypal.com URL \u2192 not null");

// ── GraphQL tokenizeCreditCard ─────────────────────────────────────────────────
console.log("\n\u2500\u2500 GraphQL tokenizeCreditCard (v3/v4) \u2500\u2500");

eq(parse({
  data: { tokenizeCreditCard: { paymentMethod: { id: "tok_abc123", details: { bin: "411111" } } } }
}, BT_GQL), { status: "CHARGED", message: "Braintree Tokenized" },
  "tokenizeCreditCard with paymentMethod.id \u2192 CHARGED");

isNull(parse({
  data: { tokenizeCreditCard: { paymentMethod: null } }
}, BT_GQL),
  "tokenizeCreditCard paymentMethod null \u2192 null");

isNull(parse({ data: { tokenizeCreditCard: {} } }, BT_GQL),
  "tokenizeCreditCard empty paymentMethod \u2192 null");

// ── GraphQL chargePaymentMethod ───────────────────────────────────────────────
console.log("\n\u2500\u2500 GraphQL chargePaymentMethod \u2500\u2500");

eq(parse({
  data: { chargePaymentMethod: { transaction: { status: "AUTHORIZED" } } }
}, BT_GQL), { status: "CHARGED", message: "Braintree Charged" },
  "chargePaymentMethod AUTHORIZED \u2192 CHARGED");

eq(parse({
  data: { chargePaymentMethod: { transaction: { status: "SETTLED" } } }
}, BT_GQL), { status: "CHARGED", message: "Braintree Charged" },
  "chargePaymentMethod SETTLED \u2192 CHARGED");

eq(parse({
  data: { chargePaymentMethod: { transaction: { status: "SUBMITTED_FOR_SETTLEMENT" } } }
}, BT_GQL), { status: "CHARGED", message: "Braintree Charged" },
  "chargePaymentMethod SUBMITTED_FOR_SETTLEMENT \u2192 CHARGED");

eq(parse({
  data: { chargePaymentMethod: { transaction: { status: "PROCESSOR_DECLINED" } } }
}, BT_GQL), { status: "DEAD", message: "Braintree PROCESSOR_DECLINED" },
  "chargePaymentMethod PROCESSOR_DECLINED \u2192 DEAD");

eq(parse({
  data: { chargePaymentMethod: { transaction: { status: "FAILED" } } }
}, BT_GQL), { status: "DEAD", message: "Braintree FAILED" },
  "chargePaymentMethod FAILED \u2192 DEAD");

// ── GraphQL createTransaction ─────────────────────────────────────────────────
console.log("\n\u2500\u2500 GraphQL createTransaction \u2500\u2500");

eq(parse({
  data: { createTransaction: { transaction: { status: "AUTHORIZED" } } }
}, BT_GQL), { status: "CHARGED", message: "Braintree Charged" },
  "createTransaction AUTHORIZED \u2192 CHARGED");

eq(parse({
  data: { createTransaction: { transaction: { status: "GATEWAY_REJECTED" } } }
}, BT_GQL), { status: "DEAD", message: "Braintree GATEWAY_REJECTED" },
  "createTransaction GATEWAY_REJECTED \u2192 DEAD");

// ── REST tokenization (v2) ────────────────────────────────────────────────────
console.log("\n\u2500\u2500 REST tokenization (v2 client API) \u2500\u2500");

eq(parse({
  creditCards: [{ nonce: "nonce-abc", details: { bin: "411111", lastTwo: "11" } }]
}, BT_REST), { status: "CHARGED", message: "Braintree Tokenized" },
  "REST creditCards array present \u2192 CHARGED");

isNull(parse({ creditCards: [] }, BT_REST),
  "REST creditCards empty array \u2192 null");

isNull(parse({}, BT_REST),
  "REST no creditCards field \u2192 null");

// ── Merchant result.success wrapper ───────────────────────────────────────────
console.log("\n\u2500\u2500 Merchant result.success wrapper \u2500\u2500");

eq(parse({ result: { success: true } }, BT_GQL),
  { status: "CHARGED", message: "Braintree Charged" },
  "result.success true \u2192 CHARGED");

eq(parse({ success: true }, BT_GQL),
  { status: "CHARGED", message: "Braintree Charged" },
  "top-level success true \u2192 CHARGED");

eq(parse({
  result: { success: false, transaction: { processorResponseText: "Do Not Honor" } }
}, BT_GQL), { status: "DEAD", message: "Braintree Do Not Honor" },
  "result.success false + processorResponseText \u2192 DEAD with message");

eq(parse({
  result: {
    success: false,
    errors: { deepErrors: [{ code: "81501", message: "Amount is required" }] }
  }
}, BT_GQL), { status: "DEAD", message: "Braintree Amount is required" },
  "result.success false + deepErrors[0].message \u2192 DEAD with message");

eq(parse({ result: { success: false } }, BT_GQL),
  { status: "DEAD", message: "Braintree Declined" },
  "result.success false no detail \u2192 DEAD 'Declined'");

// ── Direct transaction.status ─────────────────────────────────────────────────
console.log("\n\u2500\u2500 Direct transaction.status \u2500\u2500");

eq(parse({ transaction: { status: "authorized" } }, BT_GQL),
  { status: "CHARGED", message: "Braintree Charged" },
  "transaction.status 'authorized' (lowercase) \u2192 CHARGED");

eq(parse({ transaction: { status: "settled" } }, BT_GQL),
  { status: "CHARGED", message: "Braintree Charged" },
  "transaction.status 'settled' \u2192 CHARGED");

eq(parse({ transaction: { status: "submitted_for_settlement" } }, BT_GQL),
  { status: "CHARGED", message: "Braintree Charged" },
  "transaction.status 'submitted_for_settlement' \u2192 CHARGED");

// "Insufficient Funds" on processor_declined is a live-card signal (CCN_LIVE), not a dead card.
eq(parse({
  transaction: { status: "processor_declined", processorResponseText: "Insufficient Funds" }
}, BT_GQL), { status: "CCN_LIVE", message: "Braintree Insufficient Funds" },
  "transaction.status 'processor_declined' + 'Insufficient Funds' \u2192 CCN_LIVE (live card)");

eq(parse({ transaction: { status: "gateway_rejected" } }, BT_GQL),
  { status: "DEAD", message: "Braintree gateway_rejected" },
  "transaction.status 'gateway_rejected' \u2192 DEAD");

eq(parse({ transaction: { status: "failed" } }, BT_GQL),
  { status: "DEAD", message: "Braintree failed" },
  "transaction.status 'failed' \u2192 DEAD");

// ── GraphQL top-level errors ──────────────────────────────────────────────────
console.log("\n\u2500\u2500 GraphQL top-level errors \u2500\u2500");

eq(parse({
  errors: [{ message: "Card number is invalid.", locations: [], path: ["tokenizeCreditCard"] }]
}, BT_GQL), { status: "DEAD", message: "Braintree Card number is invalid." },
  "errors[0].message \u2192 DEAD with message");

eq(parse({ errors: [{}] }, BT_GQL),
  { status: "DEAD", message: "Braintree Error" },
  "errors[0] empty \u2192 DEAD 'Error'");

// ── PayPal-hosted Braintree ───────────────────────────────────────────────────
console.log("\n\u2500\u2500 PayPal-hosted (client.bin.paypal.com) \u2500\u2500");

eq(parse({
  data: { tokenizeCreditCard: { paymentMethod: { id: "paypal-tok-xyz" } } }
}, BT_PP), { status: "CHARGED", message: "Braintree Tokenized" },
  "client.bin.paypal.com tokenizeCreditCard \u2192 CHARGED");

eq(parse({ transaction: { status: "settled" } }, BT_PP),
  { status: "CHARGED", message: "Braintree Charged" },
  "client.bin.paypal.com settled transaction \u2192 CHARGED");

// ── Edge cases ────────────────────────────────────────────────────────────────
console.log("\n\u2500\u2500 Edge cases \u2500\u2500");

isNull(parse({}, BT_GQL),
  "empty body on Braintree URL \u2192 null");

isNull(parse({ someOtherField: "value" }, BT_GQL),
  "unrecognised response shape \u2192 null (no false-positive)");

// Braintree-shaped body on a non-Braintree URL must never fire
isNull(parse({
  data: { tokenizeCreditCard: { paymentMethod: { id: "tok_abc" } } }
}, "https://example.com/checkout"),
  "tokenizeCreditCard shape on non-Braintree URL \u2192 null");

// ── Summary ───────────────────────────────────────────────────────────────────
console.log("\n" + "\u2500".repeat(60));
console.log("  " + passed + " passed, " + failed + " failed");
if (failed > 0) {
  console.error("\nSome tests failed \u2014 see above.");
  process.exit(1);
} else {
  console.log("  All tests passed \u2713");
}
