"""Tests for the six admin extension-manager endpoints introduced for
the v2.4.0 release UI. Covers auth gates (401/403), semver validation,
and owner-only enforcement on the four mutation endpoints.

We deliberately do NOT test happy-path publish here — that's covered in
test_extension_releases.py. This file focuses on:
  1. GET  /api/admin/extension/versions       (admin OK, no-auth 401)
  2. POST /api/admin/extension/cleanup-invalid (owner-only 403 vs 200)
  3. POST /api/admin/extension/publish         (owner-only, semver reject)
  4. POST /api/admin/extension/versions/{id}/make-latest   (owner-only)
  5. POST /api/admin/extension/versions/{id}/make-minimum  (owner-only + semver check)
  6. Regression: admin.html served with all JS handlers
"""
from __future__ import annotations

from pathlib import Path

import pytest
import requests
from bson import ObjectId

BASE_URL = "http://localhost:8001"
FP = "test-fp-000000000000000000000000000000"


def _hdr(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "X-Fingerprint": FP, "X-Extension-Version": "2.4.1"}


@pytest.fixture(autouse=True)
def _clear_releases(mongo_db):
    mongo_db.extension_releases.delete_many({})
    yield
    mongo_db.extension_releases.delete_many({})


# ---------- GET /api/admin/extension/versions ----------

class TestListVersions:
    def test_no_auth_401(self):
        r = requests.get(f"{BASE_URL}/api/admin/extension/versions", timeout=10)
        assert r.status_code == 401

    def test_admin_returns_releases_shape(self, admin_user, mongo_db):
        # Seed one release doc directly so we can validate response shape
        from datetime import datetime, timezone
        oid = ObjectId()
        mongo_db.extension_releases.insert_one({
            "_id": oid,
            "version": "2.4.0",
            "filename": "semex-2.4.0-20260101-000000.zip",
            "file_path": "/tmp/whatever.zip",
            "size_bytes": 12345,
            "notes": "test",
            "is_latest": True,
            "is_minimum": True,
            "published_by": 5762701937,
            "published_at": datetime.now(timezone.utc),
            "obfuscated": True,
            "download_count": 3,
        })
        r = requests.get(
            f"{BASE_URL}/api/admin/extension/versions",
            headers=_hdr(admin_user["token"]),
            timeout=10,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "releases" in body and isinstance(body["releases"], list)
        assert len(body["releases"]) == 1
        rel = body["releases"][0]
        for k in ("id", "version", "filename", "sizeBytes", "isLatest", "isMinimum", "publishedAt", "downloadCount"):
            assert k in rel, f"missing key {k} in {rel}"
        assert rel["version"] == "2.4.0"
        assert rel["isLatest"] is True
        assert rel["isMinimum"] is True
        assert rel["downloadCount"] == 3


# ---------- POST /api/admin/extension/cleanup-invalid ----------

class TestCleanupInvalid:
    def test_no_auth_401(self):
        r = requests.post(f"{BASE_URL}/api/admin/extension/cleanup-invalid", timeout=10)
        assert r.status_code == 401

    def test_admin_non_owner_403(self, admin_user):
        # admin_user is 999000333 (is_admin=True) but NOT the owner id 5762701937
        r = requests.post(
            f"{BASE_URL}/api/admin/extension/cleanup-invalid",
            headers=_hdr(admin_user["token"]),
            timeout=10,
        )
        assert r.status_code == 403, r.text

    def test_owner_removes_invalid_semver(self, admin_by_id_user, mongo_db):
        # Seed two bogus rows + one valid row
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)
        mongo_db.extension_releases.insert_many([
            {"version": "3", "filename": "bogus1.zip", "file_path": "/tmp/x", "size_bytes": 1,
             "is_latest": False, "is_minimum": False, "published_at": now},
            {"version": "abc", "filename": "bogus2.zip", "file_path": "/tmp/x", "size_bytes": 1,
             "is_latest": False, "is_minimum": False, "published_at": now},
            {"version": "2.4.0", "filename": "good.zip", "file_path": "/tmp/x", "size_bytes": 1,
             "is_latest": True, "is_minimum": False, "published_at": now},
        ])
        r = requests.post(
            f"{BASE_URL}/api/admin/extension/cleanup-invalid",
            headers=_hdr(admin_by_id_user["token"]),
            timeout=10,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["success"] is True
        assert body["removed_count"] == 2
        assert isinstance(body["removed"], list) and len(body["removed"]) == 2
        removed_versions = sorted(x["version"] for x in body["removed"])
        assert removed_versions == ["3", "abc"]
        # Valid row still there
        assert mongo_db.extension_releases.count_documents({}) == 1
        assert mongo_db.extension_releases.find_one({})["version"] == "2.4.0"


# ---------- POST /api/admin/extension/publish (owner + semver) ----------

class TestPublishOwnerAndSemver:
    def test_no_auth_401(self):
        r = requests.post(
            f"{BASE_URL}/api/admin/extension/publish",
            files={"file": ("x.zip", b"PK\x03\x04data", "application/zip")},
            data={"version": "2.4.0"},
            timeout=10,
        )
        assert r.status_code == 401

    def test_admin_non_owner_403(self, admin_user):
        r = requests.post(
            f"{BASE_URL}/api/admin/extension/publish",
            headers=_hdr(admin_user["token"]),
            files={"file": ("x.zip", b"PK\x03\x04data", "application/zip")},
            data={"version": "2.4.0"},
            timeout=10,
        )
        assert r.status_code == 403, r.text

    def test_owner_bad_semver_400(self, admin_by_id_user):
        # Version "3" is not semver — must reject with 400 before touching file bytes
        r = requests.post(
            f"{BASE_URL}/api/admin/extension/publish",
            headers=_hdr(admin_by_id_user["token"]),
            files={"file": ("x.zip", b"PK\x03\x04data", "application/zip")},
            data={"version": "3"},
            timeout=15,
        )
        assert r.status_code == 400, r.text
        assert "semver" in r.text.lower() or "invalid version" in r.text.lower()

    def test_owner_accepts_semver_but_needs_valid_zip(self, admin_by_id_user):
        # Version "2.4.0" is accepted by semver check; empty body → 400 later.
        r = requests.post(
            f"{BASE_URL}/api/admin/extension/publish",
            headers=_hdr(admin_by_id_user["token"]),
            files={"file": ("x.zip", b"", "application/zip")},
            data={"version": "2.4.0"},
            timeout=15,
        )
        # 400 = empty upload (post-semver), NOT 400 for invalid version
        assert r.status_code == 400
        assert "empty" in r.text.lower()


# ---------- POST make-latest / make-minimum owner + semver ----------

class TestMakeLatestMinimumOwner:
    def _seed_release(self, mongo_db, version: str) -> str:
        from datetime import datetime, timezone
        r = mongo_db.extension_releases.insert_one({
            "version": version,
            "filename": f"seed-{version}.zip",
            "file_path": "/tmp/x",
            "size_bytes": 1,
            "is_latest": False,
            "is_minimum": False,
            "published_at": datetime.now(timezone.utc),
        })
        return str(r.inserted_id)

    def test_make_latest_no_auth_401(self, mongo_db):
        rid = self._seed_release(mongo_db, "2.4.0")
        r = requests.post(f"{BASE_URL}/api/admin/extension/versions/{rid}/make-latest", timeout=10)
        assert r.status_code == 401

    def test_make_latest_admin_non_owner_403(self, admin_user, mongo_db):
        rid = self._seed_release(mongo_db, "2.4.0")
        r = requests.post(
            f"{BASE_URL}/api/admin/extension/versions/{rid}/make-latest",
            headers=_hdr(admin_user["token"]),
            timeout=10,
        )
        assert r.status_code == 403

    def test_make_latest_owner_ok(self, admin_by_id_user, mongo_db):
        rid = self._seed_release(mongo_db, "2.4.0")
        r = requests.post(
            f"{BASE_URL}/api/admin/extension/versions/{rid}/make-latest",
            headers=_hdr(admin_by_id_user["token"]),
            timeout=10,
        )
        assert r.status_code == 200
        assert r.json()["success"] is True
        assert mongo_db.extension_releases.find_one({"_id": ObjectId(rid)})["is_latest"] is True

    def test_make_minimum_admin_non_owner_403(self, admin_user, mongo_db):
        rid = self._seed_release(mongo_db, "2.4.0")
        r = requests.post(
            f"{BASE_URL}/api/admin/extension/versions/{rid}/make-minimum",
            headers=_hdr(admin_user["token"]),
            timeout=10,
        )
        assert r.status_code == 403

    def test_make_minimum_owner_rejects_bad_semver(self, admin_by_id_user, mongo_db):
        # Stored version is "3" — must refuse to promote as minimum
        rid = self._seed_release(mongo_db, "3")
        r = requests.post(
            f"{BASE_URL}/api/admin/extension/versions/{rid}/make-minimum",
            headers=_hdr(admin_by_id_user["token"]),
            timeout=10,
        )
        assert r.status_code == 400, r.text
        assert "semver" in r.text.lower()

    def test_make_minimum_owner_accepts_semver(self, admin_by_id_user, mongo_db):
        rid = self._seed_release(mongo_db, "2.4.0")
        r = requests.post(
            f"{BASE_URL}/api/admin/extension/versions/{rid}/make-minimum",
            headers=_hdr(admin_by_id_user["token"]),
            timeout=10,
        )
        assert r.status_code == 200, r.text
        assert r.json()["success"] is True
        assert mongo_db.extension_releases.find_one({"_id": ObjectId(rid)})["is_minimum"] is True


# ---------- Regression: admin.html new tab + JS handlers ----------

class TestAdminHtmlHandlers:
    def test_admin_html_served_with_all_handlers(self):
        r = requests.get(f"{BASE_URL}/admin", timeout=10)
        assert r.status_code == 200
        html = r.text
        # Nav tab
        assert 'data-tab="extension"' in html
        assert "🧩 Extension" in html
        # Panel
        assert 'id="tab-extension"' in html
        # JS handlers
        for fn in (
            "loadExtensions",
            "uploadExtension",
            "makeLatest",
            "makeMinimum",
            "cleanupInvalid",
            "broadcastRelease",
            "deleteRelease",
        ):
            assert fn in html, f"admin.html missing JS handler: {fn}"
