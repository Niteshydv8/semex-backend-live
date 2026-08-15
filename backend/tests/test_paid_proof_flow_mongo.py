"""Unit and integration tests for the /paid → screenshot proof-of-payment flow.

The proof state was migrated from an in-memory dict to the `tg_proof_state`
MongoDB collection.  Tests use either:

  • _FakeProofCollection — a real stateful in-memory stand-in (used for tests
    that must verify storage continuity: state written by one call is read back
    by the next).
  • AsyncMock-based _make_proof_col — used for unit tests that only need to
    inspect call counts / arguments on individual helper functions.

Scenarios covered:
  1. _cmd_paid inserts a document into tg_proof_state.
  2. _forward_proof_to_owner reads the entry, forwards to the owner, and
     removes the document (single-use) — all on the same collection.
  3. After the forward, _get_proof_entry on the same collection returns None.
  4. A photo arriving when no proof entry exists is silently ignored.
  5. _cmd_cancel deletes the entry.
  6. An expired entry is rejected with a user-facing message.
  7. Webhook end-to-end: POST /paid → POST photo both share ONE stateful
     in-memory collection so the state written by /paid is the state read
     by the photo handler — this confirms the full dispatch + handoff.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


# ── helpers ────────────────────────────────────────────────────────────────

def _run(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def _future_expiry(seconds: int = 1800) -> datetime:
    return datetime.now(timezone.utc) + timedelta(seconds=seconds)


# ── Stateful in-memory stand-in ────────────────────────────────────────────

class _FakeProofCollection:
    """In-memory stand-in for the tg_proof_state Motor collection.

    update_one / find_one / delete_one behave like the real collection so
    tests can verify end-to-end storage continuity without a live MongoDB.
    """

    def __init__(self):
        self.docs: dict[int, dict] = {}

    async def find_one(self, query):
        return self.docs.get(query.get("chat_id"))

    async def update_one(self, query, update, *, upsert=False, **kw):
        cid = query.get("chat_id")
        if cid in self.docs or upsert:
            self.docs[cid] = dict(update.get("$set", {}))

    async def delete_one(self, query):
        self.docs.pop(query.get("chat_id"), None)


class _FakeDB:
    """Minimal Motor database stand-in carrying tg_proof_state.

    tg_updates is intentionally absent; the webhook handler's replay-dedup
    call raises AttributeError which is caught and ignored, allowing the
    command to proceed normally.
    """
    def __init__(self, proof_col: _FakeProofCollection):
        self.tg_proof_state = proof_col


# ── AsyncMock factory (unit tests only) ────────────────────────────────────

def _make_proof_col(find_one_return=None):
    """Return an AsyncMock tg_proof_state collection for call-inspection tests."""
    col = MagicMock()
    col.find_one = AsyncMock(return_value=find_one_return)
    col.update_one = AsyncMock(return_value=None)
    col.delete_one = AsyncMock(return_value=None)
    return col


def _make_db_mock(find_one_return=None):
    """Return a full AsyncMock db (including tg_updates) for unit tests."""
    proof_col = _make_proof_col(find_one_return)
    updates_col = MagicMock()
    updates_col.find_one_and_update = AsyncMock(return_value=None)
    db = MagicMock()
    db.tg_proof_state = proof_col
    db.tg_updates = updates_col
    return db, proof_col


# ── 1. _cmd_paid inserts a document ────────────────────────────────────────

def test_cmd_paid_upserts_proof_state(monkeypatch):
    """_cmd_paid must upsert a document into tg_proof_state."""
    from routes import telegram_bot as tg

    proof_col = _FakeProofCollection()
    db = _FakeDB(proof_col)

    async def fake_send(*a, **kw):
        return {"ok": True}

    monkeypatch.setattr(tg, "send_message", fake_send)

    with patch("db.get_db", return_value=db):
        _run(tg._cmd_paid(chat_id=1001, username="alice", telegram_id=1001))

    # Document must exist in the collection
    assert 1001 in proof_col.docs
    doc = proof_col.docs[1001]
    assert doc["chat_id"] == 1001
    assert doc["username"] == "alice"
    assert doc["telegram_id"] == 1001
    assert "expires_at" in doc


# ── 2 & 3. _forward_proof_to_owner reads, copies, and clears ──────────────

def test_forward_proof_to_owner_reads_clears_and_copies(monkeypatch):
    """_forward_proof_to_owner must read the entry on the same collection,
    copy the photo to the owner, confirm to the user, and delete the entry."""
    from routes import telegram_bot as tg

    proof_col = _FakeProofCollection()
    proof_col.docs[2001] = {
        "chat_id": 2001,
        "username": "bob",
        "telegram_id": 2001,
        "expires_at": _future_expiry(),
    }
    db = _FakeDB(proof_col)

    copy_calls = []
    send_calls = []

    async def fake_copy(**kw):
        copy_calls.append(kw)
        return {"ok": True}

    async def fake_send(chat_id, text, **kw):
        send_calls.append((chat_id, text))
        return {"ok": True}

    monkeypatch.setattr(tg, "copy_message", fake_copy)
    monkeypatch.setattr(tg, "send_message", fake_send)

    with patch("db.get_db", return_value=db):
        _run(tg._forward_proof_to_owner(
            chat_id=2001,
            user_message_id=42,
            photo_caption="MONTHLY plan",
        ))

    # copy_message was called with the right args
    assert len(copy_calls) == 1
    ck = copy_calls[0]
    assert ck["from_chat_id"] == 2001
    assert ck["message_id"] == 42
    assert "NEW PROOF OF PAYMENT" in ck["caption"]
    assert "@bob" in ck["caption"]
    assert "MONTHLY plan" in ck["caption"]

    # User got a confirmation
    assert any("Proof received" in t for _, t in send_calls), \
        f"no 'Proof received' in {send_calls}"

    # Entry was consumed from the SAME collection
    assert 2001 not in proof_col.docs, "entry must be gone after single-use forward"


def test_entry_cleared_after_forward(monkeypatch):
    """After _forward_proof_to_owner, _get_proof_entry on the same collection
    must return None (entry is consumed; no separate mock swap)."""
    from routes import telegram_bot as tg

    proof_col = _FakeProofCollection()
    proof_col.docs[3001] = {
        "chat_id": 3001,
        "username": "carol",
        "telegram_id": 3001,
        "expires_at": _future_expiry(),
    }
    db = _FakeDB(proof_col)

    monkeypatch.setattr(tg, "copy_message", AsyncMock(return_value={"ok": True}))
    monkeypatch.setattr(tg, "send_message", AsyncMock(return_value={"ok": True}))

    with patch("db.get_db", return_value=db):
        _run(tg._forward_proof_to_owner(
            chat_id=3001,
            user_message_id=99,
            photo_caption=None,
        ))
        # Query the same collection through the same DB object
        result = _run(tg._get_proof_entry(3001))

    assert result is None, "entry must be absent after it has been consumed"
    assert 3001 not in proof_col.docs


# ── 4. Photo with no proof entry is silently ignored ─────────────────────

def test_photo_without_proof_entry_is_ignored(monkeypatch):
    """When no tg_proof_state entry exists, receiving a photo must not call
    copy_message or send_message."""
    from routes import telegram_bot as tg

    db, _ = _make_db_mock(find_one_return=None)

    copy_mock = AsyncMock()
    send_mock = AsyncMock()
    monkeypatch.setattr(tg, "copy_message", copy_mock)
    monkeypatch.setattr(tg, "send_message", send_mock)

    with patch("db.get_db", return_value=db):
        _run(tg._forward_proof_to_owner(
            chat_id=4001,
            user_message_id=7,
            photo_caption="some caption",
        ))

    assert copy_mock.await_count == 0, "copy_message must not be called with no proof entry"
    assert send_mock.await_count == 0, "send_message must not be called with no proof entry"


# ── 5. _cmd_cancel deletes the entry ──────────────────────────────────────

def test_cancel_deletes_proof_entry(monkeypatch):
    """_cmd_cancel must delete the proof entry and confirm to the user."""
    from routes import telegram_bot as tg

    proof_col = _FakeProofCollection()
    proof_col.docs[5001] = {
        "chat_id": 5001,
        "username": "eve",
        "telegram_id": 5001,
        "expires_at": _future_expiry(),
    }
    db = _FakeDB(proof_col)
    send_calls = []

    async def fake_send(chat_id, text, **kw):
        send_calls.append((chat_id, text))
        return {"ok": True}

    monkeypatch.setattr(tg, "send_message", fake_send)

    with patch("db.get_db", return_value=db):
        _run(tg._cmd_cancel(chat_id=5001))

    assert 5001 not in proof_col.docs, "entry must be removed by /cancel"
    assert any("Cancelled" in t for _, t in send_calls), \
        f"expected 'Cancelled' confirmation, got {send_calls}"


# ── 6. Expired entry is rejected with a user-facing message ──────────────

def test_expired_proof_entry_is_rejected(monkeypatch):
    """If expires_at has passed, _forward_proof_to_owner must NOT forward the
    photo, must clear the entry, and must inform the user."""
    from routes import telegram_bot as tg

    proof_col = _FakeProofCollection()
    proof_col.docs[6001] = {
        "chat_id": 6001,
        "username": "dave",
        "telegram_id": 6001,
        "expires_at": datetime.now(timezone.utc) - timedelta(seconds=10),
    }
    db = _FakeDB(proof_col)

    copy_mock = AsyncMock()
    send_calls = []

    async def fake_send(chat_id, text, **kw):
        send_calls.append((chat_id, text))
        return {"ok": True}

    monkeypatch.setattr(tg, "copy_message", copy_mock)
    monkeypatch.setattr(tg, "send_message", fake_send)

    with patch("db.get_db", return_value=db):
        _run(tg._forward_proof_to_owner(
            chat_id=6001,
            user_message_id=55,
            photo_caption=None,
        ))

    assert copy_mock.await_count == 0, "must not forward photo after expiry"
    assert 6001 not in proof_col.docs, "expired entry must be cleared"
    assert any("expired" in t.lower() or "window" in t.lower() for _, t in send_calls), \
        f"expected expiry message, got {send_calls}"


# ── 7. Webhook end-to-end: POST /paid → POST photo ─────────────────────────

def test_webhook_paid_then_photo_end_to_end(monkeypatch):
    """Full inbound webhook path using ONE stateful _FakeProofCollection.

    The state written by the /paid POST is the state read by the photo POST.
    There is no manual fabrication of the proof document between requests.

    Step 1 – POST /paid:
      • tg_proof_state must contain a document for this chat_id afterward.
      • The document must carry the correct username and telegram_id.

    Step 2 – POST photo (same collection, same DB):
      • copy_message must be called (photo forwarded to owner).
      • The proof entry must be gone from the collection (single-use).
      • The user must receive a confirmation message.
    """
    from fastapi.testclient import TestClient
    from server import app
    from routes import telegram_bot as tg

    test_client = TestClient(app)
    CHAT_ID = 9001

    # ONE stateful collection shared across both requests
    proof_col = _FakeProofCollection()
    db = _FakeDB(proof_col)

    # ── Step 1: POST /paid ─────────────────────────────────────────────────
    send_calls_paid = []

    async def fake_send_paid(chat_id, text, **kw):
        send_calls_paid.append((chat_id, text))
        return {"ok": True}

    with patch.object(tg, "send_message", fake_send_paid), \
         patch("db.get_db", return_value=db):
        r = test_client.post(
            "/api/telegram/webhook",
            json={
                "update_id": 20001,
                "message": {
                    "message_id": 100,
                    "chat": {"id": CHAT_ID, "type": "private"},
                    "from": {"id": CHAT_ID, "username": "e2e_user"},
                    "text": "/paid",
                },
            },
        )
    assert r.status_code == 200

    # State written by /paid must exist in the collection
    assert CHAT_ID in proof_col.docs, \
        "/paid must have written a proof entry to tg_proof_state"
    stored = proof_col.docs[CHAT_ID]
    assert stored["username"] == "e2e_user"
    assert stored["telegram_id"] == CHAT_ID
    assert "expires_at" in stored

    # Bot replied with instructions
    assert any("Proof of payment" in t for _, t in send_calls_paid), \
        f"expected /paid instructions, got {send_calls_paid}"

    # ── Step 2: POST photo (SAME collection, SAME db) ──────────────────────
    copy_calls = []
    send_calls_photo = []

    async def fake_copy(**kw):
        copy_calls.append(kw)
        return {"ok": True}

    async def fake_send_photo(chat_id, text, **kw):
        send_calls_photo.append((chat_id, text))
        return {"ok": True}

    with patch.object(tg, "copy_message", fake_copy), \
         patch.object(tg, "send_message", fake_send_photo), \
         patch("db.get_db", return_value=db):
        r2 = test_client.post(
            "/api/telegram/webhook",
            json={
                "update_id": 20002,
                "message": {
                    "message_id": 101,
                    "chat": {"id": CHAT_ID, "type": "private"},
                    "from": {"id": CHAT_ID, "username": "e2e_user"},
                    "photo": [{"file_id": "FILE_XYZ", "width": 1280, "height": 720}],
                    "caption": "MONTHLY — tx 0xdeadbeef",
                },
            },
        )
    assert r2.status_code == 200

    # Photo was forwarded to the owner
    assert len(copy_calls) == 1, "copy_message must be called exactly once"
    ck = copy_calls[0]
    assert ck["from_chat_id"] == CHAT_ID
    assert ck["message_id"] == 101
    assert "NEW PROOF OF PAYMENT" in ck["caption"]
    assert "@e2e_user" in ck["caption"]
    assert "MONTHLY" in ck["caption"]

    # Entry consumed from the SAME collection — no separate mock swap
    assert CHAT_ID not in proof_col.docs, \
        "proof entry must be gone after the photo is forwarded (single-use)"

    # User got a confirmation
    assert any("Proof received" in t for _, t in send_calls_photo), \
        f"expected 'Proof received' confirmation, got {send_calls_photo}"
