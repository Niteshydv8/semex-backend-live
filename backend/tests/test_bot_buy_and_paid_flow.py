"""Tests for /buy USDT addresses + /paid proof-of-payment flow."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

import server as server_module
import routes.telegram_bot as bot

client = TestClient(server_module.app)


def _reset_proof_state():
    bot._PROOF_STATE.clear()


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
                    "chat": {"id": 12345},
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
                    "chat": {"id": 555},
                    "from": {"id": 555, "username": "payer"},
                    "text": "/paid",
                }
            },
        )
    assert 555 in bot._PROOF_STATE
    assert bot._PROOF_STATE[555]["username"] == "payer"
    assert bot._PROOF_STATE[555]["telegram_id"] == 555
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
                    "chat": {"id": 777},
                    "from": {"id": 777, "username": "ppayer"},
                    "text": "/paid",
                }
            },
        )
    assert 777 in bot._PROOF_STATE
    # Now send a photo → should trigger copy_message to owner
    fake_copy = AsyncMock(return_value={"ok": True, "result": {"message_id": 999}})
    fake_send2 = AsyncMock(return_value={"ok": True})
    with patch.object(bot, "copy_message", fake_copy), patch.object(bot, "send_message", fake_send2):
        client.post(
            "/api/telegram/webhook",
            json={
                "message": {
                    "message_id": 11,
                    "chat": {"id": 777},
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
    assert 777 not in bot._PROOF_STATE


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
                    "chat": {"id": 888},
                    "from": {"id": 888, "username": "random"},
                    "photo": [{"file_id": "BBB"}],
                }
            },
        )
    assert fake_copy.await_count == 0
    assert fake_send.await_count == 0


def test_cancel_clears_proof_mode():
    _reset_proof_state()
    bot._PROOF_STATE[42] = {"ts": 999999.0, "username": "u", "telegram_id": 42}
    fake_send = AsyncMock(return_value={"ok": True})
    with patch.object(bot, "send_message", fake_send):
        client.post(
            "/api/telegram/webhook",
            json={
                "message": {
                    "message_id": 30,
                    "chat": {"id": 42},
                    "from": {"id": 42, "username": "u"},
                    "text": "/cancel",
                }
            },
        )
    assert 42 not in bot._PROOF_STATE
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
                    "chat": {"id": 99},
                    "from": {"id": 99, "username": "h"},
                    "text": "/help",
                }
            },
        )
    body = fake_send.await_args.args[1]
    assert "/paid" in body
    assert "/cancel" in body
