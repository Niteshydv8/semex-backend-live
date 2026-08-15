"""Tests for /buy USDT addresses + /paid proof-of-payment flow.

Proof state is now stored in MongoDB (tg_proof_state collection), not in the
removed in-memory _PROOF_STATE dict.  All DB access is intercepted by the
autouse `_fake_proof_db` fixture which routes calls to an in-memory
_FakeProofCollection so no live MongoDB is required.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import db as db_module
import pytest
from fastapi.testclient import TestClient

import server as server_module
import routes.telegram_bot as bot

client = TestClient(server_module.app)


# ── In-memory DB stand-in ──────────────────────────────────────────────────

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
    """Route the bot's proof-state DB access to an in-memory collection.

    tg_updates access (replay dedup) raises AttributeError which the webhook
    handler catches and ignores — so all commands are processed normally.
    """
    _FAKE_PROOFS.docs.clear()
    monkeypatch.setattr(db_module, "get_db", lambda: _FakeDB(_FAKE_PROOFS))
    yield
    _FAKE_PROOFS.docs.clear()


# ── AsyncMock helpers (used by tests that need to inspect call counts) ─────

def _make_proof_col(find_one_return=None):
    """Return an AsyncMock tg_proof_state collection for explicit-patch tests."""
    col = MagicMock()
    col.find_one = AsyncMock(return_value=find_one_return)
    col.update_one = AsyncMock(return_value=None)
    col.delete_one = AsyncMock(return_value=None)
    return col


def _make_db(proof_col=None, *, tg_updates_claim=None):
    """Return a mock AsyncIOMotorDatabase with tg_proof_state + tg_updates."""
    updates_col = MagicMock()
    updates_col.find_one_and_update = AsyncMock(return_value=tg_updates_claim)
    db = MagicMock()
    db.tg_proof_state = proof_col or _make_proof_col()
    db.tg_updates = updates_col
    return db


# ── /buy ───────────────────────────────────────────────────────────────────

def test_buy_command_includes_usdt_addresses_bep20_trc20_ton():
    """When a user runs /buy, the bot must send all three USDT addresses."""
    fake_send = AsyncMock(return_value={"ok": True})
    with patch.object(bot, "send_message", fake_send):
        r = client.post(
            "/api/telegram/webhook",
            json={
                "update_id": 10001,
                "message": {
                    "message_id": 1,
                    "chat": {"id": 12345, "type": "private"},
                    "from": {"id": 12345, "username": "buyer"},
                    "text": "/buy",
                },
            },
        )
    assert r.status_code == 200
    assert fake_send.await_count == 1
    body = fake_send.await_args.args[1]
    assert "BEP20" in body
    assert "0xb1ab479abe81d6be059d5bb9d55a6e8d99b64bfd" in body
    assert "TRC20" in body
    assert "TCn8eNownsyUzMeHNMeUpzXJFDruCWYr5w" in body
    assert "TON" in body
    assert "UQAmwQDBLUHsSZI3SiKTDwSnvte-Y8MkwoDvzHzOGa-3xk68" in body
    assert "BTC" not in body
    assert "LTC" not in body


# ── /paid ──────────────────────────────────────────────────────────────────

def test_paid_command_enters_proof_mode():
    """/paid must write a proof entry and reply with instructions."""
    fake_send = AsyncMock(return_value={"ok": True})
    with patch.object(bot, "send_message", fake_send):
        client.post(
            "/api/telegram/webhook",
            json={
                "update_id": 10002,
                "message": {
                    "message_id": 2,
                    "chat": {"id": 555, "type": "private"},
                    "from": {"id": 555, "username": "payer"},
                    "text": "/paid",
                },
            },
        )
    # Proof entry must exist in the in-memory collection
    assert 555 in _FAKE_PROOFS.docs
    assert _FAKE_PROOFS.docs[555]["username"] == "payer"
    assert _FAKE_PROOFS.docs[555]["telegram_id"] == 555
    # Bot replied with instructions
    body = fake_send.await_args.args[1]
    assert "Proof of payment" in body
    assert "30 minutes" in body


# ── photo after /paid ──────────────────────────────────────────────────────

def test_photo_after_paid_is_forwarded_to_owner():
    """After /paid, the user's next photo must be forwarded to the owner
    and the proof entry must be consumed (single-use)."""
    # Seed an active proof entry
    _FAKE_PROOFS.docs[777] = {
        "chat_id": 777,
        "username": "ppayer",
        "telegram_id": 777,
        "expires_at": datetime.now(timezone.utc) + timedelta(hours=1),
    }

    fake_copy = AsyncMock(return_value={"ok": True, "result": {"message_id": 999}})
    fake_send = AsyncMock(return_value={"ok": True})
    with patch.object(bot, "copy_message", fake_copy), \
         patch.object(bot, "send_message", fake_send):
        client.post(
            "/api/telegram/webhook",
            json={
                "update_id": 10003,
                "message": {
                    "message_id": 11,
                    "chat": {"id": 777, "type": "private"},
                    "from": {"id": 777, "username": "ppayer"},
                    "photo": [{"file_id": "AAAAA", "width": 800, "height": 600}],
                    "caption": "MONTHLY plan — tx 0xabc",
                },
            },
        )

    # Owner got a copy with admin caption
    assert fake_copy.await_count == 1
    ck = fake_copy.await_args.kwargs
    assert ck["from_chat_id"] == 777
    assert ck["message_id"] == 11
    assert "NEW PROOF OF PAYMENT" in ck["caption"]
    assert "@ppayer" in ck["caption"]
    assert "MONTHLY plan" in ck["caption"]

    # User got a confirmation
    user_texts = [a.args[1] for a in fake_send.await_args_list]
    assert any("Proof received" in t for t in user_texts)

    # Single-use: entry removed after forwarding
    assert 777 not in _FAKE_PROOFS.docs


# ── photo without /paid mode ───────────────────────────────────────────────

def test_photo_without_paid_mode_is_ignored():
    """A photo sent without being in /paid mode must not trigger any Telegram calls."""
    # _FAKE_PROOFS.docs is empty (cleared by autouse fixture)
    fake_copy = AsyncMock()
    fake_send = AsyncMock()
    with patch.object(bot, "copy_message", fake_copy), \
         patch.object(bot, "send_message", fake_send):
        client.post(
            "/api/telegram/webhook",
            json={
                "update_id": 10004,
                "message": {
                    "message_id": 20,
                    "chat": {"id": 888, "type": "private"},
                    "from": {"id": 888, "username": "random"},
                    "photo": [{"file_id": "BBB"}],
                },
            },
        )

    assert fake_copy.await_count == 0
    assert fake_send.await_count == 0


# ── /cancel ────────────────────────────────────────────────────────────────

def test_cancel_clears_proof_mode():
    """/cancel must delete the tg_proof_state entry and confirm to the user."""
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
                "update_id": 10005,
                "message": {
                    "message_id": 30,
                    "chat": {"id": 42, "type": "private"},
                    "from": {"id": 42, "username": "u"},
                    "text": "/cancel",
                },
            },
        )

    assert 42 not in _FAKE_PROOFS.docs
    assert "Cancelled" in fake_send.await_args.args[1]


# ── /help ──────────────────────────────────────────────────────────────────

def test_help_command_lists_paid():
    """/help output must mention /paid and /cancel."""
    fake_send = AsyncMock(return_value={"ok": True})
    with patch.object(bot, "send_message", fake_send):
        client.post(
            "/api/telegram/webhook",
            json={
                "update_id": 10006,
                "message": {
                    "message_id": 40,
                    "chat": {"id": 99, "type": "private"},
                    "from": {"id": 99, "username": "h"},
                    "text": "/help",
                },
            },
        )

    body = fake_send.await_args.args[1]
    assert "/paid" in body
    assert "/cancel" in body
