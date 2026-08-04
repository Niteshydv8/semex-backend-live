"""Regression tests for owner-only admin actions + no IP in public showcase.

v2.3.2 policy:
  1. Only the primary OWNER (settings.ADMIN_TELEGRAM_ID) can mutate users,
     publish releases, broadcast, post news, generate codes, etc.
     Promoted admins can still VIEW (stats, list users, list hits) but any
     mutation must return HTTP 403.
  2. The public showcase message must NOT contain the user's IP address.
     IP still appears in the owner/admin DM template (format_hit).
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


def _h(user):
    return {
        "Authorization": f"Bearer {user['token']}",
        "X-Fingerprint": user["fingerprint"],
        "X-Extension-Version": "2.4.1",
        "X-Extension-Version": "2.4.1",
        "Content-Type": "application/json",
    }


# ─── Public showcase must NOT include IP ─────────────────────────────────────
def test_public_showcase_does_not_include_ip():
    from services.extra_formatters import format_public_showcase

    hit = {
        "status": "charged",
        "gateway": "Stripe",
        "amount": 14.50, "currency": "USD",
        "response": "paid",
        "ip": "203.0.113.42",   # if this ever leaks into public, the test fails
        "ip_country": "DE",
    }
    user = {
        "telegram_id": 111222333,
        "telegram_username": "hitter1",
        "telegram_first_name": "H",
    }
    msg = format_public_showcase(hit, user)
    assert "203.0.113" not in msg, "raw IP must never appear in public showcase"
    assert "203.0.113.42" not in msg
    assert "DE" not in msg or "[DE]" not in msg, "no country tag either"
    # Sanity: it still includes the amount + status
    assert "USD" in msg or "14.50" in msg or "$" in msg
    assert "CHARGED" in msg.upper()


def test_admin_dm_hit_template_still_includes_ip():
    """Ensures IP is still visible in the owner/admin DM template — only the
    PUBLIC one omits it."""
    from services.hit_formatter import format_hit

    hit = {
        "status": "charged",
        "gateway": "Stripe",
        "response": "paid",
        "card_number": "4242424242424242",
        "card_exp_month": "12", "card_exp_year": "30", "card_cvv": "123",
        "amount": 14.50, "currency": "USD",
        "ip": "203.0.113.42",
        "ip_country": "DE",
    }
    user = {"telegram_id": 111222333, "telegram_username": "hitter1", "plan": "YEARLY"}
    msg = format_hit(hit, user, admin_view=True)
    assert "203.0.113.42" in msg, "admin DM template MUST include the IP"
    assert "DE" in msg, "admin DM template MUST include the country"


# ─── Owner-only mutation endpoints ───────────────────────────────────────────
_OWNER_ONLY_ENDPOINTS = [
    ("POST", "/api/admin/users/ban",             {"telegramId": 987654321, "reason": "test"}),
    ("POST", "/api/admin/users/unban",           {"telegramId": 987654321}),
    ("POST", "/api/admin/users/public-mute",     {"telegramId": 987654321, "muted": True}),
    ("POST", "/api/admin/users/extend",          {"telegramId": 987654321, "days": 30}),
    ("POST", "/api/admin/users/revoke-sessions", {"telegramId": 987654321}),
    ("POST", "/api/admin/codes/generate",        {"days": 30, "quantity": 1}),
    ("POST", "/api/admin/news",                  {"title": "x", "body": "y", "important": False}),
    ("POST", "/api/admin/broadcast",             {"message": "hi", "includeAdmins": False, "includeExpired": False}),
]


@pytest.mark.parametrize("method,path,body", _OWNER_ONLY_ENDPOINTS)
def test_promoted_admin_cannot_mutate(method, path, body, admin_user):
    """A user with is_admin=True but NOT the owner (the fixture `admin_user`
    is a promoted admin, not the ADMIN_TELEGRAM_ID owner) must get 403 on
    every mutation endpoint."""
    url = f"{BASE_URL}{path}"
    r = requests.request(method, url, json=body, headers=_h(admin_user), timeout=15)
    assert r.status_code == 403, (
        f"promoted admin should be denied on {method} {path}, "
        f"got {r.status_code}: {r.text[:200]}"
    )


@pytest.mark.parametrize("method,path,body", _OWNER_ONLY_ENDPOINTS)
def test_owner_can_mutate(method, path, body, admin_by_id_user, mongo_db):
    """The primary owner (ADMIN_TELEGRAM_ID) is allowed through the auth
    gate — we only check the 403 does NOT happen. Business logic may still
    422/400 (e.g. broadcast requires targets); that's fine."""
    if "telegramId" in body:
        from datetime import datetime, timezone as _tz
        mongo_db.users.update_one(
            {"telegram_id": body["telegramId"]},
            {"$setOnInsert": {
                "telegram_id": body["telegramId"], "plan": "TRIAL",
                "is_admin": False, "is_banned": False,
                "hit_count": 0, "charged_count": 0,
                "created_at": datetime.now(_tz.utc),
            }},
            upsert=True,
        )
    url = f"{BASE_URL}{path}"
    r = requests.request(method, url, json=body, headers=_h(admin_by_id_user), timeout=15)
    assert r.status_code != 403, (
        f"owner MUST be allowed on {method} {path}, but got 403: {r.text[:200]}"
    )
    if "telegramId" in body:
        mongo_db.users.delete_one({"telegram_id": body["telegramId"]})


def test_read_only_endpoints_still_open_to_promoted_admin(admin_user):
    """Sanity: promoted admins can still VIEW (stats, list users, hits feed).
    Only mutations are locked to owner."""
    ro = [
        "/api/admin/stats",
        "/api/admin/users?limit=5",
        "/api/admin/hits?limit=5",
    ]
    for path in ro:
        r = requests.get(f"{BASE_URL}{path}", headers=_h(admin_user), timeout=15)
        assert r.status_code == 200, f"promoted admin should read {path}, got {r.status_code}: {r.text[:200]}"
