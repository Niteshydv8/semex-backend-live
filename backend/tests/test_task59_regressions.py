"""Task-59 regression tests — one test per backend bug fixed in the audit.

Covers:
1. routes/auth.py     — redeem-rollback error path raised NameError (undefined `log`)
2. routes/data.py     — dedup log line leaked the FULL card number via the dedup key
3. routes/telegram_bot.py — one-shot proof state was consumed BEFORE copy_message;
                        a failed forward silently ate the user's proof window
4. routes/telegram_bot.py — Stars fulfillment lacked upsert=True: a buyer with no
                        user doc paid but never got Premium
5. routes/telegram_bot.py — menu callbacks fired in group chats (plan/BIN leak)
6. services/extra_formatters.py — receipt/expiry messages interpolated unescaped
                        user data → Telegram 400 on <, >, &
7. static/admin.html  — broadcastRelease() POSTed without a body → always 422
"""
from __future__ import annotations

import asyncio
import logging
import types
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException


def _run(coro):
    return asyncio.run(coro)


# ---------------------------------------------------------------------------
# 1. Redeem rollback must NOT NameError when the rollback itself fails
# ---------------------------------------------------------------------------

def test_redeem_rollback_failure_raises_500_not_nameerror(monkeypatch):
    import routes.auth as auth_mod
    from models import User

    class _Codes:
        async def find_one(self, q):
            return {"_id": "c1", "code_preview": "SEMEX-TEST", "duration_days": 30,
                    "plan_tag": "MONTHLY", "used": False}

        async def find_one_and_update(self, q, u):
            return {"_id": "c1", "code_preview": "SEMEX-TEST", "duration_days": 30,
                    "plan_tag": "MONTHLY"}

        async def update_one(self, q, u):
            raise RuntimeError("mongo down (rollback also fails)")

    class _Users:
        async def update_one(self, q, u):
            raise RuntimeError("mongo down (entitlement write)")

    fake_db = types.SimpleNamespace(redeem_codes=_Codes(), users=_Users())
    monkeypatch.setattr(auth_mod, "get_db", lambda: fake_db)

    now = datetime.now(timezone.utc)
    user = User(
        telegram_id=424242, telegram_username="redeemer", telegram_first_name="R",
        plan="TRIAL", plan_expires_at=now + timedelta(days=1),
        is_admin=False, is_banned=False, hit_count=0, charged_count=0,
        created_at=now, last_seen_at=now,
    )
    body = types.SimpleNamespace(code="SEMEX-TEST-CODE")

    with pytest.raises(HTTPException) as exc:
        _run(auth_mod.redeem(body, user))
    # Pre-fix this path died with NameError: name 'log' is not defined.
    assert exc.value.status_code == 500
    assert "NOT used" in str(exc.value.detail)


# ---------------------------------------------------------------------------
# 2. Dedup-drop log line must never contain the full card number
# ---------------------------------------------------------------------------

def test_dedup_log_does_not_leak_full_pan(monkeypatch, caplog):
    import routes.data as data_route
    from models import User

    async def fake_enqueue_message(db, chat_id, text, **kwargs):
        return True

    async def fake_enqueue_photo(db, chat_id, photo, caption, **kwargs):
        return True

    async def fake_lookup_bin(*args, **kwargs):
        return None

    monkeypatch.setattr(data_route.telegram_outbox, "enqueue_message", fake_enqueue_message)
    monkeypatch.setattr(data_route.telegram_outbox, "enqueue_photo", fake_enqueue_photo)
    monkeypatch.setattr(data_route, "lookup_bin", fake_lookup_bin)

    class _Hits:
        async def insert_one(self, doc):
            return types.SimpleNamespace(inserted_id="x")
        async def update_one(self, *a, **k):
            return None
    class _Users:
        async def update_one(self, *a, **k):
            return None
    fake_db = types.SimpleNamespace(hits=_Hits(), users=_Users())
    monkeypatch.setattr(data_route, "get_db", lambda: fake_db)
    data_route._RECENT_HIT_DEDUP.clear()

    now = datetime.now(timezone.utc)
    user = User(
        telegram_id=777001, telegram_username="dedup_t", telegram_first_name="D",
        plan="YEARLY", plan_expires_at=now + timedelta(days=30),
        is_admin=False, is_banned=False, hit_count=0, charged_count=0,
        created_at=now, last_seen_at=now,
    )
    pan = "4111111111119999"
    body = data_route.StatusBody(
        status="CHARGED", gateway="Stripe", amount=10.0, currency="USD",
        url=f"https://api.stripe.com/v1/payment_intents/pi_dedup_test",
        card={"number": pan, "month": "12", "year": "30", "cvv": "123"},
    )
    req = types.SimpleNamespace(
        headers={"cf-connecting-ip": "198.51.100.7"},
        client=types.SimpleNamespace(host="198.51.100.7"),
        state=types.SimpleNamespace(extension_outdated=False),
    )

    with caplog.at_level(logging.INFO):
        r1 = _run(data_route.submit_status(body, request=req, user=user))
        assert r1.get("success") is True
        # Second identical submission inside the dedup window → dropped as dup
        r2 = _run(data_route.submit_status(body, request=req, user=user))
        assert r2.get("duplicate") is True

    logged = "\n".join(rec.getMessage() for rec in caplog.records)
    assert "duplicate hit dropped" in logged, "dedup drop should still be logged"
    assert pan not in logged, f"FULL PAN leaked into logs: {logged}"
    data_route._RECENT_HIT_DEDUP.clear()


# ---------------------------------------------------------------------------
# 3. Proof entry survives a failed owner-forward; cleared only on success
# ---------------------------------------------------------------------------

def _proof_entry():
    return {
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=5),
        "username": "buyer",
        "telegram_id": 555000111,
    }


def test_proof_state_retained_when_copy_to_owner_fails(monkeypatch):
    import routes.telegram_bot as bot

    cleared = []
    async def fake_get(chat_id):
        return _proof_entry()
    async def failing_copy(**kwargs):
        raise RuntimeError("telegram 400")
    async def fake_send(chat_id, text, **kw):
        return {"ok": True}
    async def fake_clear(chat_id):
        cleared.append(chat_id)

    monkeypatch.setattr(bot, "_get_proof_entry", fake_get)
    monkeypatch.setattr(bot, "copy_message", failing_copy)
    monkeypatch.setattr(bot, "send_message", fake_send)
    monkeypatch.setattr(bot, "_clear_proof_entry", fake_clear)

    _run(bot._forward_proof_to_owner(555000111, 9001, "tx note"))
    assert cleared == [], "proof entry must NOT be consumed when the forward fails"


def test_proof_state_cleared_after_successful_copy(monkeypatch):
    import routes.telegram_bot as bot

    cleared = []
    async def fake_get(chat_id):
        return _proof_entry()
    async def ok_copy(**kwargs):
        return {"ok": True}
    async def fake_send(chat_id, text, **kw):
        return {"ok": True}
    async def fake_clear(chat_id):
        cleared.append(chat_id)

    monkeypatch.setattr(bot, "_get_proof_entry", fake_get)
    monkeypatch.setattr(bot, "copy_message", ok_copy)
    monkeypatch.setattr(bot, "send_message", fake_send)
    monkeypatch.setattr(bot, "_clear_proof_entry", fake_clear)

    _run(bot._forward_proof_to_owner(555000111, 9001, None))
    assert cleared == [555000111], "proof entry must be consumed after a successful forward"


# ---------------------------------------------------------------------------
# 4. Stars fulfillment upserts a user doc for first-time buyers
# ---------------------------------------------------------------------------

def test_stars_plan_monthly_upserts_missing_user_doc(monkeypatch):
    import routes.telegram_bot as bot
    import db as db_mod

    update_calls = []

    class _Users:
        async def find_one(self, q):
            return None  # buyer never registered
        async def update_one(self, q, u, **kwargs):
            update_calls.append((q, u, kwargs))
    class _StarPayments:
        async def update_one(self, *a, **k):
            return None
    fake_db = types.SimpleNamespace(users=_Users(), star_payments=_StarPayments())
    monkeypatch.setattr(db_mod, "get_db", lambda: fake_db)

    async def fake_send(chat_id, text, **kw):
        return {"ok": True}
    monkeypatch.setattr(bot, "send_message", fake_send)

    message = {
        "successful_payment": {
            "invoice_payload": "stars:plan_monthly",
            "telegram_payment_charge_id": "chg_test_1",
            "total_amount": 5000,
        },
        "chat": {"id": 88123456},
        "from": {"id": 88123456, "username": "firsttimebuyer"},
    }
    _run(bot._fulfill_stars_payment(message))

    plan_updates = [c for c in update_calls if c[2].get("upsert")]
    assert plan_updates, (
        "plan_monthly fulfillment must upsert the user doc — without it a "
        "first-time buyer paid but never got Premium"
    )
    q, u, _kw = plan_updates[0]
    assert q == {"telegram_id": 88123456}
    assert u["$set"]["plan"] == "MONTHLY"
    assert u["$setOnInsert"]["telegram_id"] == 88123456


# ---------------------------------------------------------------------------
# 5. Menu callbacks in group chats must send nothing
# ---------------------------------------------------------------------------

def test_group_chat_callback_sends_nothing(monkeypatch):
    import routes.telegram_bot as bot

    sent = []
    answered = []
    async def fake_send(chat_id, text, **kw):
        sent.append((chat_id, text))
        return {"ok": True}
    async def fake_answer(cb_id, **kw):
        answered.append(cb_id)
        return {"ok": True}

    monkeypatch.setattr(bot, "send_message", fake_send)
    monkeypatch.setattr(bot, "answer_callback_query", fake_answer)

    callback = {
        "id": "cbq1",
        "data": "menu:get",
        "from": {"id": 555000111, "username": "tapper"},
        "message": {"chat": {"id": -100111222333, "type": "supergroup"}, "message_id": 5},
    }
    _run(bot._handle_callback(callback))

    assert answered == ["cbq1"], "callback should still be acked (spinner)"
    assert sent == [], f"group callback must not leak content into the group, sent: {sent}"


# ---------------------------------------------------------------------------
# 6. Receipt / expiry formatters escape HTML metacharacters
# ---------------------------------------------------------------------------

def test_purchase_receipt_escapes_user_supplied_html():
    from services.extra_formatters import format_purchase_receipt

    evil = "<b>&lt;script&gt;"
    msg = format_purchase_receipt(
        {"telegram_username": evil, "telegram_first_name": "x"},
        plan_tag="MONTHLY<th>",
        duration_days=30,
        expires_at=datetime.now(timezone.utc),
        code_preview="SEMEX-<b>",
    )
    assert "<script>" not in msg and "<th>" not in msg and "SEMEX-<b>" not in msg
    assert "&lt;" in msg and "&gt;" in msg


def test_expiry_formatters_escape_handles():
    from services.extra_formatters import format_expiry_alert, format_expired

    evil = "a<b>&c"
    user = {"telegram_username": evil, "plan": "TRIAL<x>"}
    for msg in (format_expiry_alert(user, 24), format_expired(user)):
        assert "a<b>" not in msg and "TRIAL<x>" not in msg
        assert "a&lt;b&gt;&amp;c" in msg


# ---------------------------------------------------------------------------
# 7. admin.html broadcastRelease must POST a JSON body (route requires one)
# ---------------------------------------------------------------------------

def test_admin_html_broadcast_release_sends_body():
    from pathlib import Path
    import re

    src = (Path(__file__).resolve().parents[1] / "static" / "admin.html").read_text()
    m = re.search(r'api\("/api/admin/extension/versions/"\s*\+\s*id\s*\+\s*"/broadcast"[^;]+;', src)
    assert m, "broadcastRelease api() call not found in admin.html"
    call = m.group(0)
    assert "body" in call, (
        "broadcastRelease() must send a JSON body — the FastAPI route requires "
        "BroadcastReleaseBody and a bodiless POST always returned 422"
    )
