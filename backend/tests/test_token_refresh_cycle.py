"""Integration tests: 15-min access-token expiry → auto-refresh cycle (Task 128).

Verifies:
1. An expired access token is rejected with 401 by GET /api/auth/session.
2. POST /api/auth/refresh with a valid refresh token issues a fresh access token.
3. The fresh access token is accepted by GET /api/auth/session (valid session).
4. The full 401→refresh→retry cycle succeeds end-to-end (same flow as
   server-client.js verifySession()).
5. A revoked refresh token returns a clean 401 (not a 500/silent failure).
6. An invalid/tampered refresh token is rejected with a clean 401.
7. verifySession() source-level check: the refresh-on-401 path is present in
   server-client.js and handles the new accessToken correctly.
"""
from __future__ import annotations

import secrets
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt
import pytest
import requests

BASE_URL = "http://localhost:8001"
BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))


def _make_expired_access_token(session_id: str, telegram_id: int, fingerprint: str) -> str:
    """Mint a JWT access token whose expiry is already in the past."""
    from config import settings
    now = datetime.now(timezone.utc)
    payload = {
        "sid": session_id,
        "tid": telegram_id,
        "fp": fingerprint,
        "iat": now - timedelta(minutes=20),   # issued 20 min ago
        "exp": now - timedelta(minutes=5),    # expired 5 min ago
        "typ": "access",
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def _make_valid_refresh_token(session_id: str, telegram_id: int, fingerprint: str) -> str:
    """Mint a refresh token (matches the real create_refresh_token shape)."""
    from config import settings
    now = datetime.now(timezone.utc)
    payload = {
        "sid": session_id,
        "tid": telegram_id,
        "fp": fingerprint,
        "iat": now,
        "exp": now + timedelta(days=30),
        "typ": "refresh",
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def _auth_headers(token: str, fingerprint: str) -> dict:
    return {
        "Authorization": f"Bearer {token}",
        "X-Fingerprint": fingerprint,
        "X-Extension-Version": "9.9.9",
    }


def _session_url() -> str:
    return f"{BASE_URL}/api/auth/session"


def _refresh_url() -> str:
    return f"{BASE_URL}/api/auth/refresh"


# ─── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def refresh_test_user(mongo_db):
    """Seed a fresh user + non-revoked session for refresh-cycle tests."""
    from security import create_access_token, create_refresh_token

    TID = 999000555
    FP = "test-fp-refresh-cycle-0000000000000"
    now = datetime.now(timezone.utc)

    mongo_db.users.update_one(
        {"telegram_id": TID},
        {
            "$set": {
                "telegram_id": TID,
                "telegram_username": "TEST_refresh",
                "telegram_first_name": "Refresh",
                "telegram_last_name": "Test",
                "plan": "YEARLY",
                "plan_expires_at": now + timedelta(days=365),
                "is_admin": False,
                "is_banned": False,
                "requires_redeem": False,
                "last_seen_at": now,
            },
            "$setOnInsert": {
                "created_at": now,
                "hit_count": 0,
                "charged_count": 0,
            },
        },
        upsert=True,
    )

    session_id = secrets.token_urlsafe(24)
    mongo_db.sessions.insert_one({
        "session_id": session_id,
        "telegram_id": TID,
        "fingerprint": FP,
        "device_info": {"ua": "pytest-refresh"},
        "created_at": now,
        "last_used_at": now,
        "expires_at": now + timedelta(days=60),
        "revoked": False,
    })

    access_token = create_access_token(session_id, TID, FP)
    refresh_token = create_refresh_token(session_id, TID, FP)

    yield {
        "telegram_id": TID,
        "session_id": session_id,
        "fingerprint": FP,
        "access_token": access_token,
        "refresh_token": refresh_token,
    }

    # Cleanup
    mongo_db.sessions.delete_many({"telegram_id": TID})
    mongo_db.users.delete_many({"telegram_id": TID})


# ─── 1. Expired access token → 401 ───────────────────────────────────────────

class TestExpiredTokenRejected:
    """A past-expiry access token must be cleanly rejected by /api/auth/session."""

    def test_expired_token_returns_401(self, refresh_test_user):
        expired = _make_expired_access_token(
            refresh_test_user["session_id"],
            refresh_test_user["telegram_id"],
            refresh_test_user["fingerprint"],
        )
        r = requests.get(
            _session_url(),
            headers=_auth_headers(expired, refresh_test_user["fingerprint"]),
            timeout=10,
        )
        assert r.status_code == 401, (
            f"Expired access token should return 401, got {r.status_code}: {r.text}"
        )

    def test_expired_token_error_is_not_500(self, refresh_test_user):
        """Expired token must not cause a 500 — must be a clean auth rejection."""
        expired = _make_expired_access_token(
            refresh_test_user["session_id"],
            refresh_test_user["telegram_id"],
            refresh_test_user["fingerprint"],
        )
        r = requests.get(
            _session_url(),
            headers=_auth_headers(expired, refresh_test_user["fingerprint"]),
            timeout=10,
        )
        assert r.status_code != 500, (
            f"Expired token must not cause 500 server error, got {r.status_code}: {r.text}"
        )

    def test_no_token_returns_401(self, refresh_test_user):
        r = requests.get(_session_url(), timeout=10)
        assert r.status_code == 401, (
            f"Missing auth header should return 401, got {r.status_code}: {r.text}"
        )


# ─── 2. Refresh endpoint issues a fresh token ────────────────────────────────

class TestRefreshEndpoint:
    """POST /api/auth/refresh must mint a fresh access token for a live session."""

    def test_refresh_returns_200(self, refresh_test_user):
        r = requests.post(
            _refresh_url(),
            json={"refreshToken": refresh_test_user["refresh_token"]},
            timeout=10,
        )
        assert r.status_code == 200, (
            f"Valid refresh token must return 200, got {r.status_code}: {r.text}"
        )

    def test_refresh_returns_access_token_field(self, refresh_test_user):
        r = requests.post(
            _refresh_url(),
            json={"refreshToken": refresh_test_user["refresh_token"]},
            timeout=10,
        )
        j = r.json()
        assert "accessToken" in j, f"Refresh response must contain 'accessToken': {j}"
        assert j["accessToken"], "Returned accessToken must be non-empty"

    def test_fresh_access_token_is_semantically_valid(self, refresh_test_user):
        """The refreshed accessToken must decode correctly as an access JWT with
        the right claims and a future expiry.  We do NOT compare the raw string
        because PyJWT truncates iat/exp to whole-second NumericDates, so two
        tokens minted in the same calendar second are intentionally identical."""
        import base64
        import json as _json

        r = requests.post(
            _refresh_url(),
            json={"refreshToken": refresh_test_user["refresh_token"]},
            timeout=10,
        )
        assert r.status_code == 200
        new_token = r.json()["accessToken"]
        assert isinstance(new_token, str) and new_token.count(".") == 2, (
            "Refreshed accessToken must be a three-part JWT"
        )

        # Decode the payload (no signature verification needed — we just check claims shape)
        parts = new_token.split(".")
        padding = "=" * (4 - len(parts[1]) % 4)
        payload = _json.loads(base64.urlsafe_b64decode(parts[1] + padding))

        assert payload.get("typ") == "access", (
            f"Refreshed token typ must be 'access', got: {payload.get('typ')}"
        )
        assert payload.get("sid") == refresh_test_user["session_id"], (
            f"Refreshed token sid must match the session, got: {payload.get('sid')}"
        )
        assert payload.get("tid") == refresh_test_user["telegram_id"], (
            f"Refreshed token tid must match the user, got: {payload.get('tid')}"
        )
        now_ts = datetime.now(timezone.utc).timestamp()
        assert payload.get("exp", 0) > now_ts, (
            f"Refreshed token must not be immediately expired (exp={payload.get('exp')}, now={now_ts:.0f})"
        )

    def test_fresh_access_token_accepted_by_session_endpoint(self, refresh_test_user):
        """After refreshing, the new token must be accepted by /api/auth/session."""
        rr = requests.post(
            _refresh_url(),
            json={"refreshToken": refresh_test_user["refresh_token"]},
            timeout=10,
        )
        assert rr.status_code == 200
        new_token = rr.json()["accessToken"]

        rs = requests.get(
            _session_url(),
            headers=_auth_headers(new_token, refresh_test_user["fingerprint"]),
            timeout=10,
        )
        assert rs.status_code == 200, (
            f"Fresh access token must be accepted by /api/auth/session, got {rs.status_code}: {rs.text}"
        )
        j = rs.json()
        assert j.get("valid") is True, f"Session must be valid after refresh, got: {j}"


# ─── 3. Full 401 → refresh → retry cycle ─────────────────────────────────────

class TestFullRefreshCycle:
    """Simulate exactly what server-client.js verifySession() does:
    send expired token → 401 → call refresh → retry session with new token → success.
    """

    def test_expired_token_then_refresh_then_session_succeeds(self, refresh_test_user):
        """End-to-end cycle: expired token → refresh → valid session."""
        FP = refresh_test_user["fingerprint"]
        SID = refresh_test_user["session_id"]
        TID = refresh_test_user["telegram_id"]

        # Step 1: send expired access token to /api/auth/session → expect 401
        expired = _make_expired_access_token(SID, TID, FP)
        r1 = requests.get(
            _session_url(),
            headers=_auth_headers(expired, FP),
            timeout=10,
        )
        assert r1.status_code == 401, (
            f"Step 1 (expired token) must be 401, got {r1.status_code}"
        )

        # Step 2: call /api/auth/refresh with the valid refresh token → new access token
        r2 = requests.post(
            _refresh_url(),
            json={"refreshToken": refresh_test_user["refresh_token"]},
            timeout=10,
        )
        assert r2.status_code == 200, (
            f"Step 2 (refresh) must succeed, got {r2.status_code}: {r2.text}"
        )
        new_access_token = r2.json()["accessToken"]
        assert new_access_token, "Refresh must return a non-empty accessToken"

        # Step 3: retry /api/auth/session with the new token → should succeed
        r3 = requests.get(
            _session_url(),
            headers=_auth_headers(new_access_token, FP),
            timeout=10,
        )
        assert r3.status_code == 200, (
            f"Step 3 (retry with fresh token) must succeed, got {r3.status_code}: {r3.text}"
        )
        j = r3.json()
        assert j.get("valid") is True, f"Session must report valid=true after full refresh cycle, got: {j}"
        assert "user" in j, f"Session response must include user data after refresh cycle, got: {j}"

    def test_session_user_data_intact_after_refresh(self, refresh_test_user):
        """After refresh, user data fields must still be correct (no data loss)."""
        # Refresh to get a fresh token
        r_refresh = requests.post(
            _refresh_url(),
            json={"refreshToken": refresh_test_user["refresh_token"]},
            timeout=10,
        )
        assert r_refresh.status_code == 200
        new_token = r_refresh.json()["accessToken"]

        # Check session
        r_session = requests.get(
            _session_url(),
            headers=_auth_headers(new_token, refresh_test_user["fingerprint"]),
            timeout=10,
        )
        assert r_session.status_code == 200
        j = r_session.json()
        user = j.get("user", {})
        assert user.get("telegramId") == refresh_test_user["telegram_id"], (
            f"telegramId mismatch after refresh: {user}"
        )
        assert user.get("plan") == "YEARLY", (
            f"plan must be intact after refresh, got: {user.get('plan')}"
        )

    def test_refresh_updates_session_last_used_at(self, refresh_test_user, mongo_db):
        """Refreshing must update the session's last_used_at timestamp in the DB."""
        before = datetime.now(timezone.utc)
        r = requests.post(
            _refresh_url(),
            json={"refreshToken": refresh_test_user["refresh_token"]},
            timeout=10,
        )
        assert r.status_code == 200

        sess = mongo_db.sessions.find_one(
            {"session_id": refresh_test_user["session_id"]}
        )
        assert sess is not None
        lua = sess.get("last_used_at")
        if lua and lua.tzinfo is None:
            lua = lua.replace(tzinfo=timezone.utc)
        assert lua >= before, (
            f"last_used_at must be updated after refresh (was {lua}, before={before})"
        )


# ─── 4. Revoked session → clean 401 on refresh ───────────────────────────────

class TestRevokedSessionRefresh:
    """Refresh with a token whose session is revoked must return 401, not 500."""

    @pytest.fixture(scope="class")
    def revoked_refresh(self, mongo_db):
        """Create a user+session, revoke the session, return its refresh token."""
        TID = 999000556
        FP = "test-fp-revoked-refresh-00000000000"
        now = datetime.now(timezone.utc)

        mongo_db.users.update_one(
            {"telegram_id": TID},
            {
                "$set": {
                    "telegram_id": TID,
                    "telegram_username": "TEST_revoked_refresh",
                    "telegram_first_name": "Revoked",
                    "telegram_last_name": "Refresh",
                    "plan": "TRIAL",
                    "is_admin": False,
                    "is_banned": False,
                    "last_seen_at": now,
                },
                "$setOnInsert": {"created_at": now, "hit_count": 0, "charged_count": 0},
            },
            upsert=True,
        )
        sid = secrets.token_urlsafe(24)
        mongo_db.sessions.insert_one({
            "session_id": sid,
            "telegram_id": TID,
            "fingerprint": FP,
            "device_info": {},
            "created_at": now,
            "last_used_at": now,
            "expires_at": now + timedelta(days=60),
            "revoked": True,  # <-- already revoked
        })
        refresh_token = _make_valid_refresh_token(sid, TID, FP)
        yield {"refresh_token": refresh_token, "session_id": sid, "fingerprint": FP}
        mongo_db.sessions.delete_many({"telegram_id": TID})
        mongo_db.users.delete_many({"telegram_id": TID})

    def test_revoked_session_refresh_returns_401(self, revoked_refresh):
        r = requests.post(
            _refresh_url(),
            json={"refreshToken": revoked_refresh["refresh_token"]},
            timeout=10,
        )
        assert r.status_code == 401, (
            f"Revoked session refresh must return 401, got {r.status_code}: {r.text}"
        )

    def test_revoked_session_refresh_not_500(self, revoked_refresh):
        r = requests.post(
            _refresh_url(),
            json={"refreshToken": revoked_refresh["refresh_token"]},
            timeout=10,
        )
        assert r.status_code != 500, (
            f"Revoked session refresh must NOT cause 500, got {r.status_code}: {r.text}"
        )

    def test_revoked_session_refresh_returns_error_detail(self, revoked_refresh):
        r = requests.post(
            _refresh_url(),
            json={"refreshToken": revoked_refresh["refresh_token"]},
            timeout=10,
        )
        j = r.json()
        # FastAPI returns HTTPException as {"detail": "..."}
        assert "detail" in j or "error" in j, (
            f"401 response must include a detail/error field explaining revocation: {j}"
        )


# ─── 5. Invalid / tampered refresh token → clean 401 ─────────────────────────

class TestInvalidRefreshToken:
    """Malformed or tampered refresh tokens must be cleanly rejected."""

    def test_garbage_refresh_token_returns_401(self):
        r = requests.post(
            _refresh_url(),
            json={"refreshToken": "this-is-not-a-jwt-at-all"},
            timeout=10,
        )
        assert r.status_code == 401, (
            f"Garbage refresh token must return 401, got {r.status_code}: {r.text}"
        )

    def test_tampered_refresh_token_returns_401(self, refresh_test_user):
        """Flip a character in the signature — must be rejected."""
        token = refresh_test_user["refresh_token"]
        # Corrupt the last character of the signature segment
        tampered = token[:-1] + ("A" if token[-1] != "A" else "B")
        r = requests.post(
            _refresh_url(),
            json={"refreshToken": tampered},
            timeout=10,
        )
        assert r.status_code == 401, (
            f"Tampered refresh token must return 401, got {r.status_code}: {r.text}"
        )

    def test_access_token_as_refresh_token_returns_401(self, refresh_test_user):
        """Sending an access token (typ=access) to /refresh must fail — type check."""
        r = requests.post(
            _refresh_url(),
            json={"refreshToken": refresh_test_user["access_token"]},
            timeout=10,
        )
        assert r.status_code == 401, (
            f"access token passed as refresh token must return 401, got {r.status_code}: {r.text}"
        )

    def test_missing_refresh_token_body_returns_422(self):
        """Sending an empty body to /refresh must return 422 (Pydantic validation)."""
        r = requests.post(_refresh_url(), json={}, timeout=10)
        assert r.status_code == 422, (
            f"Missing refreshToken field must return 422, got {r.status_code}: {r.text}"
        )

    def test_invalid_refresh_not_500(self):
        r = requests.post(
            _refresh_url(),
            json={"refreshToken": "eyJhbGciOiJIUzI1NiJ9.fake.sig"},
            timeout=10,
        )
        assert r.status_code != 500, (
            f"Invalid refresh token must not cause 500, got {r.status_code}: {r.text}"
        )


# ─── 6. Source-level: verify_session function body targeted checks ────────────

class TestServerClientRefreshLogic:
    """Structural checks scoped to the verifySession() function body so they
    catch the specific refresh-on-401 branch — not just any mention of the
    string anywhere in the 1 500-line obfuscated file."""

    @staticmethod
    def _sc_src() -> str:
        p = BACKEND_DIR.parent / "semex" / "shared" / "server-client.js"
        return p.read_text(encoding="utf-8")

    @staticmethod
    def _verify_session_body(src: str) -> str:
        """Extract the text of the verifySession method body.

        The method is defined as:
            async verifySession() {
                ...
            }
        We find its opening brace and walk forward counting braces to locate
        the matching close, so we only look at that function's code.
        """
        marker = "async verifySession()"
        start = src.find(marker)
        assert start != -1, "verifySession() method not found in server-client.js"
        brace_open = src.index("{", start)
        depth = 0
        i = brace_open
        while i < len(src):
            if src[i] == "{":
                depth += 1
            elif src[i] == "}":
                depth -= 1
                if depth == 0:
                    return src[brace_open : i + 1]
            i += 1
        raise AssertionError("Could not locate the closing brace of verifySession()")

    # ── structural checks (scoped to verifySession body) ──────────────────────

    def test_verify_session_function_exists(self):
        src = self._sc_src()
        assert "async verifySession()" in src, (
            "verifySession must be defined as 'async verifySession()' in server-client.js"
        )

    def test_refresh_on_401_branch_inside_verify_session(self):
        """The 401 check and /api/auth/refresh call must be INSIDE verifySession,
        not in an unrelated method."""
        body = self._verify_session_body(self._sc_src())
        assert "401" in body, (
            "verifySession body must contain a 401 status check for the refresh-on-401 branch"
        )
        assert "/api/auth/refresh" in body, (
            "verifySession body must call /api/auth/refresh when it receives a 401"
        )

    def test_storage_set_inside_verify_session(self):
        """After refresh, the new accessToken must be saved via chrome.storage.local.set
        within verifySession itself (not delegated to some other method that might not run)."""
        body = self._verify_session_body(self._sc_src())
        assert "chrome.storage.local.set" in body, (
            "verifySession body must persist the refreshed accessToken via chrome.storage.local.set"
        )

    def test_retry_session_call_inside_verify_session(self):
        """After refresh, verifySession must re-fetch /api/auth/session so the
        retry path is confirmed — not just optimistically return valid=true."""
        body = self._verify_session_body(self._sc_src())
        count = body.count("/api/auth/session")
        assert count >= 2, (
            f"verifySession body must reference /api/auth/session at least twice "
            f"(initial call + retry after refresh), found {count} occurrence(s)"
        )

    def test_valid_false_returned_inside_verify_session(self):
        """verifySession must return {{valid: false}} on failure paths so callers
        get a clean boolean signal rather than an exception or silent undefined."""
        body = self._verify_session_body(self._sc_src())
        assert "valid" in body and "false" in body, (
            "verifySession body must contain a {{valid: false}} return path"
        )
        # Specifically the fallback after a failed refresh (not just the no-token guard)
        assert body.count("false") >= 2, (
            "verifySession body must have at least two 'false' occurrences covering "
            "both the no-token early-exit and the failed-refresh fallback"
        )
