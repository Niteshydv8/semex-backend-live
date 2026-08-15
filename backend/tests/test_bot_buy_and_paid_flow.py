"""Tests for /buy USDT addresses + /paid proof-of-payment flow."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import db as db_module
import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch

import server as server_module
import routes.telegram_bot as bot

client = TestClient(server_module.app)


class _FakeProofCollection:
    """In-memory stand-in for the tg_proof_state Mongo collection."""

    def __init__(self):
        self.docs: dict[int, dict] = {}

    async def find_one(self, query):
        return self.docs.get(query.get("chat_id"))

    async def update_one(self, query, update, upsert=False):
        cid = query.get("chat_id")
        if cid in self.docs or upsert:
            self.docs[cid] = dict(update.get("$set", {}))

    async def delete_one(self, query):
        self.docs.pop(query.get("chat_id"), None)


class _FakeDB:
    def __init__(self, proofs: _FakeProofCollection):
        self.tg_proof_state = proofs


_FAKE_PROOFS = _FakeProofCollection()


@pytest.fixture(autouse=True)
def _fake_proof_db(monkeypatch):
    """Route the bot's proof-state DB access to an in-memory collection."""
    _FAKE_PROOFS.docs.clear()
    monkeypatch.setattr(db_module, "get_db", lambda: _FakeDB(_FAKE_PROOFS))
    yield
    _FAKE_PROOFS.docs.clear()


def _reset_proof_state():
    _FAKE_PROOFS.docs.clear()


def test_buy_command_includes_usdt_addresses_bep20_trc20_ton():
    """When a user runs /buy, the bot must send all three USDT addresses."""
    _reset_proof_state()
    fake_send = AsyncMock(return_value={"ok": True})
    with patch.object(bot, "send_message", fake_send):
        r = client.post(
            "/api/telegram/webhook",
            json={
                "message": {
                    "message_id": 1,
                    "chat": {"id": 12345, "type": "private"},
                    "from": {"id": 12345, "username": "buyer"},
                    "text": "/buy",
                }
            },
        )
    assert r.status_code == 200
    assert fake_send.await_count == 1
    body = fake_send.await_args.args[1]
    # All three networks must appear + a real address for each
    assert "BEP20" in body
    assert "0xb1ab479abe81d6be059d5bb9d55a6e8d99b64bfd" in body
    assert "TRC20" in body
    assert "TCn8eNownsyUzMeHNMeUpzXJFDruCWYr5w" in body
    assert "TON" in body
    assert "UQAmwQDBLUHsSZI3SiKTDwSnvte-Y8MkwoDvzHzOGa-3xk68" in body
    # No old BTC/LTC addresses in the new copy
    assert "BTC" not in body
    assert "LTC" not in body


def test_paid_command_enters_proof_mode():
    _reset_proof_state()
    fake_send = AsyncMock(return_value={"ok": True})
    with patch.object(bot, "send_message", fake_send):
        client.post(
            "/api/telegram/webhook",
            json={
                "message": {
                    "message_id": 2,
                    "chat": {"id": 555, "type": "private"},
                    "from": {"id": 555, "username": "payer"},
                    "text": "/paid",
                }
            },
        )
    assert 555 in _FAKE_PROOFS.docs
    assert _FAKE_PROOFS.docs[555]["username"] == "payer"
    assert _FAKE_PROOFS.docs[555]["telegram_id"] == 555
    body = fake_send.await_args.args[1]
    assert "Proof of payment" in body
    assert "30 minutes" in body


def test_photo_after_paid_is_forwarded_to_owner():
    _reset_proof_state()
    # Enter proof mode first
    fake_send = AsyncMock(return_value={"ok": True})
    with patch.object(bot, "send_message", fake_send):
        client.post(
            "/api/telegram/webhook",
            json={
                "message": {
                    "message_id": 10,
                    "chat": {"id": 777, "type": "private"},
                    "from": {"id": 777, "username": "ppayer"},
                    "text": "/paid",
                }
            },
        )
    assert 777 in _FAKE_PROOFS.docs
    # Now send a photo → should trigger copy_message to owner
    fake_copy = AsyncMock(return_value={"ok": True, "result": {"message_id": 999}})
    fake_send2 = AsyncMock(return_value={"ok": True})
    with patch.object(bot, "copy_message", fake_copy), patch.object(bot, "send_message", fake_send2):
        client.post(
            "/api/telegram/webhook",
            json={
                "message": {
                    "message_id": 11,
                    "chat": {"id": 777, "type": "private"},
                    "from": {"id": 777, "username": "ppayer"},
                    "photo": [{"file_id": "AAAAA", "width": 800, "height": 600}],
                    "caption": "MONTHLY plan — tx 0xabc",
                }
            },
        )
    # Owner got a copyMessage with an admin caption
    assert fake_copy.await_count == 1
    ck = fake_copy.await_args.kwargs
    assert ck["from_chat_id"] == 777
    assert ck["message_id"] == 11
    assert "NEW PROOF OF PAYMENT" in ck["caption"]
    assert "@ppayer" in ck["caption"]
    assert "MONTHLY plan" in ck["caption"]
    # User got a confirmation DM
    assert fake_send2.await_count == 1
    user_confirm = fake_send2.await_args.args[1]
    assert "Proof received" in user_confirm
    # Single-use: state should be cleared after forwarding
    assert 777 not in _FAKE_PROOFS.docs


def test_photo_without_paid_mode_is_ignored():
    _reset_proof_state()
    fake_copy = AsyncMock()
    fake_send = AsyncMock()
    with patch.object(bot, "copy_message", fake_copy), patch.object(bot, "send_message", fake_send):
        client.post(
            "/api/telegram/webhook",
            json={
                "message": {
                    "message_id": 20,
                    "chat": {"id": 888, "type": "private"},
                    "from": {"id": 888, "username": "random"},
                    "photo": [{"file_id": "BBB"}],
                }
            },
        )
    assert fake_copy.await_count == 0
    assert fake_send.await_count == 0


def test_cancel_clears_proof_mode():
    _reset_proof_state()
    _FAKE_PROOFS.docs[42] = {
        "chat_id": 42,
        "username": "u",
        "telegram_id": 42,
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=30),
    }
    fake_send = AsyncMock(return_value={"ok": True})
    with patch.object(bot, "send_message", fake_send):
        client.post(
            "/api/telegram/webhook",
            json={
                "message": {
                    "message_id": 30,
                    "chat": {"id": 42, "type": "private"},
                    "from": {"id": 42, "username": "u"},
                    "text": "/cancel",
                }
            },
        )
    assert 42 not in _FAKE_PROOFS.docs
    assert "Cancelled" in fake_send.await_args.args[1]


def test_help_command_lists_paid():
    _reset_proof_state()
    fake_send = AsyncMock(return_value={"ok": True})
    with patch.object(bot, "send_message", fake_send):
        client.post(
            "/api/telegram/webhook",
            json={
                "message": {
                    "message_id": 40,
                    "chat": {"id": 99, "type": "private"},
                    "from": {"id": 99, "username": "h"},
                    "text": "/help",
                }
            },
        )
    body = fake_send.await_args.args[1]
    assert "/paid" in body
    assert "/cancel" in body
