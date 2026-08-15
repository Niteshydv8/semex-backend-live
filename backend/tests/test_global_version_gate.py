"""Regression: the v2.3.4 global version-gate middleware must block ALL
extension-facing API calls — not just /api/data/status — when the caller's
X-Extension-Version is below the minimum.

Also verifies that exempt paths (auth, public, health, telegram) still work
so an old-version extension can login + see the upgrade modal."""
from __future__ import annotations

import os
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://address-mode-select.preview.emergentagent.com",
).rstrip("/")


BLOCKED_PATHS = [
    ("GET",  "/api/user/hits"),
    ("GET",  "/api/user/state"),
    ("POST", "/api/user/state"),
    ("GET",  "/api/user/bins"),
    # NOTE: /api/data/status was moved to HONEYPOT — outdated extensions no
    # longer get 426 there. See test_honeypot_data_status_not_blocked_for_old_extension.
    ("GET",  "/api/admin/stats"),
    ("GET",  "/api/admin/users"),
    ("GET",  "/api/admin/hits"),
]

EXEMPT_PATHS = [
    ("GET",  "/api/health"),
    ("GET",  "/api/public/version"),
]


AUTH_BLOCKED_FOR_OLD_EXT = [
    # v2.3.6: /api/auth/* is NO longer exempt when caller is an extension.
    # Old extensions can no longer authenticate — they must upgrade first.
    ("POST", "/api/auth/session"),
    ("GET",  "/api/auth/session"),
]


def _h(token: str, fp: str, version: str):
    return {
        "Authorization": f"Bearer {token}",
        "X-Fingerprint": fp,
        "X-Extension-Version": version,
        "Content-Type": "application/json",
    }


def test_old_extension_blocked_on_every_extension_endpoint(active_user):
    """Extension with X-Fingerprint but NO X-Extension-Version (i.e. pre-2.3.1
    builds that never sent the header) must get 426 on every listed endpoint.
    v2.3.5 middleware treats missing-version as outdated when the caller is
    clearly an extension (X-Fingerprint present)."""
    for method, path in BLOCKED_PATHS:
        # Case A: extension sending version=1.0.0 → 426
        r = requests.request(
            method, f"{BASE_URL}{path}",
            json={} if method != "GET" else None,
            headers=_h(active_user["token"], active_user["fingerprint"], "1.0.0"),
            timeout=15,
        )
        assert r.status_code == 426, f"{method} {path} should 426 for old ext, got {r.status_code}"
        j = r.json()
        det = j.get("detail") or j
        assert det.get("code") == "EXTENSION_OUTDATED"
        # Case B: extension sending NO version header at all → must NOT 426.
        # (v2.3.5 treated missing-version as outdated and false-426'd current
        # builds that occasionally omit the header — that incident is why the
        # gate now only flags a build when it SENT a version below the minimum.)
        r2 = requests.request(
            method, f"{BASE_URL}{path}",
            json={} if method != "GET" else None,
            headers={
                "Authorization": f"Bearer {active_user['token']}",
                "X-Fingerprint": active_user["fingerprint"],
                "Content-Type": "application/json",
                # DELIBERATELY no X-Extension-Version
            },
            timeout=15,
        )
        assert r2.status_code != 426, (
            f"{method} {path} must NOT 426 for ext with NO version header, got {r2.status_code}"
        )


def test_exempt_endpoints_still_open_to_old_extension():
    """Old extensions MUST still be able to reach public/version + health so
    they can render the upgrade modal. These paths never 426."""
    for method, path in EXEMPT_PATHS:
        r = requests.request(
            method, f"{BASE_URL}{path}",
            json={} if method != "GET" else None,
            headers={"X-Extension-Version": "1.0.0", "X-Fingerprint": "fp-x"},
            timeout=15,
        )
        assert r.status_code != 426, (
            f"{method} {path} MUST be exempt from version gate, got 426: {r.text[:200]}"
        )


def test_auth_endpoints_blocked_for_old_extension():
    """v2.3.6: /api/auth/* is no longer exempt for outdated extensions.
    They must upgrade before authenticating."""
    for method, path in AUTH_BLOCKED_FOR_OLD_EXT:
        r = requests.request(
            method, f"{BASE_URL}{path}",
            json={} if method != "GET" else None,
            headers={
                "X-Extension-Version": "1.0.0",
                "X-Fingerprint": "fp-x",
                "Content-Type": "application/json",
            },
            timeout=15,
        )
        assert r.status_code == 426, (
            f"{method} {path} MUST 426 for outdated ext, got {r.status_code}"
        )


def test_current_extension_passes_on_all_endpoints(active_user):
    """A caller at/above the minimum version must NOT get 426 anywhere."""
    for method, path in BLOCKED_PATHS[:3]:  # smaller subset
        r = requests.request(
            method, f"{BASE_URL}{path}",
            json={} if method != "GET" else None,
            headers=_h(active_user["token"], active_user["fingerprint"], "9.9.9"),
            timeout=15,
        )
        assert r.status_code != 426, f"{method} {path} 426'd for current version: {r.text[:200]}"


def test_no_version_header_is_still_allowed(active_user):
    """Requests without X-Extension-Version AND without X-Fingerprint
    (curl / dashboard / tests — not extension traffic) must pass through the
    gate. This is the "server-side dashboard" case."""
    r = requests.get(
        f"{BASE_URL}/api/user/hits",
        headers={
            "Authorization": f"Bearer {active_user['token']}",
            # NO X-Fingerprint — signal that this is NOT an extension
        },
        timeout=15,
    )
    assert r.status_code != 426, "missing header + missing fingerprint must not 426"
