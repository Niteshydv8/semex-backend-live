"""Regression tests for the two P0 hit-forwarding bugs reported in Feb 2026:

1) Double notifications: same (user, card, status, url) posted twice within a
   short window must be de-duplicated server-side (backend guard, in addition
   to the frontend one that gets bypassed while the overlay is active).

2) LIVE hits leaking into the private admin-log channel: LIVE must NOT be
   forwarded to the admin log. Only CHARGED goes there.
   (Verified by patching send_message + calling the endpoint via TestClient
    with an async Mongo mock; light-weight, no DB fixtures required.)
"""
from __future__ import annotations

import asyncio
import os
import time
import types
from pathlib import Path
import sys

import pytest
import requests


def _stub_request(client_ip: str = "203.0.113.99"):
    """Minimal object that mimics fastapi.Request for tests that call
    data_route.submit_status() directly (not via HTTP client)."""
    return types.SimpleNamespace(
        headers={"cf-connecting-ip": client_ip},
        client=types.SimpleNamespace(host=client_ip),
    )



BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://address-mode-select.preview.emergentagent.com",
).rstrip("/")
STATUS_URL = f"{BASE_URL}/api/data/status"


def _headers(token: str, fingerprint: str) -> dict:
    return {
        "Authorization": f"Bearer {token}",
        "X-Fingerprint": fingerprint,
        "X-Extension-Version": "2.4.1",
        "X-Extension-Version": "2.4.1",
        "Content-Type": "application/json",
    }


def _charged_payload(tag: str):
    return {
        "status": "charged",
        "gateway": "TestGateway",
        "url": f"https://api.stripe.com/v1/payment_intents/pi_{tag}",
        "hostname": "api.stripe.com",
        "response": "paid",
        "card": {"number": "4111111111112222", "month": "12", "year": "30", "cvv": "123"},
        "amount": 14.0,
        "currency": "USD",
    }


def _live_payload(tag: str):
    return {
        "status": "live",
        "gateway": "TestGateway",
        "url": f"https://api.stripe.com/v1/payment_intents/pi_{tag}",
        "hostname": "api.stripe.com",
        "response": "insufficient_funds",
        "card": {"number": "4111111111113333", "month": "12", "year": "30", "cvv": "123"},
        "amount": 14.0,
        "currency": "USD",
    }


# ---------------------------------------------------------------------------
# 1) End-to-end dedup test via the live preview backend
# ---------------------------------------------------------------------------
def test_duplicate_charged_hit_is_dropped_within_window(active_user):
    tag = f"dup_{int(time.time())}"
    body = _charged_payload(tag)
    h = _headers(active_user["token"], active_user["fingerprint"])

    r1 = requests.post(STATUS_URL, json=body, headers=h, timeout=15)
    assert r1.status_code == 200, r1.text
    j1 = r1.json()
    assert j1.get("success") is True
    assert j1.get("duplicate") is not True

    r2 = requests.post(STATUS_URL, json=body, headers=h, timeout=15)
    assert r2.status_code == 200, r2.text
    j2 = r2.json()
    assert j2.get("duplicate") is True
    assert j2.get("forwarded") is False


# ---------------------------------------------------------------------------
# 2) LIVE routing test in-process with mocked telegram + Mongo
# ---------------------------------------------------------------------------
class _AsyncCollection:
    def __init__(self):
        self.docs = []

    async def insert_one(self, doc):
        self.docs.append(doc)
        return types.SimpleNamespace(inserted_id="stub_id")

    async def update_one(self, *a, **k):
        return None

    async def find_one(self, *a, **k):
        return None


class _AsyncDB:
    def __init__(self):
        self.hits = _AsyncCollection()
        self.users = _AsyncCollection()
        self.bin_cache = _AsyncCollection()


@pytest.mark.parametrize("status,should_hit_admin_log", [
    ("live", False),   # LIVE must NOT reach admin log
    ("charged", True),  # CHARGED still must reach admin log
])
def test_live_routing_admin_log(monkeypatch, status, should_hit_admin_log):
    from routes import data as data_route
    from config import settings
    from models import User
    from datetime import datetime, timezone

    sent_chats: list[int] = []

    async def fake_send_message(chat_id, text, **kwargs):
        sent_chats.append(int(chat_id))
        return {"ok": True, "result": {"message_id": 1}}

    async def fake_send_photo(*args, **kwargs):
        return None  # force text-only fallback path

    async def fake_pin(*args, **kwargs):
        return None

    async def fake_lookup_bin(*args, **kwargs):
        return None

    monkeypatch.setattr(data_route, "send_message", fake_send_message)
    monkeypatch.setattr(data_route, "send_photo", fake_send_photo)
    monkeypatch.setattr(data_route, "pin_message", fake_pin)
    monkeypatch.setattr(data_route, "lookup_bin", fake_lookup_bin)
    monkeypatch.setattr(data_route, "get_db", lambda: _AsyncDB())
    # Bust the module-level dedup cache between parametrized cases.
    data_route._RECENT_HIT_DEDUP.clear()

    # Simulate a non-admin user (so admin-log routing is exercised)
    user = User(
        telegram_id=888000111,
        telegram_username="live_route_test",
        telegram_first_name="L",
        plan="YEARLY",
        is_admin=False,
        is_banned=False,
        hit_count=0,
        charged_count=0,
        created_at=datetime.now(timezone.utc),
        last_seen_at=datetime.now(timezone.utc),
    )

    body = data_route.StatusBody(
        status=status,
        gateway="TestGateway",
        url=f"https://api.stripe.com/v1/payment_intents/pi_route_{status}_{int(time.time()*1000)}",
        response="ok",
        card={"number": "4242424242424242", "month": "12", "year": "30", "cvv": "123"},
        amount=14.0,
        currency="USD",
    )

    asyncio.get_event_loop().run_until_complete(
        data_route.submit_status(body, request=_stub_request(), user=user)
    )

    admin_log = int(settings.ADMIN_LOG_CHANNEL_ID) if settings.ADMIN_LOG_CHANNEL_ID else None
    assert admin_log is not None
    hit_admin = admin_log in sent_chats
    assert hit_admin == should_hit_admin_log, (
        f"status={status}: admin_log={admin_log} sent_chats={sent_chats}"
    )
    # In both cases the user DM should have received the message
    assert user.telegram_id in sent_chats
