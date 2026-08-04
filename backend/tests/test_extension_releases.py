"""Tests for the Extension Release management surface.

Covers:
- GET  /api/admin/extension/versions (auth-gated)
- POST /api/admin/extension/publish (validation + happy path + demotion)
- POST /api/admin/extension/versions/{id}/make-latest
- DELETE /api/admin/extension/versions/{id} (auto-promotion after delete-latest)
- POST /api/admin/extension/versions/{id}/broadcast
- GET  /api/telegram/download/extension (release preferred; legacy fallback)
- POST /api/telegram/webhook /get command uses latest release

All test data is cleaned up in the module teardown fixture below.
"""
from __future__ import annotations

import io
import os
import struct
import zipfile
from pathlib import Path

import pytest
import requests

BASE_URL = "http://localhost:8001"
FP = "test-fp-000000000000000000000000000000"
VALID_ZIP = Path("/app/semex-v2.2.0.zip")


def _hdr(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "X-Fingerprint": FP, "X-Extension-Version": "2.4.1"}


def _make_zip_bytes(members: dict[str, bytes]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, data in members.items():
            zf.writestr(name, data)
    return buf.getvalue()


@pytest.fixture(scope="module", autouse=True)
def _cleanup_releases(mongo_db):
    """Wipe extension_releases collection + release files created by this
    test module. Runs after every test in this module."""
    # Snapshot files that already exist so we don't nuke pre-existing ones
    releases_dir = Path("/app/extension_releases")
    pre_existing = set(p.name for p in releases_dir.glob("*.zip")) if releases_dir.exists() else set()
    yield
    # Teardown: drop all release docs (test-owned collection) + created files
    try:
        mongo_db.extension_releases.delete_many({})
    except Exception:
        pass
    if releases_dir.exists():
        for p in releases_dir.glob("*.zip"):
            if p.name not in pre_existing:
                try:
                    p.unlink()
                except Exception:
                    pass


@pytest.fixture(autouse=True)
def _clear_between_tests(mongo_db):
    """Also clear between individual tests to make each test independent."""
    mongo_db.extension_releases.delete_many({})
    yield


# ---------- GET /versions auth ----------

class TestListVersionsAuth:
    def test_list_versions_no_auth_401(self):
        r = requests.get(f"{BASE_URL}/api/admin/extension/versions", timeout=10)
        assert r.status_code == 401

    def test_list_versions_active_user_403(self, active_user):
        r = requests.get(
            f"{BASE_URL}/api/admin/extension/versions",
            headers=_hdr(active_user["token"]),
            timeout=10,
        )
        assert r.status_code == 403

    def test_list_versions_admin_empty(self, admin_user):
        r = requests.get(
            f"{BASE_URL}/api/admin/extension/versions",
            headers=_hdr(admin_user["token"]),
            timeout=10,
        )
        assert r.status_code == 200
        body = r.json()
        assert "releases" in body
        assert body["releases"] == []


# ---------- POST /publish validation ----------

class TestPublishValidation:
    def test_publish_empty_file_400(self, admin_user):
        files = {"file": ("empty.zip", b"", "application/zip")}
        data = {"version": "v0.0.1"}
        r = requests.post(
            f"{BASE_URL}/api/admin/extension/publish",
            headers=_hdr(admin_user["token"]),
            files=files,
            data=data,
            timeout=15,
        )
        assert r.status_code == 400
        assert "empty" in r.text.lower()

    def test_publish_non_zip_400(self, admin_user):
        # File without PK magic
        files = {"file": ("junk.zip", b"NOT_A_ZIP_JUST_TEXT" * 20, "application/zip")}
        data = {"version": "v0.0.2"}
        r = requests.post(
            f"{BASE_URL}/api/admin/extension/publish",
            headers=_hdr(admin_user["token"]),
            files=files,
            data=data,
            timeout=15,
        )
        assert r.status_code == 400
        assert "not a valid .zip" in r.text.lower() or "not a valid zip" in r.text.lower()

    def test_publish_zip_without_manifest_400(self, admin_user):
        zbytes = _make_zip_bytes({"readme.txt": b"hello world"})
        assert zbytes.startswith(b"PK\x03\x04")
        files = {"file": ("nomani.zip", zbytes, "application/zip")}
        data = {"version": "v0.0.3"}
        r = requests.post(
            f"{BASE_URL}/api/admin/extension/publish",
            headers=_hdr(admin_user["token"]),
            files=files,
            data=data,
            timeout=15,
        )
        assert r.status_code == 400
        assert "chrome extension" in r.text.lower() or "manifest" in r.text.lower()


# ---------- POST /publish happy path + demotion ----------

class TestPublishHappyPath:
    def test_publish_valid_zip_sets_is_latest(self, admin_user):
        assert VALID_ZIP.exists(), f"Missing test fixture {VALID_ZIP}"
        with open(VALID_ZIP, "rb") as f:
            files = {"file": (VALID_ZIP.name, f.read(), "application/zip")}
        data = {"version": "v2.2.0", "notes": "test build"}
        r = requests.post(
            f"{BASE_URL}/api/admin/extension/publish",
            headers=_hdr(admin_user["token"]),
            files=files,
            data=data,
            timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["success"] is True
        assert isinstance(body.get("obfuscated"), bool)
        assert "id" in body and len(body["id"]) > 0

        # GET /versions confirms is_latest is set
        r2 = requests.get(
            f"{BASE_URL}/api/admin/extension/versions",
            headers=_hdr(admin_user["token"]),
            timeout=10,
        )
        assert r2.status_code == 200
        rels = r2.json()["releases"]
        assert len(rels) == 1
        assert rels[0]["isLatest"] is True
        assert rels[0]["version"] == "v2.2.0"

    def test_publish_v2_demotes_v1(self, admin_user):
        # Publish v1
        with open(VALID_ZIP, "rb") as f:
            v1 = f.read()
        r1 = requests.post(
            f"{BASE_URL}/api/admin/extension/publish",
            headers=_hdr(admin_user["token"]),
            files={"file": ("v1.zip", v1, "application/zip")},
            data={"version": "v1.0.0"},
            timeout=30,
        )
        assert r1.status_code == 200
        # Publish v2
        r2 = requests.post(
            f"{BASE_URL}/api/admin/extension/publish",
            headers=_hdr(admin_user["token"]),
            files={"file": ("v2.zip", v1, "application/zip")},
            data={"version": "v2.0.0"},
            timeout=30,
        )
        assert r2.status_code == 200

        # Check listing
        r3 = requests.get(
            f"{BASE_URL}/api/admin/extension/versions",
            headers=_hdr(admin_user["token"]),
            timeout=10,
        )
        assert r3.status_code == 200
        rels = r3.json()["releases"]
        assert len(rels) == 2
        latest_flags = [rel["isLatest"] for rel in rels]
        # Exactly one is_latest
        assert latest_flags.count(True) == 1
        # And it's the v2 one (newest first per sort)
        by_ver = {rel["version"]: rel for rel in rels}
        assert by_ver["v2.0.0"]["isLatest"] is True
        assert by_ver["v1.0.0"]["isLatest"] is False


# ---------- make-latest / delete / broadcast ----------

class TestPromoteDeleteBroadcast:
    def _publish(self, admin_user, version: str) -> str:
        with open(VALID_ZIP, "rb") as f:
            data = f.read()
        r = requests.post(
            f"{BASE_URL}/api/admin/extension/publish",
            headers=_hdr(admin_user["token"]),
            files={"file": (f"{version}.zip", data, "application/zip")},
            data={"version": version},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        return r.json()["id"]

    def test_make_latest_promotes_older(self, admin_user):
        v1_id = self._publish(admin_user, "v1.0.0")
        v2_id = self._publish(admin_user, "v2.0.0")

        # Currently v2 is latest → promote v1
        r = requests.post(
            f"{BASE_URL}/api/admin/extension/versions/{v1_id}/make-latest",
            headers=_hdr(admin_user["token"]),
            timeout=10,
        )
        assert r.status_code == 200
        assert r.json()["success"] is True

        r2 = requests.get(
            f"{BASE_URL}/api/admin/extension/versions",
            headers=_hdr(admin_user["token"]),
            timeout=10,
        )
        rels = {rel["id"]: rel for rel in r2.json()["releases"]}
        assert rels[v1_id]["isLatest"] is True
        assert rels[v2_id]["isLatest"] is False

    def test_delete_release_auto_promotes(self, admin_user):
        v1_id = self._publish(admin_user, "v1.0.0")
        v2_id = self._publish(admin_user, "v2.0.0")

        # v2 is latest. Delete v2 -> v1 should be auto-promoted.
        # Grab file path first
        r0 = requests.get(
            f"{BASE_URL}/api/admin/extension/versions",
            headers=_hdr(admin_user["token"]),
            timeout=10,
        )
        v2_filename = next(rel["filename"] for rel in r0.json()["releases"] if rel["id"] == v2_id)
        v2_disk = Path("/app/extension_releases") / v2_filename
        assert v2_disk.exists(), "release file must exist on disk before delete"

        r = requests.delete(
            f"{BASE_URL}/api/admin/extension/versions/{v2_id}",
            headers=_hdr(admin_user["token"]),
            timeout=10,
        )
        assert r.status_code == 200
        assert r.json()["success"] is True
        assert not v2_disk.exists(), "release file must be removed from disk"

        r2 = requests.get(
            f"{BASE_URL}/api/admin/extension/versions",
            headers=_hdr(admin_user["token"]),
            timeout=10,
        )
        rels = r2.json()["releases"]
        assert len(rels) == 1
        assert rels[0]["id"] == v1_id
        assert rels[0]["isLatest"] is True

    def test_broadcast_returns_sent_failed(self, admin_user):
        rid = self._publish(admin_user, "v3.0.0")
        r = requests.post(
            f"{BASE_URL}/api/admin/extension/versions/{rid}/broadcast",
            headers={**_hdr(admin_user["token"]), "Content-Type": "application/json"},
            json={"include_admins": True, "include_expired": False},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["success"] is True
        assert "sent" in body and "failed" in body
        assert isinstance(body["sent"], int)
        assert isinstance(body["failed"], int)


# ---------- /api/telegram/download/extension ----------

class TestPublicDownload:
    def test_download_falls_back_to_legacy_when_no_releases(self):
        # Cleared by autouse fixture. Legacy zip exists at /app/semex-v2.2.0.zip.
        r = requests.get(f"{BASE_URL}/api/telegram/download/extension", timeout=30)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/zip")
        assert r.content[:4] == b"PK\x03\x04"

    def test_download_serves_release_and_bumps_count(self, admin_user, mongo_db):
        # Publish a release
        with open(VALID_ZIP, "rb") as f:
            data = f.read()
        r = requests.post(
            f"{BASE_URL}/api/admin/extension/publish",
            headers=_hdr(admin_user["token"]),
            files={"file": ("v9.zip", data, "application/zip")},
            data={"version": "v9.9.9"},
            timeout=30,
        )
        assert r.status_code == 200
        rid = r.json()["id"]
        expected_size = r.json()["sizeBytes"]

        # Download twice
        r1 = requests.get(f"{BASE_URL}/api/telegram/download/extension", timeout=30)
        assert r1.status_code == 200
        assert int(r1.headers.get("content-length", "0")) == expected_size
        assert len(r1.content) == expected_size

        r2 = requests.get(f"{BASE_URL}/api/telegram/download/extension", timeout=30)
        assert r2.status_code == 200

        # download_count should be >= 2
        from bson import ObjectId
        doc = mongo_db.extension_releases.find_one({"_id": ObjectId(rid)})
        assert doc is not None
        assert doc.get("download_count", 0) >= 2


# ---------- POST /api/telegram/webhook /get uses latest release ----------

class TestWebhookGetUsesLatest:
    def test_webhook_get_returns_ok(self, admin_user):
        # Publish a release so /get resolves to it
        with open(VALID_ZIP, "rb") as f:
            data = f.read()
        pr = requests.post(
            f"{BASE_URL}/api/admin/extension/publish",
            headers=_hdr(admin_user["token"]),
            files={"file": ("vwh.zip", data, "application/zip")},
            data={"version": "v-webhook"},
            timeout=30,
        )
        assert pr.status_code == 200

        r = requests.post(
            f"{BASE_URL}/api/telegram/webhook",
            json={"message": {"text": "/get", "chat": {"id": 123456}}},
            timeout=30,
        )
        assert r.status_code == 200
        assert r.json() == {"ok": True}

    def test_webhook_get_no_releases_still_ok_via_legacy(self):
        r = requests.post(
            f"{BASE_URL}/api/telegram/webhook",
            json={"message": {"text": "/get", "chat": {"id": 123457}}},
            timeout=30,
        )
        assert r.status_code == 200
        assert r.json() == {"ok": True}
