"""Shared fixtures for SEMEX backend tests.

Seeds:
- Active non-admin user (999000222) with far-future plan  -> for hit-submit tests
- Expired non-admin user  (999000111) with past plan       -> for 402 paywall test
- Active admin user       (999000333, is_admin=True)       -> for admin endpoints

All test data is cleaned up after the session finishes.
"""
from __future__ import annotations

import os
import secrets
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from pymongo import MongoClient

# Make /app/backend importable so we can reuse security helpers
BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from config import settings  # noqa: E402
from security import create_access_token  # noqa: E402


TEST_USER_ACTIVE_TID = 999000222
TEST_USER_EXPIRED_TID = 999000111
TEST_ADMIN_TID = 999000333
TEST_FP = "test-fp-000000000000000000000000000000"
TEST_FP_MISMATCH = "test-fp-DIFFERENT000000000000000000000"


@pytest.fixture(scope="session", autouse=True)
def _wait_for_api():
    """Block the whole suite until the backend HTTP API accepts connections.

    The shell harness probes before starting pytest, but the server can still
    flap right after (slow import, port rebind); the first test file then dies
    with ConnectionRefused. Poll here so every test file sees a live API."""
    import time
    import urllib.request

    bases = {
        os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/"),
        os.environ.get("SEMEX_TEST_BASE", "").rstrip("/"),
        "http://127.0.0.1:8001",
        "http://localhost:8001",
    }
    deadline = time.time() + 90
    while time.time() < deadline:
        for base in bases:
            if not base:
                continue
            try:
                with urllib.request.urlopen(base + "/api/health", timeout=3) as r:
                    if r.status < 500:
                        return
            except Exception:
                pass
        time.sleep(1)
    # Don't hard-fail collection — individual tests will report their own errors.


@pytest.fixture(scope="session")
def mongo_db():
    client = MongoClient(settings.MONGO_URL)
    db = client[settings.DB_NAME]
    yield db
    # Cleanup: remove test users + sessions + hits + redeem codes we created
    tids = [TEST_USER_ACTIVE_TID, TEST_USER_EXPIRED_TID, TEST_ADMIN_TID]
    db.users.delete_many({"telegram_id": {"$in": tids}})
    db.sessions.delete_many({"telegram_id": {"$in": tids}})
    db.hits.delete_many({"telegram_id": {"$in": tids}})
    db.redeem_codes.delete_many({"created_by": {"$in": tids + [0]}, "used": False})
    client.close()


def _seed_user(db, telegram_id: int, *, is_admin: bool, expired: bool, username: str) -> None:
    now = datetime.now(timezone.utc)
    if is_admin:
        plan_expires_at = None
    else:
        plan_expires_at = (now - timedelta(days=1)) if expired else (now + timedelta(days=365))
    db.users.update_one(
        {"telegram_id": telegram_id},
        {
            "$set": {
                "telegram_id": telegram_id,
                "telegram_username": username,
                "telegram_first_name": "TEST",
                "telegram_last_name": "User",
                "plan": "VIP" if is_admin else ("TRIAL" if expired else "YEARLY"),
                "plan_expires_at": plan_expires_at,
                "is_admin": is_admin,
                "is_banned": False,
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


def _new_session(db, telegram_id: int, fingerprint: str = TEST_FP) -> str:
    session_id = secrets.token_urlsafe(24)
    now = datetime.now(timezone.utc)
    db.sessions.insert_one(
        {
            "session_id": session_id,
            "telegram_id": telegram_id,
            "fingerprint": fingerprint,
            "device_info": {"ua": "pytest"},
            "created_at": now,
            "last_used_at": now,
            "expires_at": now + timedelta(days=60),
            "revoked": False,
        }
    )
    return session_id


@pytest.fixture(scope="session")
def active_user(mongo_db):
    _seed_user(mongo_db, TEST_USER_ACTIVE_TID, is_admin=False, expired=False, username="TEST_active")
    sid = _new_session(mongo_db, TEST_USER_ACTIVE_TID, TEST_FP)
    token = create_access_token(sid, TEST_USER_ACTIVE_TID, TEST_FP)
    return {
        "telegram_id": TEST_USER_ACTIVE_TID,
        "session_id": sid,
        "fingerprint": TEST_FP,
        "token": token,
    }


@pytest.fixture(scope="session")
def expired_user(mongo_db):
    _seed_user(mongo_db, TEST_USER_EXPIRED_TID, is_admin=False, expired=True, username="TEST_expired")
    sid = _new_session(mongo_db, TEST_USER_EXPIRED_TID, TEST_FP)
    token = create_access_token(sid, TEST_USER_EXPIRED_TID, TEST_FP)
    return {
        "telegram_id": TEST_USER_EXPIRED_TID,
        "session_id": sid,
        "fingerprint": TEST_FP,
        "token": token,
    }


@pytest.fixture(scope="session")
def admin_user(mongo_db):
    _seed_user(mongo_db, TEST_ADMIN_TID, is_admin=True, expired=False, username="TEST_admin")
    sid = _new_session(mongo_db, TEST_ADMIN_TID, TEST_FP)
    token = create_access_token(sid, TEST_ADMIN_TID, TEST_FP)
    return {
        "telegram_id": TEST_ADMIN_TID,
        "session_id": sid,
        "fingerprint": TEST_FP,
        "token": token,
    }


@pytest.fixture(scope="session")
def admin_by_id_user(mongo_db):
    """User whose telegram_id == settings.ADMIN_TELEGRAM_ID but is_admin=false in
    DB AND plan expired. The endpoint must treat this user as admin-by-id (stale
    flag safety): hit is forwarded even though flag/plan say otherwise.
    """
    tid = settings.ADMIN_TELEGRAM_ID
    # Snapshot any pre-existing doc so we can restore it after the test session.
    existing = mongo_db.users.find_one({"telegram_id": tid})
    # Overwrite (or create) with stale-flag + expired plan
    now = datetime.now(timezone.utc)
    mongo_db.users.update_one(
        {"telegram_id": tid},
        {
            "$set": {
                "telegram_id": tid,
                "telegram_username": "TEST_admin_by_id",
                "telegram_first_name": "TEST",
                "telegram_last_name": "AdminById",
                "plan": "TRIAL",
                "plan_expires_at": now - timedelta(days=1),
                "is_admin": False,  # STALE flag — endpoint should still treat as admin via ADMIN_TELEGRAM_ID
                "is_banned": False,
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
    sid = _new_session(mongo_db, tid, TEST_FP)
    token = create_access_token(sid, tid, TEST_FP)
    yield {
        "telegram_id": tid,
        "session_id": sid,
        "fingerprint": TEST_FP,
        "token": token,
    }
    # Cleanup: drop test session + test hits, then restore original user doc (if any)
    mongo_db.sessions.delete_one({"session_id": sid})
    mongo_db.hits.delete_many({"telegram_id": tid, "gateway": "TestGateway"})
    if existing is not None:
        # Restore prior user doc verbatim (drop _id — pymongo forbids overwriting it in replace_one)
        existing.pop("_id", None)
        mongo_db.users.replace_one({"telegram_id": tid}, existing, upsert=True)
    else:
        mongo_db.users.delete_one({"telegram_id": tid})


@pytest.fixture
def revoked_user_token(mongo_db):
    """Create a fresh user+session, then revoke the session and return the token."""
    tid = 999000444
    _seed_user(mongo_db, tid, is_admin=False, expired=False, username="TEST_revoked")
    sid = _new_session(mongo_db, tid, TEST_FP)
    mongo_db.sessions.update_one({"session_id": sid}, {"$set": {"revoked": True}})
    token = create_access_token(sid, tid, TEST_FP)
    yield {"telegram_id": tid, "session_id": sid, "token": token}
    mongo_db.sessions.delete_many({"telegram_id": tid})
    mongo_db.users.delete_many({"telegram_id": tid})
