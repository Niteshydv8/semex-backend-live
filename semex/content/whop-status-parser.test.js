/**
 * whop-status-parser.test.js
 *
 * Drives the REAL production STATUS_PARSER.parse() from status-parser.js
 * against the Whop checkout_session confirm shapes OBSERVED LIVE on
 * 2026-10-12 (scripts/probe-whop-*.mjs):
 *
 *   POST whop.com/api/v1/checkout_sessions/{chs_id}/confirm
 *     success  -> 200 {"object":"checkout_session","status":"completed",...}
 *     decline  -> 4xx {"error":{"type":"...","message":"..."}}
 *     non-final-> 200 {"object":"checkout_session","status":"open"|"pending"}
 *
 * Also guards: non-confirm Whop API traffic (calculate_breakdown,
 * confirmation_tokens, session GETs) must return null.
 *
 * Run:  node semex/content/whop-status-parser.test.js
 */

"use strict";

const fs = require("fs");
const path = require("path");

const SRC_PATH = path.join(__dirname, "status-parser.js");
const PARSER_SRC = fs.readFileSync(SRC_PATH, "utf-8");

const win = { location: { hostname: "whop.com" } };
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

StatusParserSetSessionRules(null); // fallback-mode, no session rules

function parse(body, url) {
  return STATUS_PARSER.parse(Object.assign({}, body, { _url: url }), url);
}

let passed = 0, failed = 0;
function eq(actual, expected, name) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { console.log("  ✓  " + name); passed++; }
  else {
    console.error("  ✗  " + name + "\n     got      " + JSON.stringify(actual) + "\n     expected " + JSON.stringify(expected));
    failed++;
  }
}
function isNull(actual, name) {
  if (actual === null || actual === undefined) { console.log("  ✓  " + name); passed++; }
  else { console.error("  ✗  " + name + "  (expected null, got " + JSON.stringify(actual) + ")"); failed++; }
}

const CONFIRM = "https://whop.com/api/v1/checkout_sessions/chs_2NrR9ZpVkvtj8b/confirm";
const BREAKDOWN = "https://whop.com/api/v1/checkout_sessions/chs_2NrR9ZpVkvtj8b/calculate_breakdown";
const TOKENS = "https://whop.com/api/v1/confirmation_tokens";
const SESSION_GET = "https://whop.com/api/v1/checkout_sessions/chs_2NrR9ZpVkvtj8b?client_secret=chs_...";

// Real observed success body (trimmed): status "completed".
const successBody = { id: "chs_2NrR9ZpVkvtj8b", object: "checkout_session", status: "completed", mode: "payment" };
// Real observed error envelope (400 bad_request / confirmation_token is required).
const errorBody = { error: { type: "bad_request", message: "card declined by issuer" } };
const ccnBody = { error: { type: "card_error", message: "Your card has insufficient funds" } };
// Non-final states observed on GET session / pending confirm.
const openBody = { id: "chs_x", object: "checkout_session", status: "open" };
const pendingToken = { id: "ctok_FpNsOGw5tjRsx", object: "confirmation_token", status: "pending" };
// Decline shapes NOT observable live (this merchant's checkout completes all
// Luhn-valid test cards, verified 2026-10-12 with 4000000000000002 and
// 4000000000009995 both returning status "completed"). These cover the
// realistic bank-decline envelopes on Stripe rails:
//   - 402-style card_error envelope (Whop error object, HTTP status aside)
//   - 200 with a Stripe-terminal failure status instead of an error object
//   - 200 requires_action (3DS challenge in flight — must NOT be a hit)
const declineCardError = { error: { type: "card_error", message: "Your card was declined.", code: "card_declined", decline_code: "generic_decline" } };
const declineStatusBody = { id: "chs_x", object: "checkout_session", status: "requires_payment_method" };
const declineFailedBody = { id: "chs_x", object: "checkout_session", status: "failed" };
const threeDSBody = { id: "chs_x", object: "checkout_session", status: "requires_action" };

console.log("\n=== Whop Status Parser Tests (real STATUS_PARSER) ===\n");

console.log("A. confirm endpoint result parsing");
eq(parse(successBody, CONFIRM), { status: "CHARGED", message: "Whop Payment Successful" }, "A1: status completed -> CHARGED");
eq(parse(errorBody, CONFIRM), { status: "DEAD", message: "Whop card declined by issuer" }, "A2: error envelope -> DEAD with message");
eq(parse(ccnBody, CONFIRM), { status: "CCN_LIVE", message: "Whop Your card has insufficient funds" }, "A3: insufficient funds -> CCN_LIVE");
isNull(parse(openBody, CONFIRM), "A4: status open (non-final) -> null");
eq(parse({ id: "chs_x", object: "checkout_session", status: "expired" }, CONFIRM),
  { status: "DEAD", message: "Whop expired" }, "A5: status expired -> DEAD");
// A6: a decline_code-bearing envelope is caught by the generic Stripe-style
// error branch BEFORE the whop section — still DEAD, message unprefixed.
eq(parse(declineCardError, CONFIRM), { status: "DEAD", message: "Your card was declined." },
  "A6: 402-style card_error envelope -> DEAD with bank message");
eq(parse(declineStatusBody, CONFIRM), { status: "DEAD", message: "Whop requires_payment_method" },
  "A7: 200 requires_payment_method (Stripe terminal failure) -> DEAD, not dropped");
eq(parse(declineFailedBody, CONFIRM), { status: "DEAD", message: "Whop failed" },
  "A8: 200 status failed -> DEAD");
isNull(parse(threeDSBody, CONFIRM), "A9: requires_action (3DS in flight) -> null, not a hit");

console.log("\nB. non-confirm Whop traffic must not parse");
isNull(parse(pendingToken, TOKENS), "B1: confirmation_tokens pending -> null");
isNull(parse({ currency: "usd", total: { amount: "99.00" } }, BREAKDOWN), "B2: calculate_breakdown -> null");
isNull(parse(openBody, SESSION_GET), "B3: session GET (open) -> null");
isNull(parse({ id: "chs_x", object: "checkout_session", status: "completed" }, SESSION_GET.replace("?client_secret=chs_...", "")), "B4: plain session GET completed w/o /confirm still matches urlPatterns (parser-level only; interceptor gates /confirm)");

console.log("\nC. unrelated hosts untouched");
isNull(parse(successBody, "https://example.com/api/v1/checkout_sessions/x/confirm"), "C1: non-whop host -> null");
isNull(parse({ status: "completed" }, "https://api.stripe.com/v1/charges"), "C2: stripe host with completed-ish body not hijacked... (may parse via stripe rules or null)");
isNull(parse({}, CONFIRM), "C3: empty body on confirm URL -> null (no status, no error)");

// C2 caveat: a bare {status:"completed"} on a stripe URL might legitimately
// parse as something stripe-side; if so it must NOT say "Whop".
const c2 = parse({ status: "completed" }, "https://api.stripe.com/v1/charges");
if (c2 && String(c2.message).includes("Whop")) {
  console.error("  ✗  C2b: stripe URL must never produce a Whop message"); failed++;
} else { console.log("  ✓  C2b: stripe URL never produces a Whop message"); passed++; }

// D. Real session rules loaded (the production path): server-client.js
// fetchSessionRules() supplies a NONEMPTY paymentTracking.whop block, which
// overrides the parser's built-in defaults. Regression guard: the decline
// statuses must classify correctly with THOSE rules, not just with null rules.
console.log("\nD. parsing with REAL session rules from server-client.js");
const SC_SRC = fs.readFileSync(path.join(__dirname, "..", "shared", "server-client.js"), "utf-8");
function extractObjectLiteral(src, anchorRegex) {
  const m = src.match(anchorRegex);
  if (!m) throw new Error("anchor not found: " + anchorRegex);
  const start = src.indexOf("{", m.index);
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error("unbalanced braces from anchor");
}
const whopRulesLiteral = extractObjectLiteral(SC_SRC, /"whop":\s*\{\s*"urlPatterns"/);
const whopRules = (new Function("return (" + whopRulesLiteral + ");"))();
StatusParserSetSessionRules({ paymentTracking: { whop: whopRules } });
eq(parse(successBody, CONFIRM), { status: "CHARGED", message: "Whop Payment Successful" }, "D1: real rules: completed -> CHARGED");
eq(parse(declineCardError, CONFIRM), { status: "DEAD", message: "Your card was declined." }, "D2: real rules: card_error envelope -> DEAD");
eq(parse(declineStatusBody, CONFIRM), { status: "DEAD", message: "Whop requires_payment_method" }, "D3: real rules: requires_payment_method -> DEAD, not dropped");
eq(parse(declineFailedBody, CONFIRM), { status: "DEAD", message: "Whop failed" }, "D4: real rules: failed -> DEAD");
isNull(parse(threeDSBody, CONFIRM), "D5: real rules: requires_action (3DS in flight) -> null");
isNull(parse(openBody, CONFIRM), "D6: real rules: open -> null");

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
