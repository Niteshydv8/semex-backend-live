"""Regression: /buy bot command replies with plan details + crypto addresses
so users can pay and message the owner for activation.

The command must be dispatchable AND the message content must include:
  - plan tier names (MONTHLY / YEARLY / LIFETIME)
  - at least one payment section marker (USDT / BTC / crypto)
  - the owner handle (or bot handle) for follow-up
  - the 3DS Bypass premium mention

We test both the private helper `_cmd_buy` (unit) and the dispatch path
(integration) that routes `/buy` to it.
"""
from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch

import pytest


def _run(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def test_buy_command_message_shape(monkeypatch):
    """_cmd_buy must send a Telegram message with plan tiers + at least one
    crypto section + owner handle. YEARLY/LIFETIME tiers are hidden when their
    price env vars are empty (by design), so configure them here."""
    from routes import telegram_bot as tg

    captured = []
    async def fake_send(chat_id, text, **kw):
        captured.append((chat_id, text))
        return {"ok": True, "result": {"message_id": 1}}
    monkeypatch.setattr(tg, "send_message", fake_send)
    monkeypatch.setattr(tg.settings, "PLAN_PRICE_YEARLY", "$500")
    monkeypatch.setattr(tg.settings, "PLAN_PRICE_LIFETIME", "$1000")

    _run(tg._cmd_buy(chat_id=12345, username="alice"))
    assert len(captured) == 1
    text = captured[0][1]
    # Plan tiers
    assert "MONTHLY" in text
    assert "YEARLY" in text
    assert "LIFETIME" in text
    # Payment section
    assert ("USDT" in text) or ("BTC" in text) or ("crypto" in text.lower())
    # Follow-up handle (owner or bot fallback)
    assert "@" in text
    # Premium unlock mention
    assert "3DS Bypass" in text or "3DS" in text


@pytest.mark.parametrize("cmd", ["/buy", "/premium", "/upgrade", "/plans"])
def test_buy_command_aliases_are_dispatched(monkeypatch, cmd):
    """The dispatcher routes /buy AND its aliases to _cmd_buy."""
    from routes import telegram_bot as tg
    from fastapi.testclient import TestClient
    from server import app

    called = {"n": 0}
    async def fake_buy(chat_id, username):
        called["n"] += 1
    monkeypatch.setattr(tg, "_cmd_buy", fake_buy)

    # Also stub send_message so anything else the handler tries to send is silenced.
    async def _silent_send(*a, **k): return {"ok": True}
    monkeypatch.setattr(tg, "send_message", _silent_send)

    client = TestClient(app)
    resp = client.post(
        "/api/telegram/webhook",
        json={
            "update_id": 1,
            "message": {
                "message_id": 1,
                "text": cmd,
                "chat": {"id": 12345, "type": "private"},
                "from": {"id": 12345, "username": "bob"},
            },
        },
    )
    assert resp.status_code == 200, resp.text
    assert called["n"] == 1, f"{cmd} did not dispatch to _cmd_buy"
