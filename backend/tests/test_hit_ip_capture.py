"""Regression: submit_status must persist the client's IP + ip_country on a
CHARGED hit (v2.3.0). The admin feed + user history render `ip` column, so
this needs to be populated at insert time from the request headers."""
from __future__ import annotations

import asyncio
import time
import types
from datetime import datetime, timezone
from pathlib import Path
import sys

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))


class _AsyncCollection:
    def __init__(self):
        self.docs = []
    async def insert_one(self, doc):
        self.docs.append(doc)
        return types.SimpleNamespace(inserted_id="stub_" + str(len(self.docs)))
    async def update_one(self, *a, **k): return None
    async def find_one(self, *a, **k): return None


class _AsyncDB:
    def __init__(self):
        self.hits = _AsyncCollection()
        self.users = _AsyncCollection()
        self.bin_cache = _AsyncCollection()


def _stub_request(ip: str, country: str | None = None):
    headers = {"cf-connecting-ip": ip}
    if country:
        headers["cf-ipcountry"] = country
    return types.SimpleNamespace(
        headers=headers,
        client=types.SimpleNamespace(host=ip),
        state=types.SimpleNamespace(extension_outdated=False),
    )


def test_submit_status_persists_client_ip_and_country(monkeypatch):
    from routes import data as data_route
    from models import User

    db = _AsyncDB()
    async def _noop(*a, **k): return None
    async def _lookup(*a, **k): return None
    monkeypatch.setattr(data_route.telegram_outbox, "enqueue_message", _noop)
    monkeypatch.setattr(data_route.telegram_outbox, "enqueue_photo", _noop)
    monkeypatch.setattr(data_route, "lookup_bin", _lookup)
    monkeypatch.setattr(data_route, "get_db", lambda: db)
    data_route._RECENT_HIT_DEDUP.clear()

    user = User(
        telegram_id=111222333,
        telegram_username="ip_test",
        telegram_first_name="I",
        plan="YEARLY",
        is_admin=False, is_banned=False, public_muted=False,
        hit_count=0, charged_count=0,
        created_at=datetime.now(timezone.utc),
        last_seen_at=datetime.now(timezone.utc),
    )
    body = data_route.StatusBody(
        status="charged", gateway="Stripe",
        url=f"https://api.stripe.com/v1/payment_intents/pi_ipcap_{int(time.time()*1000)}",
        response="paid",
        card={"number": "4242424242424242", "month": "12", "year": "30", "cvv": "123"},
        amount=14.0, currency="USD",
    )
    req = _stub_request("203.0.113.42", country="DE")

    asyncio.get_event_loop().run_until_complete(
        data_route.submit_status(body, request=req, user=user)
    )

    assert len(db.hits.docs) == 1, "hit must be persisted"
    doc = db.hits.docs[0]
    assert doc.get("ip") == "203.0.113.42", f"ip not captured, got {doc.get('ip')!r}"
    assert doc.get("ip_country") == "DE", f"ip_country not captured, got {doc.get('ip_country')!r}"


def test_submit_status_ip_uses_xff_when_no_cf_header(monkeypatch):
    from routes import data as data_route
    from models import User

    db = _AsyncDB()
    async def _noop(*a, **k): return None
    monkeypatch.setattr(data_route.telegram_outbox, "enqueue_message", _noop)
    monkeypatch.setattr(data_route.telegram_outbox, "enqueue_photo", _noop)
    monkeypatch.setattr(data_route, "lookup_bin", _noop)
    monkeypatch.setattr(data_route, "get_db", lambda: db)
    data_route._RECENT_HIT_DEDUP.clear()

    user = User(
        telegram_id=222333444, telegram_username="xff_test", telegram_first_name="X",
        plan="YEARLY", is_admin=False, is_banned=False, public_muted=False,
        hit_count=0, charged_count=0,
        created_at=datetime.now(timezone.utc), last_seen_at=datetime.now(timezone.utc),
    )
    body = data_route.StatusBody(
        status="charged",
        url=f"https://api.stripe.com/v1/payment_intents/pi_xff_{int(time.time()*1000)}",
        card={"number": "4242424242424242", "month": "12", "year": "30", "cvv": "123"},
        amount=1.0, currency="USD",
    )
    req = types.SimpleNamespace(
        headers={"x-forwarded-for": "198.51.100.7, 10.0.0.1, 172.16.0.1"},
        client=types.SimpleNamespace(host="10.0.0.1"),
        state=types.SimpleNamespace(extension_outdated=False),
    )
    asyncio.get_event_loop().run_until_complete(
        data_route.submit_status(body, request=req, user=user)
    )
    assert db.hits.docs[0]["ip"] == "198.51.100.7", "must pick FIRST XFF entry (real client)"
