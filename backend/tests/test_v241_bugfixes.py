"""v2.4.1 regression tests for the two production bugs:

1. Admin-panel "extension too old" banner — verified by reading
   /app/semex/content/content.js and /app/semex-v2.4.1-plain.zip
   content.js to make sure _semexRenderOutdatedUI only calls the
   paywall when _semexIsGatewayHost() is true (no else branch calling
   _semexShowUpdateBanner).

2. POST /api/admin/extension/publish hung on Railway — verified by
   uploading a small in-memory zip with auto_broadcast=true and
   asserting the response returns within a few seconds and includes
   the `broadcastQueued` key (not the old synchronous `broadcast`
   attempted/sent/failed dict).

Also verifies the v2.4.1 version bump on /api/public/version.
"""
from __future__ import annotations

import io
import json
import re
import time
import zipfile
import zipfile as _zf
from pathlib import Path

import pytest
import requests

BASE_URL = "http://localhost:8001"
FP = "test-fp-000000000000000000000000000000"


def _hdr(token: str) -> dict:
    return {
        "Authorization": f"Bearer {token}",
        "X-Fingerprint": FP,
        "X-Extension-Version": "2.4.1",
    }


# ------------------------------------------------------------------
# Bug 1 — content.js banner removed on non-gateway hosts
# ------------------------------------------------------------------

class TestContentJsBannerFix:
    """Static verification of the content.js fix (no browser needed)."""

    def test_source_render_outdated_ui_only_calls_paywall(self):
        src = Path("/app/semex/content/content.js").read_text()
        # Extract the _semexRenderOutdatedUI function body.
        m = re.search(
            r"function _semexRenderOutdatedUI\([^)]*\)\s*\{(.*?)\n\}",
            src,
            flags=re.DOTALL,
        )
        assert m, "Could not find _semexRenderOutdatedUI function"
        body = m.group(1)

        assert "_semexIsGatewayHost()" in body, "Fix must gate on _semexIsGatewayHost()"
        assert "_semexShowUpdatePaywall(info)" in body, "Must still show paywall on gateway hosts"
        # The whole point of the fix — banner is NOT called from this fn on non-gateway hosts.
        assert "_semexShowUpdateBanner" not in body, (
            "Regression: _semexRenderOutdatedUI must NOT call _semexShowUpdateBanner "
            "(that was the admin-panel bug)"
        )
        # There should be no `else` branch (single if, no fallback UI).
        assert "else" not in body, "There should be no else branch in _semexRenderOutdatedUI"

    def test_legacy_show_update_banner_still_defined(self):
        """_semexShowUpdateBanner is kept for legacy compat — just not called
        from the outdated-UI renderer anymore."""
        src = Path("/app/semex/content/content.js").read_text()
        assert re.search(r"function _semexShowUpdateBanner\s*\(", src), (
            "_semexShowUpdateBanner must still be DEFINED (legacy compat)"
        )

    def test_zip_on_disk_has_v241_manifest_and_fix(self):
        zpath = Path("/app/semex-v2.4.1-plain.zip")
        assert zpath.exists(), "v2.4.1 zip is missing from /app"
        with _zf.ZipFile(zpath) as z:
            with z.open("manifest.json") as f:
                mani = json.loads(f.read().decode("utf-8"))
            assert mani["version"] == "2.4.1", f"manifest.json version is {mani['version']!r}, expected 2.4.1"
            with z.open("content/content.js") as f:
                cj = f.read().decode("utf-8")

        m = re.search(
            r"function _semexRenderOutdatedUI\([^)]*\)\s*\{(.*?)\n\}",
            cj,
            flags=re.DOTALL,
        )
        assert m, "Zipped content.js missing _semexRenderOutdatedUI"
        body = m.group(1)
        assert "_semexIsGatewayHost()" in body
        assert "_semexShowUpdatePaywall(info)" in body
        assert "_semexShowUpdateBanner" not in body, (
            "Zip on disk still calls the banner from _semexRenderOutdatedUI"
        )


# ------------------------------------------------------------------
# Bug 2 — publish endpoint returns immediately with broadcastQueued
# ------------------------------------------------------------------

def _build_test_ext_zip(version: str = "2.9.9") -> bytes:
    """Build the smallest valid Chrome-extension zip: manifest.json only."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr(
            "manifest.json",
            json.dumps({
                "manifest_version": 3,
                "name": "SEMEX Test Ext",
                "version": version,
                "description": "test-only",
            }),
        )
    return buf.getvalue()


class TestPublishReturnsQuickly:
    """Bug #2 — publish() must dispatch broadcast in a background task."""

    def test_publish_returns_within_seconds_with_broadcastqueued(
        self, admin_by_id_user, mongo_db
    ):
        # Cleanup any prior test release doc we might leave behind
        mongo_db.extension_releases.delete_many({"version": "2.9.9"})
        try:
            zdata = _build_test_ext_zip("2.9.9")

            t0 = time.time()
            r = requests.post(
                f"{BASE_URL}/api/admin/extension/publish",
                headers=_hdr(admin_by_id_user["token"]),
                files={"file": ("test.zip", zdata, "application/zip")},
                data={
                    "version": "2.9.9",
                    "notes": "v2.4.1 bugfix regression test",
                    "make_minimum": "false",  # don't clobber the real minimum
                    "auto_broadcast": "true",
                },
                timeout=30,
            )
            elapsed = time.time() - t0

            assert r.status_code == 200, f"publish failed: {r.status_code} {r.text}"
            body = r.json()

            # ---- The core fix assertion ----
            assert "broadcastQueued" in body, (
                f"Response missing 'broadcastQueued' key — bug #2 not fixed. Body: {body}"
            )
            assert "broadcast" not in body, (
                "Response still contains legacy synchronous 'broadcast' dict — background task not wired"
            )
            assert isinstance(body["broadcastQueued"], int)
            assert body["broadcastQueued"] >= 0

            # ---- Perf assertion — must return quickly even with auto_broadcast=true ----
            assert elapsed < 5.0, (
                f"publish took {elapsed:.2f}s with auto_broadcast=true — "
                "broadcast is not backgrounded (would hit Railway ingress timeout)"
            )

            # ---- Release doc actually created in DB ----
            assert body.get("version") == "2.9.9"
            rid = body.get("id")
            assert rid, "publish response missing 'id'"
            from bson import ObjectId
            doc = mongo_db.extension_releases.find_one({"_id": ObjectId(rid)})
            assert doc is not None, "Release doc not persisted"
            assert doc["version"] == "2.9.9"
            assert doc.get("is_latest") is True
        finally:
            mongo_db.extension_releases.delete_many({"version": "2.9.9"})


# ------------------------------------------------------------------
# Version bump — /api/public/version returns 2.4.1 when DB empty
# ------------------------------------------------------------------

class TestPublicVersionBump:
    def test_public_version_defaults_to_241(self, mongo_db):
        # Wipe releases so the fallback path is exercised
        prior = list(mongo_db.extension_releases.find({}))
        mongo_db.extension_releases.delete_many({})
        try:
            r = requests.get(f"{BASE_URL}/api/public/version", timeout=10)
            assert r.status_code == 200
            data = r.json()
            assert data.get("minVersion") == "2.4.1", data
            assert data.get("latestVersion") == "2.4.1", data
        finally:
            if prior:
                # Restore (best-effort)
                for d in prior:
                    d.pop("_id", None)
                mongo_db.extension_releases.insert_many(prior)
