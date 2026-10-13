"""Regression: admin endpoints exposed in the extension Admin dashboard.

Verifies all admin surface exercised by the extension's popup.js loadAdminExtras
returns 200 with a valid admin token and 403 with a non-admin token:
- GET  /api/admin/stats
- GET  /api/admin/codes
- POST /api/admin/codes/generate
- DELETE /api/admin/codes/{id}
- GET  /api/admin/hits
- POST /api/admin/news
- DELETE /api/admin/news/{id}
- POST /api/admin/broadcast/preview
- POST /api/admin/broadcast
"""
from __future__ import annotations

import requests
import pytest

import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://127.0.0.1:8001").rstrip("/")


def _hdr(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "X-Fingerprint": "test-fp-000000000000000000000000000000", "X-Extension-Version": "9.9.9"}


# ---------- Stats ----------
# NOTE: since v2.9.5 ALL admin routes (reads included) are owner-only —
# promoted admins get 403. These tests therefore use the OWNER fixture
# (admin_by_id_user) for the 200 assertions.

class TestAdminStats:
    def test_stats_admin_200(self, admin_by_id_user):
        r = requests.get(f"{BASE_URL}/api/admin/stats", headers=_hdr(admin_by_id_user["token"]), timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert "users" in body and "hits" in body and "codes" in body

    def test_stats_non_admin_403(self, active_user):
        r = requests.get(f"{BASE_URL}/api/admin/stats", headers=_hdr(active_user["token"]), timeout=10)
        assert r.status_code == 403


# ---------- Redeem codes ----------

class TestAdminCodes:
    def test_codes_list_admin_200(self, admin_by_id_user):
        r = requests.get(f"{BASE_URL}/api/admin/codes", headers=_hdr(admin_by_id_user["token"]), timeout=10)
        assert r.status_code == 200
        assert "codes" in r.json()

    def test_codes_list_non_admin_403(self, active_user):
        r = requests.get(f"{BASE_URL}/api/admin/codes", headers=_hdr(active_user["token"]), timeout=10)
        assert r.status_code == 403

    def test_codes_generate_and_delete(self, admin_by_id_user):
        # Generate
        r = requests.post(
            f"{BASE_URL}/api/admin/codes/generate",
            headers=_hdr(admin_by_id_user["token"]),
            json={"days": 7, "quantity": 1, "prefix": "TEST"},
            timeout=10,
        )
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert body["count"] == 1
        assert len(body["codes"]) == 1

        # Find the generated code in the list to get its id
        r2 = requests.get(f"{BASE_URL}/api/admin/codes?used=false&limit=500",
                          headers=_hdr(admin_by_id_user["token"]), timeout=10)
        assert r2.status_code == 200
        codes = r2.json()["codes"]
        # The freshly generated code should be present with a TEST prefix preview
        matching = [c for c in codes if c["planTag"] == "WEEKLY" and not c["used"]]
        assert matching, "just-generated code not present in list"

        # Delete the most-recent one
        code_id = matching[0]["id"]
        r3 = requests.delete(f"{BASE_URL}/api/admin/codes/{code_id}",
                             headers=_hdr(admin_by_id_user["token"]), timeout=10)
        assert r3.status_code == 200
        assert r3.json()["success"] is True

    def test_codes_generate_non_admin_403(self, active_user):
        r = requests.post(
            f"{BASE_URL}/api/admin/codes/generate",
            headers=_hdr(active_user["token"]),
            json={"days": 7, "quantity": 1},
            timeout=10,
        )
        assert r.status_code == 403


# ---------- Hits feed ----------

class TestAdminHits:
    def test_hits_admin_200(self, admin_by_id_user):
        r = requests.get(f"{BASE_URL}/api/admin/hits?limit=10",
                         headers=_hdr(admin_by_id_user["token"]), timeout=10)
        assert r.status_code == 200
        assert "hits" in r.json()

    def test_hits_non_admin_403(self, active_user):
        r = requests.get(f"{BASE_URL}/api/admin/hits", headers=_hdr(active_user["token"]), timeout=10)
        assert r.status_code == 403


# ---------- Broadcast ----------

class TestAdminBroadcast:
    def test_broadcast_preview_admin_200(self, admin_by_id_user):
        r = requests.post(
            f"{BASE_URL}/api/admin/broadcast/preview",
            headers=_hdr(admin_by_id_user["token"]),
            json={"include_admins": False, "include_expired": False},
            timeout=10,
        )
        assert r.status_code == 200
        assert "count" in r.json()
        assert isinstance(r.json()["count"], int)

    def test_broadcast_preview_non_admin_403(self, active_user):
        r = requests.post(
            f"{BASE_URL}/api/admin/broadcast/preview",
            headers=_hdr(active_user["token"]),
            json={},
            timeout=10,
        )
        assert r.status_code == 403

    def test_broadcast_send_admin_200(self, admin_by_id_user, mongo_db):
        # Send to a query that yields no users (only_plans=["NON_EXISTENT_PLAN"])
        # so no real Telegram calls are made — but the endpoint must still 200.
        r = requests.post(
            f"{BASE_URL}/api/admin/broadcast",
            headers=_hdr(admin_by_id_user["token"]),
            json={"message": "TEST_regression_do_not_deliver",
                  "include_admins": False,
                  "include_expired": False,
                  "only_plans": ["NON_EXISTENT_PLAN_TEST"]},
            timeout=15,
        )
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert body["sent"] == 0
        assert body["failed"] == 0

    def test_broadcast_send_non_admin_403(self, active_user):
        r = requests.post(
            f"{BASE_URL}/api/admin/broadcast",
            headers=_hdr(active_user["token"]),
            json={"message": "x"},
            timeout=10,
        )
        assert r.status_code == 403


# ---------- News ----------

class TestAdminNews:
    def test_news_post_and_delete(self, admin_by_id_user, mongo_db):
        r = requests.post(
            f"{BASE_URL}/api/admin/news",
            headers=_hdr(admin_by_id_user["token"]),
            json={"title": "TEST_regression_news", "body": "hello", "important": False},
            timeout=10,
        )
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        news_id = body["id"]

        # Cleanup
        r2 = requests.delete(f"{BASE_URL}/api/admin/news/{news_id}",
                             headers=_hdr(admin_by_id_user["token"]), timeout=10)
        assert r2.status_code == 200
        assert r2.json()["success"] is True

    def test_news_post_non_admin_403(self, active_user):
        r = requests.post(
            f"{BASE_URL}/api/admin/news",
            headers=_hdr(active_user["token"]),
            json={"title": "x", "body": "y"},
            timeout=10,
        )
        assert r.status_code == 403
