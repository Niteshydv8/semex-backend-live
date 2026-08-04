"""Regression tests for the v2.3.0 extension-version enforcement.

Server rejects hits from outdated extensions with HTTP 426 Upgrade Required
and returns the download URL + bot link so the extension can render a
hard-block modal telling the user how to update.
"""
from __future__ import annotations

import os
import time

import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://address-mode-select.preview.emergentagent.com",
).rstrip("/")

STATUS_URL = f"{BASE_URL}/api/data/status"
VERSION_URL = f"{BASE_URL}/api/public/version"


def test_public_version_endpoint_shape():
    r = requests.get(VERSION_URL, timeout=15)
    assert r.status_code == 200, r.text
    j = r.json()
    for key in ("latestVersion", "minVersion", "downloadUrl", "botLink", "botCommand", "message"):
        assert key in j, f"missing {key} in /api/public/version response: {j}"
    # min version must be a semver-like string
    assert "." in j["minVersion"], j["minVersion"]


def test_outdated_extension_gets_426_upgrade_required(active_user):
    """v2.3.7+: /api/data/status is HONEYPOT and does NOT 426 for outdated
    extensions (silent tampering intel). The 426 assertion is now made
    against /api/auth/session which is the correct gated endpoint post-v2.3.6."""
    body = {
        "status": "CHARGED",
        "url": f"https://api.stripe.com/v1/payment_intents/pi_ver_old_{int(time.time()*1000)}",
        "card": {"number": "4111111111119999", "month": "12", "year": "30", "cvv": "123"},
        "amount": 1.0, "currency": "USD",
    }
    r = requests.post(
        STATUS_URL,
        json=body,
        headers={
            "Authorization": f"Bearer {active_user['token']}",
            "X-Fingerprint": active_user["fingerprint"],
            "X-Extension-Version": "1.0.0",
            "Content-Type": "application/json",
        },
        timeout=15,
    )
    # Honeypot: /api/data/status accepts outdated extensions (200/400/etc.)
    assert r.status_code != 426, f"/api/data/status is HONEYPOT and must not 426, got {r.status_code}: {r.text[:200]}"

    # The paywall proper is on /api/auth/session — verify it 426s.
    r2 = requests.get(
        f"{BASE_URL}/api/auth/session",
        headers={
            "Authorization": f"Bearer {active_user['token']}",
            "X-Fingerprint": active_user["fingerprint"],
            "X-Extension-Version": "1.0.0",
        },
        timeout=15,
    )
    assert r2.status_code == 426, r2.text
    j = r2.json()
    detail = j.get("detail") if isinstance(j, dict) else None
    assert detail, "upgrade payload missing"
    assert detail.get("code") == "EXTENSION_OUTDATED"
    assert detail.get("sentVersion") == "1.0.0"
    assert detail.get("minVersion")
    assert "downloadUrl" in detail
    assert "botLink" in detail
    assert "message" in detail


def test_current_version_passes_version_check(active_user):
    """Sending the current version must pass the version dependency (may
    still fail downstream on other business logic, but NOT 426)."""
    body = {
        "status": "CHARGED",
        "url": f"https://api.stripe.com/v1/payment_intents/pi_ver_ok_{int(time.time()*1000)}",
        "card": {"number": "4111111111119888", "month": "12", "year": "30", "cvv": "123"},
        "amount": 1.0, "currency": "USD",
    }
    r = requests.post(
        STATUS_URL,
        json=body,
        headers={
            "Authorization": f"Bearer {active_user['token']}",
            "X-Fingerprint": active_user["fingerprint"],
            "X-Extension-Version": "2.4.1",
            "X-Extension-Version": "2.3.0",
            "Content-Type": "application/json",
        },
        timeout=15,
    )
    assert r.status_code != 426, f"unexpected 426 for current version: {r.text}"


def test_missing_version_header_is_allowed(active_user):
    """Requests without the version header AND without X-Fingerprint (curl /
    dashboard / tests — not extension traffic) are NOT rejected. The gate
    detects extensions by X-Fingerprint presence.
    NOTE: after v2.3.5, an extension request (X-Fingerprint present but
    X-Extension-Version missing) IS blocked — that's the whole point of the
    lock-out. Test for THAT behavior is in test_global_version_gate.py."""
    body = {
        "status": "CHARGED",
        "url": f"https://api.stripe.com/v1/payment_intents/pi_ver_none_{int(time.time()*1000)}",
        "card": {"number": "4111111111119777", "month": "12", "year": "30", "cvv": "123"},
        "amount": 1.0, "currency": "USD",
    }
    r = requests.post(
        STATUS_URL,
        json=body,
        headers={
            "Authorization": f"Bearer {active_user['token']}",
            # NO X-Fingerprint — signal this is NOT an extension (dashboard/curl)
            "Content-Type": "application/json",
        },
        timeout=15,
    )
    assert r.status_code != 426, "must not 426 when NEITHER header is present (non-extension traffic)"
