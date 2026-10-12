/**
 * basistheory-card-replacement.test.js
 *
 * Guards the Whop / Basis Theory card-replacement path:
 *
 *   1. interceptor.js (MAIN world, runs in BOTH the whop.com top frame and the
 *      js.basistheory.com hosted-element iframes) must:
 *      - treat api.basistheory.com as payment traffic (_0x8ce893 list),
 *      - compute the intercept gate from cardReplacement.gateways.basistheory,
 *      - swap { type:"card", data:{ number, expiration_month, expiration_year, cvc } }
 *        bodies from window.__SEMEX_PENDING_CARD with the same 3-min TTL and
 *        persistent semantics as the Stripe placeholder-mode swap,
 *      - be fail-safe: no shape match / no staged card / gateway off → no mutation,
 *      - honor the SEMEX_SESSION_RULES.xhrBypass.basistheory.enabled=false kill switch,
 *      - post a CARD_REPLACED toast so the operator sees the swap happened.
 *
 *   2. content.js must:
 *      - default cardReplacement.gateways.basistheory to true,
 *      - in the Basis Theory iframe fill branch: stage the REAL card via
 *        SEMEX_SET_PENDING_CARD and write a LUHN-VALID decoy (4111…, never zeros —
 *        BT elements validate client-side and would block the submit),
 *      - in the whop.com top-frame branch: stage the real card in the top window
 *        too (some BT SDK builds originate tokenize from the parent context).
 *
 * Structural assertions (the codebase's I-block style) — the live swap is
 * covered by manual verification on a real Whop checkout before release.
 */

"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const interceptorSrc = fs.readFileSync(path.join(ROOT, "main-world", "interceptor.js"), "utf8");
const contentSrc = fs.readFileSync(path.join(ROOT, "content", "content.js"), "utf8");
const popupSrc = fs.readFileSync(path.join(ROOT, "popup", "popup.js"), "utf8");
const dashHtml = fs.readFileSync(path.join(ROOT, "popup", "dashboard.html"), "utf8");

let failures = 0;
function assert(cond, label) {
  if (cond) console.log("  ✓  " + label);
  else { console.error("  ✗  " + label); failures++; }
}

// ── A. Interceptor: traffic classification + gate ────────────────────────────
console.log("\nA. Interceptor treats basistheory.com as payment traffic with its own gate");

assert(
  interceptorSrc.includes('_0x1239ce.includes("basistheory.com")'),
  "A1: basistheory.com added to the payment-API URL detection list"
);
assert(
  /gateways\?\.basistheory/.test(interceptorSrc),
  "A2: intercept gate reads cardReplacement.gateways.basistheory"
);
assert(
  /else if \(_0x1239ce\.includes\("basistheory\.com"\)\)/.test(interceptorSrc),
  "A3: dedicated gate branch for basistheory (CR-only, no CVV bypass coupling)"
);

// ── B. Interceptor: swap handler semantics ───────────────────────────────────
console.log("\nB. Basis Theory tokenize swap is shape-gated, staged-card-only, kill-switchable");

assert(
  interceptorSrc.includes("_0xbasisIsCardShape") &&
  /typeof _0xbasisData\.number === "string"/.test(interceptorSrc) &&
  interceptorSrc.includes('(!_0xbasisB.type || _0xbasisB.type === "card")'),
  "B1: swap only fires on the exact {type:'card', data:{number…}} tokenize shape"
);
assert(
  interceptorSrc.includes("_0xbasisPend = window.__SEMEX_PENDING_CARD"),
  "B2: replacement card comes from the staged __SEMEX_PENDING_CARD (set during fill), never generated fresh"
);
assert(
  /_0xbasisPend\.ts\) > 180000/.test(interceptorSrc.replace(/\n\s*/g, " ")) ||
  interceptorSrc.includes("Date.now() - window.__SEMEX_PENDING_CARD.ts) > 180000"),
  "B3: staged card expires after 3 min (no leftover swaps into unrelated requests)"
);
assert(
  interceptorSrc.includes('xhrBypass.basistheory') &&
  /_0xbasisRules\.enabled === false/.test(interceptorSrc),
  "B4: session-rules kill switch (xhrBypass.basistheory.enabled=false) is honored"
);
assert(
  interceptorSrc.includes('gateway: "Basis Theory"') &&
  interceptorSrc.includes('messageType: "CARD_REPLACED"'),
  "B5: CARD_REPLACED toast posted so the operator sees the swap happened"
);
assert(
  /_0xbasisY\.length === 2\)\s*_0xbasisY = "20" \+ _0xbasisY/.test(interceptorSrc.replace(/\n\s*/g, " ")),
  "B6: 2-digit years normalized to 4-digit (BT API expects expiration_year: 2026)"
);

// ── C. content.js: iframe branch stages real card + fills decoy ──────────────
console.log("\nC. content.js BT iframe branch: staged real card + luhn-valid decoy");

assert(
  contentSrc.includes("basistheory: true"),
  "C1: DEFAULT_SETTINGS cardReplacement.gateways.basistheory defaults to true"
);
const BT_BRANCH = contentSrc.slice(contentSrc.indexOf("Basis Theory hosted-element field iframe"), contentSrc.indexOf("no_bt_field_matched"));
assert(
  BT_BRANCH.includes('type: "SEMEX_SET_PENDING_CARD"') && BT_BRANCH.includes("persistent: true"),
  "C2: real card staged via SEMEX_SET_PENDING_CARD in the BT iframe window before decoy fill"
);
assert(
  BT_BRANCH.includes('_0x14ac05.cardNumber = "4111111111111111"') &&
  BT_BRANCH.includes('_0x14ac05.cvv = "123"'),
  "C3: visible decoy is luhn-valid 4111… (zeros would fail BT client-side validation and block submit)"
);
assert(
  BT_BRANCH.includes("_semexBtCr.gateways.basistheory !== false"),
  "C4: decoy+staging gated at the point of substitution (off → real values fill as before)"
);
assert(
  BT_BRANCH.includes("Promise.race") && BT_BRANCH.includes("_semexSettingsCache"),
  "C5: settings read is race-timeout guarded with last-known-good cache (fill-path storage stall invariant)"
);

// ── D. content.js: top-frame staging (parent-context tokenize builds) ────────
console.log("\nD. content.js whop.com top frame also stages the pending card");

assert(
  contentSrc.includes("_semexBtCrT") && contentSrc.includes("_eBtTop"),
  "D1: top-frame _semexHasBtFrames branch stages SEMEX_SET_PENDING_CARD when CR + basistheory gateway on"
);

// ── E. Popup: dashboard toggle wired ─────────────────────────────────────────
console.log("\nE. Dashboard exposes the Basis Theory gateway toggle");

assert(
  dashHtml.includes('id="card-replacement-basistheory"'),
  "E1: dashboard.html has the card-replacement-basistheory checkbox"
);
assert(
  popupSrc.includes('getElementById("card-replacement-basistheory").checked') &&
  popupSrc.includes('setSetting("cardReplacement.gateways.basistheory"'),
  "E2: popup.js hydrates + persists the basistheory gateway toggle"
);

// ── Result ───────────────────────────────────────────────────────────────────
console.log("\n" + (failures === 0 ? "ALL PASSED" : failures + " FAILED") + " — basistheory-card-replacement");
process.exit(failures === 0 ? 0 : 1);
