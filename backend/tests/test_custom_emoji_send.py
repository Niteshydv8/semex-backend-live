"""Tests for telegram.send_message / send_photo payload structure when
premium_emojis flag is on/off. We monkeypatch services.telegram._post so no
real network call is made; instead we inspect exactly what would have been
sent to the Telegram Bot API.
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
import importlib
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from services import telegram as tg  # noqa: E402
from services.custom_emojis import DEFAULT_EMOJI_MAP  # noqa: E402


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro) if False else asyncio.new_event_loop().run_until_complete(coro)


# ---------- send_message ----------

def test_send_message_includes_entities_when_premium_true(monkeypatch):
    captured = {}

    async def fake_post(method, data, files=None):
        captured["method"] = method
        captured["data"] = data
        captured["files"] = files
        return {"ok": True, "result": {"message_id": 42}}

    monkeypatch.setattr(tg, "_post", fake_post)

    result = _run(tg.send_message(12345, "Hi ✅ 🔥 ⚡ done", premium_emojis=True))
    assert result and result.get("ok") is True

    assert captured["method"] == "sendMessage"
    payload = captured["data"]
    assert payload["chat_id"] == 12345
    assert payload["text"] == "Hi ✅ 🔥 ⚡ done"
    assert "entities" in payload, "premium_emojis=True must attach entities"
    entities = payload["entities"]
    assert isinstance(entities, list) and len(entities) == 3
    for e in entities:
        assert e["type"] == "custom_emoji"
        assert "offset" in e and isinstance(e["offset"], int)
        assert "length" in e and e["length"] in (1, 2)
        assert "custom_emoji_id" in e and isinstance(e["custom_emoji_id"], str)
    ids = {e["custom_emoji_id"] for e in entities}
    assert DEFAULT_EMOJI_MAP["✅"] in ids
    assert DEFAULT_EMOJI_MAP["🔥"] in ids
    assert DEFAULT_EMOJI_MAP["⚡"] in ids


def test_send_message_omits_entities_when_premium_false(monkeypatch):
    captured = {}

    async def fake_post(method, data, files=None):
        captured["data"] = data
        return {"ok": True, "result": {"message_id": 1}}

    monkeypatch.setattr(tg, "_post", fake_post)

    _run(tg.send_message(12345, "Hi ✅ 🔥 ⚡", premium_emojis=False))

    assert "entities" not in captured["data"], "premium_emojis=False must NOT attach entities"
    # Sanity: message still built with text/chat_id
    assert captured["data"]["chat_id"] == 12345
    assert captured["data"]["parse_mode"] == "HTML"


def test_send_message_no_entities_when_no_known_emoji(monkeypatch):
    """Text without any known emoji → payload must not include an empty entities list."""
    captured = {}

    async def fake_post(method, data, files=None):
        captured["data"] = data
        return {"ok": True, "result": {"message_id": 1}}

    monkeypatch.setattr(tg, "_post", fake_post)
    _run(tg.send_message(1, "just plain text", premium_emojis=True))
    assert "entities" not in captured["data"]


# ---------- send_photo ----------

def test_send_photo_caption_entities_json_stringified(monkeypatch):
    captured = {}

    async def fake_post(method, data, files=None):
        captured["method"] = method
        captured["data"] = data
        captured["files"] = files
        return {"ok": True, "result": {"message_id": 7}}

    monkeypatch.setattr(tg, "_post", fake_post)

    _run(tg.send_photo(9999, b"\xff\xd8\xff\xe0fakebytes",
                       "✅ CHARGED ⚡ 🔥", premium_emojis=True))

    assert captured["method"] == "sendPhoto"
    data = captured["data"]
    assert data["chat_id"] == "9999"  # str per Bot API multipart requirement
    assert data["caption"] == "✅ CHARGED ⚡ 🔥"
    assert "caption_entities" in data, "premium_emojis=True must attach caption_entities"

    # Multipart quirk: caption_entities MUST be a JSON-encoded string.
    ce = data["caption_entities"]
    assert isinstance(ce, str), f"caption_entities must be JSON string, got {type(ce)}"
    parsed = json.loads(ce)
    assert isinstance(parsed, list) and len(parsed) == 3
    for e in parsed:
        assert e["type"] == "custom_emoji"
        assert isinstance(e["custom_emoji_id"], str)
    # files still contains the photo tuple
    assert captured["files"] and "photo" in captured["files"]


def test_send_photo_no_caption_entities_when_premium_false(monkeypatch):
    captured = {}

    async def fake_post(method, data, files=None):
        captured["data"] = data
        return {"ok": True, "result": {"message_id": 1}}

    monkeypatch.setattr(tg, "_post", fake_post)
    _run(tg.send_photo(1, b"x", "✅ ⚡ 🔥 nope", premium_emojis=False))
    assert "caption_entities" not in captured["data"]


# ---------- CUSTOM_EMOJI_MAP override ----------

def test_custom_emoji_map_env_override(monkeypatch):
    """Setting CUSTOM_EMOJI_MAP before (re)importing the module loads that map."""
    monkeypatch.setenv("CUSTOM_EMOJI_MAP", '{"🚀":"12345","💎":"67890"}')
    import services.custom_emojis as ce_mod
    reloaded = importlib.reload(ce_mod)
    try:
        assert reloaded.EMOJI_MAP.get("🚀") == "12345"
        assert reloaded.EMOJI_MAP.get("💎") == "67890"
        ents = reloaded.build_entities("hi 🚀 go 💎!")
        ids = {e["custom_emoji_id"] for e in ents}
        assert ids == {"12345", "67890"}
    finally:
        # Restore defaults for other tests
        monkeypatch.delenv("CUSTOM_EMOJI_MAP", raising=False)
        importlib.reload(ce_mod)


def test_custom_emoji_map_env_invalid_json_falls_back(monkeypatch):
    """Malformed JSON in CUSTOM_EMOJI_MAP must fall back to DEFAULT_EMOJI_MAP with warning."""
    monkeypatch.setenv("CUSTOM_EMOJI_MAP", '{not valid json}')
    import services.custom_emojis as ce_mod
    reloaded = importlib.reload(ce_mod)
    try:
        assert reloaded.EMOJI_MAP == reloaded.DEFAULT_EMOJI_MAP
        # Verify defaults still work
        ents = reloaded.build_entities("hit ✅")
        assert len(ents) == 1
        assert ents[0]["custom_emoji_id"] == reloaded.DEFAULT_EMOJI_MAP["✅"]
    finally:
        monkeypatch.delenv("CUSTOM_EMOJI_MAP", raising=False)
        importlib.reload(ce_mod)


def test_custom_emoji_map_env_non_dict_falls_back(monkeypatch):
    """A JSON list (not dict) must also fall back to DEFAULT_EMOJI_MAP."""
    monkeypatch.setenv("CUSTOM_EMOJI_MAP", '["a","b"]')
    import services.custom_emojis as ce_mod
    reloaded = importlib.reload(ce_mod)
    try:
        assert reloaded.EMOJI_MAP == reloaded.DEFAULT_EMOJI_MAP
    finally:
        monkeypatch.delenv("CUSTOM_EMOJI_MAP", raising=False)
        importlib.reload(ce_mod)


# ---------- Route wiring verification (grep-style) ----------

def test_telegram_service_signature_defaults_premium_true():
    """Route callers (routes/data.py) rely on premium_emojis defaulting to True
    so no code change is needed to upgrade admin-log/public-group forwarding."""
    import inspect
    sig_msg = inspect.signature(tg.send_message)
    assert sig_msg.parameters["premium_emojis"].default is True, \
        "send_message must default premium_emojis=True to auto-upgrade existing callers"

    sig_photo = inspect.signature(tg.send_photo)
    assert sig_photo.parameters["premium_emojis"].default is True, \
        "send_photo must default premium_emojis=True to auto-upgrade existing callers"


def test_data_route_uses_send_message_without_override():
    """Sanity: /app/backend/routes/data.py calls send_message() without
    explicitly setting premium_emojis=False anywhere (else the upgrade would
    silently skip that path)."""
    src = (BACKEND_DIR / "routes" / "data.py").read_text()
    assert "premium_emojis=False" not in src, \
        "routes/data.py must not disable premium_emojis on any Telegram call"
