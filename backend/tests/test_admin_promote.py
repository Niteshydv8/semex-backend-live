"""Tests for Owner-only admin promote/demote and Owner DM mirror behaviour."""
from __future__ import annotations

import os
import httpx
import pytest

# The suite hits the real running backend via the internal port; conftest seeds all users.
BASE = os.environ.get("SEMEX_TEST_BASE", "http://localhost:8001")


def _hdrs(u):
    return {"Authorization": "Bearer " + u["token"], "X-Fingerprint": u["fingerprint"], "X-Extension-Version": "2.4.1"}


def test_is_owner_true_for_owner_by_id(admin_by_id_user):
    r = httpx.get(f"{BASE}/api/admin/is-owner", headers=_hdrs(admin_by_id_user))
    assert r.status_code == 200
    assert r.json().get("isOwner") is True


def test_is_owner_false_for_promoted_admin(admin_user):
    r = httpx.get(f"{BASE}/api/admin/is-owner", headers=_hdrs(admin_user))
    assert r.status_code == 200
    assert r.json().get("isOwner") is False


def test_promoted_admin_cannot_promote(admin_user, active_user):
    r = httpx.post(
        f"{BASE}/api/admin/users/promote",
        headers={**_hdrs(admin_user), "Content-Type": "application/json"},
        json={"telegramId": active_user["telegram_id"]},
    )
    assert r.status_code == 403
    assert "Owner only" in r.text


def test_owner_can_promote_and_demote(admin_by_id_user, active_user, mongo_db):
    tid = active_user["telegram_id"]

    # Promote
    r = httpx.post(
        f"{BASE}/api/admin/users/promote",
        headers={**_hdrs(admin_by_id_user), "Content-Type": "application/json"},
        json={"telegramId": tid},
    )
    assert r.status_code == 200, r.text
    assert r.json().get("isAdmin") is True
    doc = mongo_db.users.find_one({"telegram_id": tid})
    assert doc.get("is_admin") is True

    # Demote
    r = httpx.post(
        f"{BASE}/api/admin/users/demote",
        headers={**_hdrs(admin_by_id_user), "Content-Type": "application/json"},
        json={"telegramId": tid},
    )
    assert r.status_code == 200, r.text
    assert r.json().get("isAdmin") is False
    doc = mongo_db.users.find_one({"telegram_id": tid})
    assert doc.get("is_admin") is False


def test_owner_cannot_demote_self(admin_by_id_user):
    r = httpx.post(
        f"{BASE}/api/admin/users/demote",
        headers={**_hdrs(admin_by_id_user), "Content-Type": "application/json"},
        json={"telegramId": admin_by_id_user["telegram_id"]},
    )
    assert r.status_code == 400
    assert "owner" in r.text.lower()


def test_promote_unknown_user_404(admin_by_id_user):
    r = httpx.post(
        f"{BASE}/api/admin/users/promote",
        headers={**_hdrs(admin_by_id_user), "Content-Type": "application/json"},
        json={"telegramId": 111111111111},
    )
    assert r.status_code == 404
