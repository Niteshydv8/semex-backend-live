/**
 * Behavioral test for verifySession() refresh-on-401 logic.
 *
 * Runs entirely in Node.js with no external dependencies — uses only built-in
 * `vm`, `assert`, and `fs` modules to execute the real server-client.js code
 * in a sandboxed context with mocked chrome.storage and fetch.
 *
 * Run with:  node semex/tests/verify_session_behavior.js
 *
 * Exit 0 = all pass, Exit 1 = any failure.
 */

"use strict";

const vm = require("vm");
const assert = require("assert");
const fs = require("fs");
const path = require("path");

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeChromeStorage(initial = {}) {
  const store = Object.assign({}, initial);
  return {
    local: {
      async get(keys) {
        const result = {};
        const ks = Array.isArray(keys) ? keys : [keys];
        for (const k of ks) {
          if (k in store) result[k] = store[k];
        }
        return result;
      },
      async set(items) {
        Object.assign(store, items);
      },
    },
    _store: store,
  };
}

/**
 * Returns a fetch mock that serves responses in the given order.
 * Each entry: { status: number, body: object }.
 * Tracks every call as { url, opts } in fetch._calls.
 */
function makeOrderedFetch(responses) {
  const calls = [];
  let idx = 0;
  async function fetchMock(url, opts) {
    calls.push({ url, opts: opts || {} });
    const spec = responses[idx++];
    if (!spec) {
      throw new Error(
        `Unexpected fetch call #${idx} to ${url} — no mock response configured`
      );
    }
    return {
      status: spec.status,
      ok: spec.status >= 200 && spec.status < 300,
      async json() { return spec.body; },
    };
  }
  fetchMock._calls = calls;
  return fetchMock;
}

/**
 * Load server-client.js into a VM sandbox with the given chrome and fetch
 * mocks. Returns the serverClient instance the script installs on `self`.
 */
function loadClient(chromeStorage, fetchFn) {
  const src = fs.readFileSync(
    path.join(__dirname, "..", "utils", "server-client.js"),
    "utf8"
  );

  const sandbox = {
    // server-client.js targets `window` for the final assignment; we leave it
    // undefined so the script falls back to `self` instead.
    window: undefined,
    self: {},
    chrome: {
      storage: chromeStorage,
      runtime: {
        getManifest() { return { version: "9.9.9" }; },
      },
    },
    fetch: fetchFn,
    crypto: {
      randomUUID() {
        return "test-uuid-" + Math.random().toString(36).slice(2);
      },
    },
    navigator: { userAgent: "node-test", platform: "node", language: "en" },
    Headers: undefined,
    console,
    setTimeout,
    clearTimeout,
  };

  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox.self.serverClient;
}

// ─── test runner ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    console.log("  ✓ ", name);
    passed++;
  } catch (err) {
    console.error("  ✗ ", name);
    console.error("     Error:", err.message);
    failures.push({ name, message: err.message });
    failed++;
  }
}

// ─── tests ────────────────────────────────────────────────────────────────────

(async () => {
  console.log("\nverifySession() — refresh-on-401 behavioral tests\n");

  // 1 ─ Happy path: valid token, session endpoint succeeds on first call.
  await test("valid token → session succeeds without refresh", async () => {
    const storage = makeChromeStorage({
      accessToken: "valid-access-token",
      refreshToken: "valid-refresh-token",
      fingerprint: "test-fp-000000000000000000000000000",
    });
    const fetchMock = makeOrderedFetch([
      {
        status: 200,
        body: {
          valid: true,
          hasAccess: true,
          requiresRedeem: false,
          user: {
            plan: "YEARLY",
            telegramId: 999,
            firstName: "Alice",
            username: "alice",
          },
        },
      },
    ]);
    const client = loadClient(storage, fetchMock);
    client.fingerprint = "test-fp-000000000000000000000000000";

    const result = await client.verifySession();

    assert.strictEqual(result.valid, true, "must be valid");
    assert.strictEqual(
      fetchMock._calls.length,
      1,
      `must call /session only once (got ${fetchMock._calls.length})`
    );
    assert.ok(
      fetchMock._calls[0].url.includes("/api/auth/session"),
      `first call must be /api/auth/session, got ${fetchMock._calls[0].url}`
    );
  });

  // 2 ─ Full 401 → refresh → retry cycle returns valid=true.
  await test(
    "expired token → 401 → refresh → retry returns valid=true",
    async () => {
      const FRESH = "fresh-access-token-after-refresh";
      const storage = makeChromeStorage({
        accessToken: "expired-access-token",
        refreshToken: "valid-refresh-token",
        fingerprint: "test-fp-000000000000000000000000000",
      });
      const fetchMock = makeOrderedFetch([
        { status: 401, body: { detail: "Token expired" } }, // initial session → 401
        { status: 200, body: { accessToken: FRESH } },       // refresh → new token
        {
          status: 200,
          body: {
            valid: true,
            hasAccess: true,
            requiresRedeem: false,
            user: {
              plan: "YEARLY",
              telegramId: 999,
              firstName: "Alice",
              username: "alice",
            },
          },
        }, // retry → success
      ]);
      const client = loadClient(storage, fetchMock);
      client.fingerprint = "test-fp-000000000000000000000000000";

      const result = await client.verifySession();

      assert.strictEqual(result.valid, true, "session must be valid after refresh cycle");
    }
  );

  // 3 ─ Fresh token is persisted to chrome.storage after a successful refresh.
  await test(
    "fresh access token persisted to chrome.storage after refresh",
    async () => {
      const FRESH = "fresh-token-must-be-stored-in-storage";
      const storage = makeChromeStorage({
        accessToken: "expired-access-token",
        refreshToken: "valid-refresh-token",
        fingerprint: "test-fp-000000000000000000000000000",
      });
      const fetchMock = makeOrderedFetch([
        { status: 401, body: { detail: "Token expired" } },
        { status: 200, body: { accessToken: FRESH } },
        {
          status: 200,
          body: {
            valid: true,
            hasAccess: true,
            requiresRedeem: false,
            user: { plan: "YEARLY", telegramId: 999, firstName: "A", username: "a" },
          },
        },
      ]);
      const client = loadClient(storage, fetchMock);
      client.fingerprint = "test-fp-000000000000000000000000000";

      await client.verifySession();

      const persisted = await storage.local.get(["accessToken"]);
      assert.strictEqual(
        persisted.accessToken,
        FRESH,
        `stored accessToken must equal the fresh token. Got: ${persisted.accessToken}`
      );
    }
  );

  // 4 ─ The refresh POST carries the refreshToken in its JSON body.
  await test(
    "refresh POST body contains refreshToken",
    async () => {
      const REFRESH_TOKEN = "the-exact-refresh-token-sent-to-backend";
      const storage = makeChromeStorage({
        accessToken: "expired-access-token",
        refreshToken: REFRESH_TOKEN,
        fingerprint: "test-fp-000000000000000000000000000",
      });
      const fetchMock = makeOrderedFetch([
        { status: 401, body: { detail: "Token expired" } },
        { status: 200, body: { accessToken: "fresh-token" } },
        {
          status: 200,
          body: {
            valid: true,
            hasAccess: true,
            requiresRedeem: false,
            user: { plan: "YEARLY", telegramId: 999, firstName: "A", username: "a" },
          },
        },
      ]);
      const client = loadClient(storage, fetchMock);
      client.fingerprint = "test-fp-000000000000000000000000000";

      await client.verifySession();

      // call[0] = /session, call[1] = /refresh
      const refreshCall = fetchMock._calls[1];
      assert.ok(
        refreshCall && refreshCall.url.includes("/api/auth/refresh"),
        `second call must be /api/auth/refresh, got: ${refreshCall && refreshCall.url}`
      );
      const body = JSON.parse(refreshCall.opts.body);
      assert.strictEqual(
        body.refreshToken,
        REFRESH_TOKEN,
        `refresh body.refreshToken must equal the stored refreshToken`
      );
    }
  );

  // 5 ─ The retry /session call uses the FRESH token in its Authorization header.
  await test(
    "retry uses fresh access token in Authorization header",
    async () => {
      const FRESH = "the-fresh-token-for-retry-auth-header";
      const storage = makeChromeStorage({
        accessToken: "stale-token",
        refreshToken: "valid-refresh-token",
        fingerprint: "test-fp-000000000000000000000000000",
      });
      const fetchMock = makeOrderedFetch([
        { status: 401, body: { detail: "Token expired" } },
        { status: 200, body: { accessToken: FRESH } },
        {
          status: 200,
          body: {
            valid: true,
            hasAccess: true,
            requiresRedeem: false,
            user: { plan: "YEARLY", telegramId: 999, firstName: "A", username: "a" },
          },
        },
      ]);
      const client = loadClient(storage, fetchMock);
      client.fingerprint = "test-fp-000000000000000000000000000";

      await client.verifySession();

      // call[2] = retry
      const retryCall = fetchMock._calls[2];
      assert.ok(retryCall, "a retry call must have been made");
      const authHeader =
        retryCall.opts.headers && retryCall.opts.headers["Authorization"];
      assert.ok(
        authHeader && authHeader.includes(FRESH),
        `retry Authorization must carry fresh token. Got: "${authHeader}"`
      );
    }
  );

  // 6 ─ Refresh itself fails (revoked session) → returns {valid:false}, no throw.
  await test(
    "revoked-session refresh → {valid: false} not an exception",
    async () => {
      const storage = makeChromeStorage({
        accessToken: "expired-access-token",
        refreshToken: "revoked-refresh-token",
        fingerprint: "test-fp-000000000000000000000000000",
      });
      const fetchMock = makeOrderedFetch([
        { status: 401, body: { detail: "Token expired" } },
        { status: 401, body: { detail: "Session revoked" } }, // refresh fails
      ]);
      const client = loadClient(storage, fetchMock);
      client.fingerprint = "test-fp-000000000000000000000000000";

      const result = await client.verifySession();

      assert.strictEqual(result.valid, false, "must return valid=false on failed refresh");
      // Must NOT surface error=true — that would trigger a "cannot connect" UI
      assert.ok(
        !result.error,
        `must not return error=true (network error shape) on auth failure, got: ${JSON.stringify(result)}`
      );
    }
  );

  // 7 ─ No refreshToken stored → no refresh attempt, immediate valid=false.
  await test(
    "no refreshToken in storage → no refresh call, returns valid=false",
    async () => {
      const storage = makeChromeStorage({
        accessToken: "expired-access-token",
        // refreshToken deliberately absent
        fingerprint: "test-fp-000000000000000000000000000",
      });
      const fetchMock = makeOrderedFetch([
        { status: 401, body: { detail: "Token expired" } },
        // no second response — a call here would throw
      ]);
      const client = loadClient(storage, fetchMock);
      client.fingerprint = "test-fp-000000000000000000000000000";

      const result = await client.verifySession();

      assert.strictEqual(result.valid, false, "must return valid=false without refreshToken");
      assert.strictEqual(
        fetchMock._calls.length,
        1,
        `must NOT call refresh when refreshToken is absent (got ${fetchMock._calls.length} calls)`
      );
    }
  );

  // 8 ─ No accessToken at all → immediate valid=false without any fetch.
  await test(
    "no accessToken → immediate valid=false, zero fetch calls",
    async () => {
      const storage = makeChromeStorage({
        fingerprint: "test-fp-000000000000000000000000000",
        // no accessToken, no refreshToken
      });
      const fetchMock = makeOrderedFetch([]); // any call here throws
      const client = loadClient(storage, fetchMock);
      client.fingerprint = "test-fp-000000000000000000000000000";

      const result = await client.verifySession();

      assert.strictEqual(result.valid, false, "must return valid=false without accessToken");
      assert.strictEqual(
        fetchMock._calls.length,
        0,
        "must make zero fetch calls without an accessToken"
      );
    }
  );

  // 9 ─ The full refresh cycle makes exactly 3 fetch calls (no extra retries).
  await test(
    "refresh cycle makes exactly 3 fetch calls: session → refresh → retry",
    async () => {
      const storage = makeChromeStorage({
        accessToken: "expired-access-token",
        refreshToken: "valid-refresh-token",
        fingerprint: "test-fp-000000000000000000000000000",
      });
      const fetchMock = makeOrderedFetch([
        { status: 401, body: { detail: "Token expired" } },
        { status: 200, body: { accessToken: "fresh-token" } },
        {
          status: 200,
          body: {
            valid: true,
            hasAccess: true,
            requiresRedeem: false,
            user: { plan: "YEARLY", telegramId: 999, firstName: "A", username: "a" },
          },
        },
      ]);
      const client = loadClient(storage, fetchMock);
      client.fingerprint = "test-fp-000000000000000000000000000";

      await client.verifySession();

      assert.strictEqual(
        fetchMock._calls.length,
        3,
        `expected exactly 3 fetch calls, got ${fetchMock._calls.length}`
      );
    }
  );

  // 10 ─ Result includes correct user-data fields from the session response body.
  await test(
    "result carries user fields from the session response after refresh",
    async () => {
      const storage = makeChromeStorage({
        accessToken: "expired-access-token",
        refreshToken: "valid-refresh-token",
        fingerprint: "test-fp-000000000000000000000000000",
      });
      const fetchMock = makeOrderedFetch([
        { status: 401, body: {} },
        { status: 200, body: { accessToken: "fresh-token" } },
        {
          status: 200,
          body: {
            valid: true,
            hasAccess: true,
            requiresRedeem: false,
            user: {
              plan: "MONTHLY",
              telegramId: 12345,
              firstName: "Bob",
              username: "bob_test",
            },
          },
        },
      ]);
      const client = loadClient(storage, fetchMock);
      client.fingerprint = "test-fp-000000000000000000000000000";

      const result = await client.verifySession();

      assert.strictEqual(result.valid, true);
      assert.strictEqual(
        result.plan,
        "MONTHLY",
        `plan must come from session response. Got: ${result.plan}`
      );
      assert.strictEqual(
        result.telegramId,
        "12345",
        `telegramId must be string '12345'. Got: ${result.telegramId}`
      );
    }
  );

  // ── summary ──────────────────────────────────────────────────────────────────

  console.log(
    `\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`
  );
  if (failed > 0) {
    console.error("Failed tests:");
    for (const f of failures) {
      console.error(`  - ${f.name}`);
      console.error(`    ${f.message}`);
    }
    process.exit(1);
  }
})();
