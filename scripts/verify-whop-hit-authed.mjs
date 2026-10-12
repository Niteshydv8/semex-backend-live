// Authenticated end-to-end verification of the Whop CHARGED hit pipeline.
//
// verify-whop-hit.mjs proves a Whop hit survives the background false-hit
// guard and REACHES submitStatus, but it runs unauthenticated, so the
// server -> Telegram forward half is unverified. This variant closes that gap:
//
//   1. Boots a REAL backend locally (mongod + uvicorn :8001) with a seeded
//      user + session (mirrors backend/tests/conftest.py).
//   2. Copies semex-build to a temp dir and patches ONLY the API base URL
//      constants to http://127.0.0.1:8001 (semex-build itself is never edited).
//   3. Seeds the extension's obfuscated auth storage keys (__xatk/__xrtk/
//      __xsid/__xupf) in the live service worker — same keys verify-otp writes.
//   4. Drives the REAL Whop checkout through the extension's own fill path
//      (SEMEX_FILL_FORM with an explicit card — never manual iframe typing).
//   5. Asserts: CHARGED detected, submitStatus got HTTP 2xx from the backend,
//      the hit row persisted in db.hits, and a durable telegram_outbox entry
//      was enqueued (proof the server->Telegram forward fired).
//
// Two modes:
//   default (enqueue-only): dummy bot token — proves the hit was accepted,
//     persisted, and durably enqueued to the Telegram outbox for THIS
//     submission (matched by submitId) at BOTH destinations (user DM +
//     admin-log channel). Telegram delivery itself is not attempted.
//   SEMEX_VERIFY_TG_TOKEN + SEMEX_VERIFY_TG_CHAT set (full-delivery): uses a
//     real test bot token + chat, waits for the outbox worker, and requires
//     this submission's user-DM outbox row to reach status "delivered"
//     (Telegram accepted the send). Use a dedicated test bot/chat.
//
// Run: node scripts/verify-whop-hit-authed.mjs
//      SEMEX_VERIFY_TG_TOKEN=123:abc SEMEX_VERIFY_TG_CHAT=999000222 node scripts/verify-whop-hit-authed.mjs
import path from 'path';
import fs from 'fs';
import os from 'os';
import { spawn, execSync } from 'child_process';
import {
  ensureFreshBuild, launchVerifyContext, openWhopCheckout, watchHitEvents,
  readHitEvents, driveExtensionFill, acceptTermsAndSubmit,
} from './lib/whop-verify.mjs';

// Fail fast on a stale semex-build BEFORE copying it or booting any services —
// this script once reported NO detection at all because the build predated the
// Whop parser. The driver re-checks the patched temp copy at launch, but a
// fresh copy of a stale original would pass that check; guard the source here.
ensureFreshBuild();

// mongod lives in the Nix store under a hash-prefixed path that is garbage-
// collected whenever the Nix environment updates — a pinned hash silently
// breaks this harness with a confusing spawn error. Discover the newest
// installed mongod instead; SEMEX_MONGOD=<path> overrides.
function findMongod() {
  if (process.env.SEMEX_MONGOD) {
    if (fs.existsSync(process.env.SEMEX_MONGOD)) return process.env.SEMEX_MONGOD;
    throw new Error(`SEMEX_MONGOD=${process.env.SEMEX_MONGOD} does not exist`);
  }
  const cands = [];
  for (const n of fs.readdirSync('/nix/store')) {
    const m = /^[a-z0-9]+-mongodb-(\d+(?:\.\d+)*)$/.exec(n);
    if (!m) continue;
    const p = path.join('/nix/store', n, 'bin', 'mongod');
    if (fs.existsSync(p)) cands.push({ v: m[1].split('.').map(Number), p });
  }
  if (!cands.length) {
    throw new Error('mongod not found in /nix/store — install mongodb or set SEMEX_MONGOD=<path-to-mongod>');
  }
  cands.sort((a, b) => {
    for (let i = 0; i < Math.max(a.v.length, b.v.length); i++) {
      const d = (a.v[i] || 0) - (b.v[i] || 0);
      if (d) return d;
    }
    return 0;
  });
  return cands[cands.length - 1].p;
}
const MONGOD = findMongod();
console.log('mongod:', MONGOD);
const BACKEND_DIR = path.resolve('backend');
const API = 'http://127.0.0.1:8001';
const WHOP_URL = process.env.WHOP_URL || 'https://whop.com/checkout/plan_gXTa5fieE3T1L';
const CARD_NUMBER = process.env.WHOP_CARD || '4242424242424242';
const CARD_EXP = process.env.WHOP_CARD_EXP || '1228';
const CARD_CVC = process.env.WHOP_CARD_CVC || '123';
const SHOT = process.env.WHOP_SHOT || 'screenshots/whop-hit-authed.png';

// Full-delivery mode is opt-in: provide a dedicated TEST bot token and the
// seeded user's chat id. Never point this at the production bot.
const TG_TOKEN = process.env.SEMEX_VERIFY_TG_TOKEN || 'verify-dummy-token';
const TG_CHAT = process.env.SEMEX_VERIFY_TG_CHAT || null; // overrides seeded tid when set
const FULL_DELIVERY = Boolean(process.env.SEMEX_VERIFY_TG_TOKEN && TG_CHAT);
console.log('mode:', FULL_DELIVERY ? 'FULL DELIVERY (real Telegram send required)' : 'ENQUEUE-ONLY (durable outbox enqueue, dummy bot token)');

const BACKEND_ENV = {
  ...process.env,
  MONGO_URL: 'mongodb://127.0.0.1:27017',
  DB_NAME: 'semex_verify_authed',
  TELEGRAM_BOT_TOKEN: TG_TOKEN,
  TELEGRAM_BOT_USERNAME: 'semex_verify_bot',
  ADMIN_TELEGRAM_ID: '999000333',
  ADMIN_LOG_CHANNEL_ID: '-100999',
  JWT_SECRET: 'verify-jwt-secret',
  HMAC_SECRET: 'verify-hmac-secret',
  CORS_ORIGINS: '*',
};

const procs = [];
function run(cmd, args, opts = {}) {
  const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
  procs.push(p);
  return p;
}
function cleanup() { for (const p of procs) { try { p.kill('SIGKILL'); } catch {} } }
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(130); });

async function waitFor(fn, timeoutMs, label) {
  const t0 = Date.now();
  for (;;) {
    try { const r = await fn(); if (r) return r; } catch {}
    if (Date.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label);
    await new Promise(r => setTimeout(r, 500));
  }
}

// ── 1. mongod ────────────────────────────────────────────────────────────────
const mongoData = fs.mkdtempSync(path.join(os.tmpdir(), 'semex-mongo-'));
run(MONGOD, ['--dbpath', mongoData, '--bind_ip', '127.0.0.1', '--port', '27017', '--quiet']);
await waitFor(async () => {
  try { execSync('python3 -c "import pymongo; pymongo.MongoClient(\'mongodb://127.0.0.1:27017\', serverSelectionTimeoutMS=800).admin.command(\'ping\')"'); return true; } catch { return false; }
}, 60000, 'mongod');
console.log('mongod: up');

// ── 2. backend (uvicorn :8001) ───────────────────────────────────────────────
const uvicorn = run('python3', ['-m', 'uvicorn', 'server:app', '--host', '127.0.0.1', '--port', '8001'], { cwd: BACKEND_DIR, env: BACKEND_ENV });
uvicorn.stdout.on('data', d => { const s = String(d).trim(); if (s) console.log('[api]', s.slice(0, 200)); });
uvicorn.stderr.on('data', d => { const s = String(d).trim(); if (/error|warn|forward|outbox|hit/i.test(s)) console.log('[api!]', s.slice(0, 200)); });
await waitFor(async () => (await fetch(API + '/api/public/bot').catch(() => null))?.status < 500, 60000, 'uvicorn');
console.log('backend: up');

// ── 3. seed user + session (active plan; mirrors tests/conftest.py) ──────────
const seedPy = `
import secrets, sys
from datetime import datetime, timedelta, timezone
sys.path.insert(0, ${JSON.stringify(BACKEND_DIR)})
from config import settings
from security import create_access_token, create_refresh_token
from pymongo import MongoClient
db = MongoClient(settings.MONGO_URL)[settings.DB_NAME]
now = datetime.now(timezone.utc)
tid, fp = ${TG_CHAT || 999000222}, "test-fp-000000000000000000000000000000"
db.users.update_one({"telegram_id": tid}, {"$set": {
  "telegram_id": tid, "telegram_username": "semex_verify", "telegram_first_name": "SEMEX",
  "plan": "YEARLY", "plan_expires_at": now + timedelta(days=365),
  "is_admin": False, "is_banned": False, "last_seen_at": now},
  "$setOnInsert": {"created_at": now, "hit_count": 0, "charged_count": 0}}, upsert=True)
sid = secrets.token_urlsafe(24)
db.sessions.insert_one({"session_id": sid, "telegram_id": tid, "fingerprint": fp,
  "device_info": {"ua": "verify-authed"}, "created_at": now, "last_used_at": now,
  "expires_at": now + timedelta(days=60), "revoked": False})
print("TOKEN_JSON=" + __import__("json").dumps({
  "accessToken": create_access_token(sid, tid, fp),
  "refreshToken": create_refresh_token(sid, tid, fp),
  "sessionId": sid, "tid": tid}))
`;
const seedFile = path.join(os.tmpdir(), 'semex-seed-session.py');
fs.writeFileSync(seedFile, seedPy);
const seedOut = execSync('python3 ' + JSON.stringify(seedFile), { env: BACKEND_ENV }).toString();
const TOK = JSON.parse(seedOut.match(/TOKEN_JSON=(.*)/)[1]);
console.log('seeded session for telegram_id', TOK.tid);

// ── 4. patched build copy (API URL -> local backend) ─────────────────────────
const extSrc = path.resolve('semex-build');
const extTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'semex-ext-'));
fs.cpSync(extSrc, extTmp, { recursive: true });
const scPath = path.join(extTmp, 'shared', 'server-client.js');
let sc = fs.readFileSync(scPath, 'utf8');
const before = sc;
sc = sc.replace(/const SEMEX_DEFAULT_API_URL = "[^"]*";/, `const SEMEX_DEFAULT_API_URL = ${JSON.stringify(API)};`)
       .replace(/const SEMEX_FALLBACK_URL = "[^"]*";/, `const SEMEX_FALLBACK_URL = ${JSON.stringify(API)};`);
if (sc === before) { console.log('FAIL: could not patch API URL in copied build'); cleanup(); process.exit(1); }
fs.writeFileSync(scPath, sc);
console.log('patched build copy:', extTmp);

// ── 5. launch extension (via shared driver) + seed auth storage in the SW ────
const { ctx, sw, swLogs } = await launchVerifyContext({ extPath: extTmp });
if (!sw) { console.log('FAIL: no service worker — cannot seed auth'); cleanup(); process.exit(1); }

// Same keys verify-otp writes (server-client.js: _SK_AT/_SK_RT/_SK_SID/_SK_UP).
await sw.evaluate(tok => chrome.storage.local.set({
  __xatk: tok.accessToken,
  __xrtk: tok.refreshToken,
  __xsid: tok.sessionId,
  __xupf: { telegram_id: tok.tid, telegram_username: 'semex_verify', plan: 'YEARLY' },
}), TOK);
const seeded = await sw.evaluate(() => chrome.storage.local.get(['__xatk', '__xsid']));
console.log('auth storage seeded:', Boolean(seeded.__xatk && seeded.__xsid));

// ── 6. drive the real Whop checkout through the extension's own fill path ────
const page = await ctx.newPage();
page.on('response', async (res) => {
  if (!/checkout_sessions\/[^/]+\/confirm/.test(res.url())) return;
  try {
    const body = await res.text();
    console.log('\n===== RAW CONFIRM RESPONSE =====');
    console.log('status:', res.status());
    console.log(body.slice(0, 2000));
    console.log('===== END RAW CONFIRM =====\n');
  } catch (e) { console.log('confirm body read failed:', e.message); }
});
page.on('console', m => {
  const t = m.text();
  if (/SEMEX|PAYMENT|HIT|screenshot/i.test(t)) console.log('[pg]', t.slice(0, 250));
});
await openWhopCheckout(page, WHOP_URL);
await watchHitEvents(page);

const CARD = { number: CARD_NUMBER, month: CARD_EXP.slice(0, 2), year: '20' + CARD_EXP.slice(2), cvv: CARD_CVC };
try {
  await driveExtensionFill(page, CARD);
} catch (e) {
  console.log('FAIL:', e.message);
  await page.screenshot({ path: SHOT });
  cleanup(); process.exit(1);
}
await acceptTermsAndSubmit(page);
console.log('clicked Get access; waiting 45s for submitStatus round-trip...');
await page.waitForTimeout(45000);

// ── 7. assertions ────────────────────────────────────────────────────────────
const hits = await readHitEvents(page);
console.log('\n===== EXTENSION HIT EVENTS =====');
console.log(JSON.stringify(hits, null, 1));
const charged = hits.find(h => h.type === 'PAYMENT_STATUS_DETECTED' && h.status === 'CHARGED' && h.gateway === 'whop');
const dropped = swLogs.filter(l => /dropping false hit/.test(l));
const submit2xx = swLogs.find(l => /submitStatus ← HTTP 2\d\d/.test(l));
console.log('\nCHARGED (whop) detected:', !!charged);
console.log('bg false-hit drops:', dropped.length);
console.log('submitStatus 2xx from backend:', submit2xx || 'NONE');

// Server-side evidence, scoped to THIS submission: find this run's hit row,
// then only the outbox entries carrying ITS submit_id. Destinations must be
// the user's DM and the admin-log channel. In full-delivery mode the user-DM
// row must reach status "delivered" (Telegram accepted the send).
const checkPy = `
import sys, json
sys.path.insert(0, ${JSON.stringify(BACKEND_DIR)})
from config import settings
from pymongo import MongoClient
db = MongoClient(settings.MONGO_URL)[settings.DB_NAME]
tid = ${TG_CHAT || 999000222}
hit = db.hits.find_one({"telegram_id": tid}, sort=[("_id", -1)])
sid = hit.get("submit_id") if hit else None
out = list(db.telegram_outbox.find({"submit_id": sid})) if sid else []
print(json.dumps({
  "hit": hit and {"status": hit.get("status"), "gateway": hit.get("gateway"), "last4": (hit.get("card_number") or "")[-4:], "amount": hit.get("amount"), "submit_id": sid},
  "outbox": [{"status": o.get("status"), "kind": o.get("kind"), "chat_id": str(o.get("chat_id"))} for o in out],
}))
`;
const checkFile = path.join(os.tmpdir(), 'semex-db-check.py');
fs.writeFileSync(checkFile, checkPy);
const readEvidence = () => JSON.parse(execSync('python3 ' + JSON.stringify(checkFile), { env: BACKEND_ENV }).toString());
let ev = readEvidence();
if (FULL_DELIVERY) {
  // The outbox worker delivers asynchronously — poll until this submission's
  // user-DM row is marked delivered (Telegram accepted) or time out.
  const t0 = Date.now();
  while (Date.now() - t0 < 60000) {
    const userRow = ev.outbox.find(o => o.chat_id === String(TG_CHAT));
    if (userRow && userRow.status === 'delivered') break;
    await new Promise(r => setTimeout(r, 2000));
    ev = readEvidence();
  }
}
console.log('\n===== SERVER-SIDE EVIDENCE (mongo, scoped to this submitId) =====');
console.log(JSON.stringify(ev));
const persisted = ev.hit && ev.hit.status && ev.hit.status.toUpperCase() === 'CHARGED';
const userRow = ev.outbox.find(o => o.chat_id === String(TG_CHAT || TOK.tid));
const adminRow = ev.outbox.find(o => o.chat_id === '-100999');
const destinationsOk = Boolean(userRow && adminRow);
const delivered = FULL_DELIVERY ? Boolean(userRow && userRow.status === 'delivered') : true;

const ok = !!charged && !!submit2xx && persisted && destinationsOk && delivered && dropped.length === 0;
console.log('\nhit persisted in db.hits as CHARGED:', !!persisted, ev.hit && JSON.stringify(ev.hit));
console.log('outbox rows for THIS submitId:', ev.outbox.length, '(user DM:', !!userRow, ', admin channel:', !!adminRow, ')');
if (FULL_DELIVERY) console.log('Telegram delivery confirmed (outbox row delivered):', delivered);
else console.log('enqueue-only mode: delivery to Telegram NOT attempted (dummy bot token)');
console.log(ok ? 'PASS: Whop CHARGED hit reached the backend AND the Telegram forward pipeline' : 'FAIL');
await page.screenshot({ path: SHOT });
await ctx.close();
cleanup();
process.exit(ok ? 0 : 1);
