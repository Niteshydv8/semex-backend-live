"""Tests for /api/admin/db/nuke — OWNER-only total database wipe (Phase C)."""
from __future__ import annotations
import os
import httpx

BASE = os.environ.get("SEMEX_TEST_BASE", "http://localhost:8001")


def _hdrs(u):
    return {"Authorization": "Bearer " + u["token"], "X-Fingerprint": u["fingerprint"], "X-Extension-Version": "2.4.1"}


def test_nuke_requires_owner(admin_user):
    """A promoted admin (non-owner) must NOT be able to nuke the DB."""
    r = httpx.post(
        f"{BASE}/api/admin/db/nuke",
        headers={**_hdrs(admin_user), "Content-Type": "application/json"},
        json={"confirm": "NUKE"},
    )
    assert r.status_code == 403
    assert "Owner only" in r.text


def test_nuke_requires_confirmation_phrase(admin_by_id_user):
    """Owner without the right confirm phrase gets 400."""
    r = httpx.post(
        f"{BASE}/api/admin/db/nuke",
        headers={**_hdrs(admin_by_id_user), "Content-Type": "application/json"},
        json={"confirm": "wipe-it"},
    )
    assert r.status_code == 400
    assert "mismatch" in r.text.lower() or "confirmation" in r.text.lower()


def test_nuke_owner_confirmed_wipes_collections(admin_by_id_user, active_user, admin_user, expired_user, mongo_db):
    """Full owner nuke: users, sessions, hits, redeem_codes, user_bins, news_posts.

    After the nuke this test re-seeds the session-scoped fixture rows so
    subsequent tests in the same pytest session don't inherit an empty DB.
    """
    tid = active_user["telegram_id"]
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    mongo_db.hits.insert_one({"telegram_id": tid, "status": "CHARGED", "created_at": now, "user_id": "x", "site": "x", "card_last4": "1234"})
    mongo_db.user_bins.insert_one({"telegram_id": tid, "bin": "999999", "created_at": now})
    mongo_db.redeem_codes.insert_one({"code_hash": "x", "duration_days": 30, "created_at": now})
    mongo_db.news_posts.insert_one({"title": "x", "body": "y", "created_at": now})

    r = httpx.post(
        f"{BASE}/api/admin/db/nuke",
        headers={**_hdrs(admin_by_id_user), "Content-Type": "application/json"},
        json={"confirm": "NUKE"},
    )
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["success"] is True
    assert "wiped" in d
    for coll in ("users", "sessions", "hits", "redeem_codes", "user_bins", "news_posts"):
        assert coll in d["wiped"]
    assert mongo_db.users.count_documents({}) == 0
    assert mongo_db.sessions.count_documents({}) == 0
    assert mongo_db.hits.count_documents({}) == 0
    assert mongo_db.user_bins.count_documents({}) == 0
    assert mongo_db.redeem_codes.count_documents({}) == 0
    assert mongo_db.news_posts.count_documents({}) == 0
    # bin_cache is preserved by policy — do NOT assert on it.

    # --- Re-seed the session-scoped fixtures so downstream tests don't break.
    # Uses the same helpers as conftest.py so behaviour matches exactly.
    from tests.conftest import _seed_user  # local import — safe at test-time
    from datetime import timedelta
    from config import settings as _s
    _seed_user(mongo_db, active_user["telegram_id"], is_admin=False, expired=False, username="TEST_active")
    _seed_user(mongo_db, expired_user["telegram_id"], is_admin=False, expired=True, username="TEST_expired")
    _seed_user(mongo_db, admin_user["telegram_id"], is_admin=True, expired=False, username="TEST_admin")
    # admin_by_id_user — mimic the fixture setup
    mongo_db.users.update_one(
        {"telegram_id": _s.ADMIN_TELEGRAM_ID},
        {
            "$set": {
                "telegram_id": _s.ADMIN_TELEGRAM_ID,
                "telegram_username": "TEST_admin_by_id",
                "telegram_first_name": "TEST",
                "telegram_last_name": "AdminById",
                "plan": "TRIAL",
                "plan_expires_at": now - timedelta(days=1),
                "is_admin": False,
                "is_banned": False,
                "last_seen_at": now,
            },
            "$setOnInsert": {"created_at": now, "hit_count": 0, "charged_count": 0},
        },
        upsert=True,
    )
    # Re-insert the sessions carried by the fixtures.
    for u in (active_user, expired_user, admin_user, admin_by_id_user):
        mongo_db.sessions.insert_one({
            "session_id": u["session_id"],
            "telegram_id": u["telegram_id"],
            "fingerprint": u["fingerprint"],
            "device_info": {"ua": "pytest"},
            "created_at": now,
            "last_used_at": now,
            "expires_at": now + timedelta(days=60),
            "revoked": False,
        })