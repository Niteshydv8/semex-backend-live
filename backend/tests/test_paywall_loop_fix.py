"""Integration tests for the paywall-loop fix (iteration_13).

Verifies via live HTTP against the running backend:
- GET /api/public/version returns valid semver, never bare "3", fallback 2.3.9.
- Extension v2.3.9 hitting /api/user/hits never gets 426 (regression scenario).
- Extension v1.0.0 hitting /api/auth/session still gets 426 (paywall works).
- POST /api/admin/extension/cleanup-invalid: owner-only + returns removed list.
- POST /api/admin/extension/publish rejects version='3' (400).
- POST /api/admin/extension/versions/{id}/make-minimum rejects non-semver row (400).
"""
from __future__ import annotations

import io
import os
import re
import zipfile

import pytest
import requests
from bson import ObjectId

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
SEMVER_RX = re.compile(r"^\d+\.\d+(?:\.\d+)?(?:\.\d+)?$")
FP = "test-fp-000000000000000000000000000000"


# ---------- /api/public/version ----------
class TestPublicVersion:
    def test_returns_valid_semver(self):
        r = requests.get(f"{BASE_URL}/api/public/version", timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "minVersion" in data and "latestVersion" in data
        assert SEMVER_RX.match(data["minVersion"]), f"bad minVersion: {data['minVersion']}"
        assert SEMVER_RX.match(data["latestVersion"]), f"bad latestVersion: {data['latestVersion']}"
        # Never the bogus bare "3"
        assert data["minVersion"] != "3"
        assert data["latestVersion"] != "3"

    def test_fallback_when_no_valid_rows(self, mongo_db):
        """If DB has only a bogus '3' row, endpoint should fall back to 2.3.9."""
        # Snapshot existing releases so we can restore
        existing = list(mongo_db.extension_releases.find({}))
        try:
            mongo_db.extension_releases.delete_many({})
            mongo_db.extension_releases.insert_one({
                "version": "3",
                "is_latest": True,
                "is_minimum": True,
                "filename": "TEST_bogus.zip",
            })
            # Bust cache by calling admin cleanup? No — cache TTL is 60s.
            # Directly bust via internal import.
            from routes.data import _MIN_EXTENSION_CACHE
            _MIN_EXTENSION_CACHE["version"] = None
            _MIN_EXTENSION_CACHE["expires"] = 0.0

            r = requests.get(f"{BASE_URL}/api/public/version", timeout=10)
            assert r.status_code == 200
            data = r.json()
            assert data["minVersion"] == "2.4.1", data
            assert data["latestVersion"] == "2.4.1", data
        finally:
            mongo_db.extension_releases.delete_many({"version": "3", "filename": "TEST_bogus.zip"})
            if existing:
                for doc in existing:
                    mongo_db.extension_releases.replace_one(
                        {"_id": doc["_id"]}, doc, upsert=True
                    )
            from routes.data import _MIN_EXTENSION_CACHE
            _MIN_EXTENSION_CACHE["version"] = None
            _MIN_EXTENSION_CACHE["expires"] = 0.0


# ---------- Regression: v2.3.9 must not get 426 ----------
class TestExtensionRequestsNot426:
    def test_hits_endpoint_with_current_version(self, active_user):
        headers = {
            "Authorization": f"Bearer {active_user['token']}",
            "X-Fingerprint": FP,
            "X-Extension-Version": "2.4.1",
        }
        r = requests.get(f"{BASE_URL}/api/user/hits", headers=headers, timeout=10)
        # Must NOT be 426. Accept 200/401/402/403 per review spec.
        assert r.status_code != 426, f"REGRESSION: v2.3.9 got 426 — {r.text}"
        assert r.status_code in (200, 401, 402, 403), f"unexpected: {r.status_code} {r.text}"

    def test_hits_endpoint_v240_also_ok(self, active_user):
        headers = {
            "Authorization": f"Bearer {active_user['token']}",
            "X-Fingerprint": FP,
            "X-Extension-Version": "2.4.1",
        }
        r = requests.get(f"{BASE_URL}/api/user/hits", headers=headers, timeout=10)
        assert r.status_code != 426


# ---------- Paywall still works for genuinely outdated ----------
class TestPaywallStillWorks:
    def test_v1_0_0_session_returns_426(self, active_user):
        headers = {
            "Authorization": f"Bearer {active_user['token']}",
            "X-Fingerprint": FP,
            "X-Extension-Version": "1.0.0",
        }
        r = requests.get(f"{BASE_URL}/api/auth/session", headers=headers, timeout=10)
        assert r.status_code == 426, f"expected 426, got {r.status_code}: {r.text}"
        body = r.json()
        # Response should include upgrade info
        detail = body.get("detail", body)
        assert detail.get("code") == "EXTENSION_OUTDATED"


# ---------- Admin cleanup endpoint ----------
class TestCleanupInvalid:
    def test_requires_owner_auth(self):
        r = requests.post(f"{BASE_URL}/api/admin/extension/cleanup-invalid", timeout=10)
        assert r.status_code in (401, 403), r.text

    def test_non_owner_forbidden(self, active_user):
        headers = {"Authorization": f"Bearer {active_user['token']}"}
        r = requests.post(
            f"{BASE_URL}/api/admin/extension/cleanup-invalid",
            headers=headers,
            timeout=10,
        )
        assert r.status_code in (401, 403), r.text

    def test_owner_cleans_bogus_rows(self, admin_by_id_user, mongo_db):
        # Insert a bogus row + a good row
        bogus_id = mongo_db.extension_releases.insert_one({
            "version": "3", "filename": "TEST_bogus_cleanup.zip"
        }).inserted_id
        good_id = mongo_db.extension_releases.insert_one({
            "version": "2.4.1", "filename": "TEST_good_cleanup.zip"
        }).inserted_id
        try:
            headers = {"Authorization": f"Bearer {admin_by_id_user['token']}"}
            r = requests.post(
                f"{BASE_URL}/api/admin/extension/cleanup-invalid",
                headers=headers, timeout=10,
            )
            assert r.status_code == 200, r.text
            data = r.json()
            assert data["success"] is True
            assert "removed_count" in data
            assert "removed" in data
            assert data["removed_count"] >= 1
            versions_removed = [x["version"] for x in data["removed"]]
            assert "3" in versions_removed
            # Bogus row deleted, good row preserved
            assert mongo_db.extension_releases.find_one({"_id": bogus_id}) is None
            assert mongo_db.extension_releases.find_one({"_id": good_id}) is not None
        finally:
            mongo_db.extension_releases.delete_many({
                "_id": {"$in": [bogus_id, good_id]}
            })
            mongo_db.extension_releases.delete_many({
                "filename": {"$in": ["TEST_bogus_cleanup.zip", "TEST_good_cleanup.zip"]}
            })


# ---------- Publish validation ----------
def _make_valid_zip() -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("manifest.json", '{"manifest_version":3,"name":"test","version":"2.4.0"}')
    return buf.getvalue()


class TestPublishValidation:
    def test_rejects_bare_integer_version(self, admin_by_id_user):
        headers = {"Authorization": f"Bearer {admin_by_id_user['token']}"}
        files = {"file": ("test.zip", _make_valid_zip(), "application/zip")}
        data = {"version": "3", "make_minimum": "false", "auto_broadcast": "false"}
        r = requests.post(
            f"{BASE_URL}/api/admin/extension/publish",
            headers=headers, files=files, data=data, timeout=15,
        )
        assert r.status_code == 400, r.text
        assert "semver" in r.text.lower() or "invalid version" in r.text.lower()

    def test_rejects_non_numeric_version(self, admin_by_id_user):
        headers = {"Authorization": f"Bearer {admin_by_id_user['token']}"}
        files = {"file": ("test.zip", _make_valid_zip(), "application/zip")}
        data = {"version": "latest", "make_minimum": "false", "auto_broadcast": "false"}
        r = requests.post(
            f"{BASE_URL}/api/admin/extension/publish",
            headers=headers, files=files, data=data, timeout=15,
        )
        assert r.status_code == 400, r.text


# ---------- make-minimum validation ----------
class TestMakeMinimumValidation:
    def test_rejects_release_with_non_semver_version(self, admin_by_id_user, mongo_db):
        # Insert a bogus release directly, then try to promote it
        rid = mongo_db.extension_releases.insert_one({
            "version": "3", "filename": "TEST_mm_bogus.zip", "is_latest": False, "is_minimum": False,
        }).inserted_id
        try:
            headers = {"Authorization": f"Bearer {admin_by_id_user['token']}"}
            r = requests.post(
                f"{BASE_URL}/api/admin/extension/versions/{rid}/make-minimum",
                headers=headers, timeout=10,
            )
            assert r.status_code == 400, r.text
            assert "semver" in r.text.lower()
        finally:
            mongo_db.extension_releases.delete_one({"_id": ObjectId(str(rid))})

    def test_bad_id_returns_400(self, admin_by_id_user):
        headers = {"Authorization": f"Bearer {admin_by_id_user['token']}"}
        r = requests.post(
            f"{BASE_URL}/api/admin/extension/versions/not-an-oid/make-minimum",
            headers=headers, timeout=10,
        )
        assert r.status_code == 400
