"""Tests for the new telegram_bot router (webhook + extension download).

Verifies:
- POST /api/telegram/webhook must always return 200 {ok:true} — never non-200
  even when the incoming body is empty, malformed, or triggers a downstream
  Telegram API failure (we don't want Telegram to spam-retry).
- GET  /api/telegram/download/extension serves the zip as application/zip
  when present (>100KB, first 4 bytes 'PK\\x03\\x04'), or 404 if missing.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest
import requests

BASE_URL = "http://localhost:8001"


# ---------- webhook fault-tolerance ----------

class TestTelegramWebhook:
    """Webhook must NEVER return non-200 for any input Telegram might send."""

    def test_empty_body_returns_200_ok(self):
        r = requests.post(f"{BASE_URL}/api/telegram/webhook", data="", timeout=10)
        assert r.status_code == 200
        assert r.json() == {"ok": True}

    def test_empty_json_object_returns_200_ok(self):
        r = requests.post(f"{BASE_URL}/api/telegram/webhook", json={}, timeout=10)
        assert r.status_code == 200
        assert r.json() == {"ok": True}

    def test_malformed_json_returns_200_ok(self):
        # Non-JSON body — endpoint should catch the parse error and return {ok:true}
        r = requests.post(
            f"{BASE_URL}/api/telegram/webhook",
            data="not-json-at-all",
            headers={"Content-Type": "application/json"},
            timeout=10,
        )
        assert r.status_code == 200
        assert r.json() == {"ok": True}

    def _telegram_update(self, text: str, chat_id: int = 555000111) -> dict:
        return {
            "update_id": 42,
            "message": {
                "message_id": 1,
                "date": 0,
                "text": text,
                "chat": {"id": chat_id, "type": "private"},
                "from": {"id": chat_id, "username": "pytest_user", "is_bot": False, "first_name": "PyTest"},
            },
        }

    def test_start_command_returns_200(self):
        # Downstream sendMessage will likely fail (fake chat_id) — but webhook
        # must still return {ok:true}.
        r = requests.post(
            f"{BASE_URL}/api/telegram/webhook",
            json=self._telegram_update("/start"),
            timeout=20,
        )
        assert r.status_code == 200
        assert r.json() == {"ok": True}

    def test_help_command_returns_200(self):
        r = requests.post(
            f"{BASE_URL}/api/telegram/webhook",
            json=self._telegram_update("/help"),
            timeout=20,
        )
        assert r.status_code == 200
        assert r.json() == {"ok": True}

    def test_get_command_returns_200(self):
        # /get triggers sendDocument (will fail against fake chat) — must still return 200
        r = requests.post(
            f"{BASE_URL}/api/telegram/webhook",
            json=self._telegram_update("/get"),
            timeout=30,
        )
        assert r.status_code == 200
        assert r.json() == {"ok": True}

    def test_unknown_command_returns_200(self):
        r = requests.post(
            f"{BASE_URL}/api/telegram/webhook",
            json=self._telegram_update("/foobar"),
            timeout=10,
        )
        assert r.status_code == 200
        assert r.json() == {"ok": True}

    def test_command_with_bot_suffix_returns_200(self):
        # In groups Telegram appends @BotName — the handler must strip it.
        r = requests.post(
            f"{BASE_URL}/api/telegram/webhook",
            json=self._telegram_update("/get@SemexBot"),
            timeout=30,
        )
        assert r.status_code == 200
        assert r.json() == {"ok": True}

    def test_edited_message_returns_200(self):
        payload = {
            "update_id": 43,
            "edited_message": {
                "message_id": 2,
                "date": 0,
                "text": "/help",
                "chat": {"id": 555000112, "type": "private"},
                "from": {"id": 555000112, "username": "pytest2", "is_bot": False},
            },
        }
        r = requests.post(f"{BASE_URL}/api/telegram/webhook", json=payload, timeout=10)
        assert r.status_code == 200
        assert r.json() == {"ok": True}

    def test_no_chat_id_returns_200(self):
        # Malformed update with no chat context — must silently ack.
        payload = {"update_id": 44, "message": {"text": "/start"}}
        r = requests.post(f"{BASE_URL}/api/telegram/webhook", json=payload, timeout=10)
        assert r.status_code == 200
        assert r.json() == {"ok": True}


# ---------- extension download ----------

class TestExtensionDownload:
    """GET /api/telegram/download/extension serves the .zip publicly."""

    def test_download_returns_zip_or_404(self):
        r = requests.get(f"{BASE_URL}/api/telegram/download/extension", timeout=30)
        # Either the zip exists (200 + zip content) or it's missing (404).
        assert r.status_code in (200, 404), f"unexpected status {r.status_code}"

        if r.status_code == 404:
            pytest.skip("Extension zip not present on disk; endpoint correctly returned 404.")

        # 200 branch: content-type must be application/zip
        ctype = r.headers.get("content-type", "")
        assert "application/zip" in ctype or "zip" in ctype, f"unexpected content-type: {ctype}"

        # Size must be > 100KB (real extension is ~1MB)
        assert len(r.content) > 100_000, f"zip too small: {len(r.content)} bytes"

        # First 4 bytes must be the ZIP magic PK\x03\x04
        assert r.content[:4] == b"PK\x03\x04", f"not a zip: first 4 bytes = {r.content[:4]!r}"

    def test_download_is_public_no_auth_required(self):
        # No Authorization header — must not 401/403
        r = requests.get(f"{BASE_URL}/api/telegram/download/extension", timeout=30)
        assert r.status_code not in (401, 403), \
            f"download endpoint should be public, got {r.status_code}"


# ---------- static file structure ----------

class TestTelegramRouterFiles:
    """Static grep-style checks for the router source file itself."""

    @staticmethod
    def _backend_dir() -> Path:
        # Repo layout portable across hosts (was hardcoded to Railway's /app).
        return Path(__file__).resolve().parents[1]

    def test_router_file_exists(self):
        p = self._backend_dir() / "routes" / "telegram_bot.py"
        assert p.exists(), "telegram_bot.py missing"

    def test_router_file_defines_required_symbols(self):
        src = (self._backend_dir() / "routes" / "telegram_bot.py").read_text()
        assert "async def _cmd_get(" in src, "_cmd_get function missing"
        assert "async def telegram_webhook(" in src, "telegram_webhook function missing"
        assert "_find_extension_zip" in src, "_find_extension_zip helper missing"

    def test_server_registers_router(self):
        src = (self._backend_dir() / "server.py").read_text()
        assert "telegram_bot_router" in src, "server.py does not import telegram_bot_router"
        assert "app.include_router(telegram_bot_router)" in src, \
            "server.py does not include telegram_bot_router"
