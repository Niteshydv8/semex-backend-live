"""Regression test for the per-user public-showcase mute (Feb 2026 v2.2.9).

- Owner/admin can POST /api/admin/users/public-mute {telegramId, muted:true}
- A muted user's hits still forward to user DM + admin log, but the
  public showcase channel gets NO message.
- Setting muted:false restores public posting.
"""
from __future__ import annotations

import asyncio
import time
import types
from datetime import datetime, timezone

import os
import pytest
import requests
from pathlib import Path
import sys

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))


def _stub_request(client_ip: str = "203.0.113.99"):
    return types.SimpleNamespace(
        headers={"cf-connecting-ip": client_ip},
        client=types.SimpleNamespace(host=client_ip),
        state=types.SimpleNamespace(extension_outdated=False),
    )

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://address-mode-select.preview.emergentagent.com").rstrip("/")
PUBLIC_MUTE_URL = f"{BASE_URL}/api/admin/users/public-mute"


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


def test_public_mute_endpoint_requires_admin(active_user):
    """Non-admin user cannot toggle another user's public_muted flag."""
    r = requests.post(
        PUBLIC_MUTE_URL,
        json={"telegramId": 999888777, "muted": True},
        headers={
            "Authorization": f"Bearer {active_user['token']}",
            "X-Fingerprint": active_user["fingerprint"],
            "X-Extension-Version": "2.4.1",
        "X-Extension-Version": "2.4.1",
            "Content-Type": "application/json",
        },
        timeout=15,
    )
    # 401 or 403 — either is acceptable; the key point is it's NOT 200.
    assert r.status_code in (401, 402, 403), r.text


def test_public_mute_endpoint_admin_can_toggle(admin_by_id_user, mongo_db):
    """Owner toggles muted=true then muted=false; user document reflects both.

    NOTE: after v2.3.2 the mute endpoint is OWNER-only, so we use the
    `admin_by_id_user` fixture (which uses ADMIN_TELEGRAM_ID). A promoted
    admin (the plain `admin_user` fixture) would receive 403 — see the
    `test_promoted_admin_cannot_mutate` parametrized suite.
    """
    target = 987654321
    # Seed the target user so update_one has something to match
    mongo_db.users.update_one(
        {"telegram_id": target},
        {"$setOnInsert": {
            "telegram_id": target,
            "plan": "TRIAL",
            "is_admin": False,
            "is_banned": False,
            "hit_count": 0,
            "charged_count": 0,
            "created_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )

    h = {
        "Authorization": f"Bearer {admin_by_id_user['token']}",
        "X-Fingerprint": admin_by_id_user["fingerprint"],
        "X-Extension-Version": "2.4.1",
        "X-Extension-Version": "2.4.1",
        "Content-Type": "application/json",
    }
    r1 = requests.post(PUBLIC_MUTE_URL, json={"telegramId": target, "muted": True}, headers=h, timeout=15)
    assert r1.status_code == 200, r1.text
    assert r1.json().get("muted") is True
    doc = mongo_db.users.find_one({"telegram_id": target})
    assert doc.get("public_muted") is True

    r2 = requests.post(PUBLIC_MUTE_URL, json={"telegramId": target, "muted": False}, headers=h, timeout=15)
    assert r2.status_code == 200, r2.text
    assert r2.json().get("muted") is False
    doc = mongo_db.users.find_one({"telegram_id": target})
    assert doc.get("public_muted") is False

    # Cleanup
    mongo_db.users.delete_one({"telegram_id": target})


def test_muted_user_hit_skips_public_showcase(monkeypatch):
    """CHARGED hit from a public_muted user must NOT be forwarded to the public
    showcase channel — user DM + admin log still fire."""
    from routes import data as data_route
    from config import settings
    from models import User

    sent_chats: list[int] = []

    async def fake_enqueue_message(db, chat_id, text, **kwargs):
        sent_chats.append(int(chat_id))
        return True

    async def fake_enqueue_photo(db, chat_id, photo, caption, **kwargs):
        sent_chats.append(int(chat_id))
        return True

    async def fake_lookup_bin(*args, **kwargs):
        return None

    monkeypatch.setattr(data_route.telegram_outbox, "enqueue_message", fake_enqueue_message)
    monkeypatch.setattr(data_route.telegram_outbox, "enqueue_photo", fake_enqueue_photo)
    monkeypatch.setattr(data_route, "lookup_bin", fake_lookup_bin)
    monkeypatch.setattr(data_route, "get_db", lambda: _AsyncDB())
    data_route._RECENT_HIT_DEDUP.clear()

    user = User(
        telegram_id=555444333,
        telegram_username="muted_test",
        telegram_first_name="M",
        plan="YEARLY",
        is_admin=False,
        is_banned=False,
        public_muted=True,   # ← the mute flag
        hit_count=0, charged_count=0,
        created_at=datetime.now(timezone.utc),
        last_seen_at=datetime.now(timezone.utc),
    )
    body = data_route.StatusBody(
        status="charged",
        gateway="Stripe",
        url=f"https://api.stripe.com/v1/payment_intents/pi_muted_{int(time.time()*1000)}",
        response="paid",
        card={"number": "4242424242424242", "month": "12", "year": "30", "cvv": "123"},
        amount=14.0,
        currency="USD",
    )

    asyncio.get_event_loop().run_until_complete(
        data_route.submit_status(body, request=_stub_request(), user=user)
    )

    public_chan = int(settings.PUBLIC_SHOWCASE_CHANNEL_ID) if settings.PUBLIC_SHOWCASE_CHANNEL_ID else None
    admin_log = int(settings.ADMIN_LOG_CHANNEL_ID) if settings.ADMIN_LOG_CHANNEL_ID else None
    assert public_chan is not None
    assert public_chan not in sent_chats, (
        f"public_muted user should NOT hit public channel {public_chan}. sent: {sent_chats}"
    )
    # user DM still received it
    assert user.telegram_id in sent_chats
    # admin log still received it (non-admin CHARGED)
    if admin_log:
        assert admin_log in sent_chats


def test_unmuted_user_still_reaches_public_channel(monkeypatch):
    """Sanity: a user WITHOUT public_muted=True still gets their CHARGED
    forwarded to the public showcase channel."""
    from routes import data as data_route
    from config import settings
    from models import User

    sent_chats: list[int] = []

    async def fake_enqueue_message(db, chat_id, text, **kwargs):
        sent_chats.append(int(chat_id))
        return True

    async def fake_enqueue_photo(db, chat_id, photo, caption, **kwargs):
        sent_chats.append(int(chat_id))
        return True

    async def fake_lookup_bin(*args, **kwargs):
        return None

    monkeypatch.setattr(data_route.telegram_outbox, "enqueue_message", fake_enqueue_message)
    monkeypatch.setattr(data_route.telegram_outbox, "enqueue_photo", fake_enqueue_photo)
    monkeypatch.setattr(data_route, "lookup_bin", fake_lookup_bin)
    monkeypatch.setattr(data_route, "get_db", lambda: _AsyncDB())
    data_route._RECENT_HIT_DEDUP.clear()

    user = User(
        telegram_id=666555444,
        telegram_username="unmuted_test",
        telegram_first_name="U",
        plan="YEARLY",
        is_admin=False,
        is_banned=False,
        public_muted=False,
        hit_count=0, charged_count=0,
        created_at=datetime.now(timezone.utc),
        last_seen_at=datetime.now(timezone.utc),
    )
    body = data_route.StatusBody(
        status="charged",
        gateway="Stripe",
        url=f"https://api.stripe.com/v1/payment_intents/pi_unmuted_{int(time.time()*1000)}",
        response="paid",
        card={"number": "4242424242424242", "month": "12", "year": "30", "cvv": "123"},
        amount=14.0,
        currency="USD",
    )
    asyncio.get_event_loop().run_until_complete(
        data_route.submit_status(body, request=_stub_request(), user=user)
    )
    public_chan = int(settings.PUBLIC_SHOWCASE_CHANNEL_ID) if settings.PUBLIC_SHOWCASE_CHANNEL_ID else None
    assert public_chan is not None
    assert public_chan in sent_chats, f"unmuted user MUST hit public channel. sent: {sent_chats}"
