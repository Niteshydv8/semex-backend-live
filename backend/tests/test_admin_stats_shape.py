"""Verify /api/admin/stats returns shape consumed by admin.html loadStats().
Also verifies the /api/auth/request-otp 422 shape that the frontend fix stringifies.
"""
from __future__ import annotations

import os
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://address-mode-select.preview.emergentagent.com").rstrip("/")


def test_admin_stats_shape(admin_user):
    r = requests.get(
        f"{BASE_URL}/api/admin/stats",
        headers={
            "Authorization": f"Bearer {admin_user['token']}",
            "X-Fingerprint": admin_user["fingerprint"],
            "X-Extension-Version": "2.4.1",
        },
        timeout=15,
    )
    assert r.status_code == 200, r.text
    j = r.json()
    # loadStats() reads s.users.{total,active,banned}, s.hits.{total,charged}, s.codes.{unused,used}
    assert "users" in j and isinstance(j["users"], dict)
    for k in ("total", "active", "banned"):
        assert k in j["users"], f"missing users.{k}: {j}"
    assert "hits" in j and isinstance(j["hits"], dict)
    for k in ("total", "charged"):
        assert k in j["hits"], f"missing hits.{k}: {j}"
    assert "codes" in j and isinstance(j["codes"], dict)
    for k in ("unused", "used"):
        assert k in j["codes"], f"missing codes.{k}: {j}"


def test_request_otp_422_detail_is_array_of_dicts():
    """Reproduces the payload that used to leak '[object Object]' in the admin
    dashboard toast. Now handled by admin.html lines 436-455."""
    r = requests.post(
        f"{BASE_URL}/api/auth/request-otp",
        json={"telegramId": "abc", "fingerprint": "fp-x"},
        timeout=10,
    )
    assert r.status_code == 422
    body = r.json()
    assert "detail" in body
    assert isinstance(body["detail"], list)
    assert len(body["detail"]) >= 1
    first = body["detail"][0]
    assert isinstance(first, dict)
    assert "msg" in first  # what the admin.html new code joins on
    assert "int" in first["msg"].lower() or "integer" in first["msg"].lower()
