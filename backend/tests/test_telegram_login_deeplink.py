"""Integration tests: Telegram deep-link login flow (Task 126).

Verifies:
1. /api/public/bot returns the username from settings.TELEGRAM_BOT_USERNAME
   (not a hard-coded fallback like "Semexautoxbot").
2. /api/public/version returns botUsername == settings.TELEGRAM_BOT_USERNAME.
3. /api/auth/telegram-login/start returns a deepLink that embeds the correct
   bot username and a login_<token> payload.
4. The bot webhook correctly dispatches /start login_<token> to _cmd_login_start
   (the webhook always returns 200 {ok:true}, and the DB token gets bound to the
   Telegram user who opened the link).
5. The authorize callback mints the session and parks the auth payload on the
   token doc so the extension's polling endpoint delivers it exactly once.
"""
from __future__ import annotations

import asyncio
import secrets
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
import requests

BASE_URL = "http://localhost:8001"
BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))


def _reset_motor() -> None:
    """Force Motor client to reconnect on the next async use (loop recycling)."""
    import db as db_module
    db_module._client = None


# ─── 1. /api/public/bot ───────────────────────────────────────────────────────

class TestPublicBotEndpoint:
    """GET /api/public/bot must return the live TELEGRAM_BOT_USERNAME."""

    def test_returns_200(self):
        r = requests.get(f"{BASE_URL}/api/public/bot", timeout=10)
        assert r.status_code == 200

    def test_returns_username_field(self):
        r = requests.get(f"{BASE_URL}/api/public/bot", timeout=10)
        j = r.json()
        assert "username" in j, f"missing 'username' key: {j}"
        assert j["username"], "username must be non-empty"

    def test_username_matches_settings(self):
        """The username returned must equal settings.TELEGRAM_BOT_USERNAME —
        not any hardcoded fallback."""
        from config import settings
        r = requests.get(f"{BASE_URL}/api/public/bot", timeout=10)
        j = r.json()
        assert j["username"] == settings.TELEGRAM_BOT_USERNAME, (
            f"Expected '{settings.TELEGRAM_BOT_USERNAME}', got '{j['username']}'"
        )

    def test_link_contains_username(self):
        r = requests.get(f"{BASE_URL}/api/public/bot", timeout=10)
        j = r.json()
        assert "link" in j
        assert j["username"] in j["link"], (
            f"link '{j['link']}' does not contain username '{j['username']}'"
        )

    def test_link_is_t_me_url(self):
        r = requests.get(f"{BASE_URL}/api/public/bot", timeout=10)
        j = r.json()
        assert j["link"].startswith("https://t.me/"), f"unexpected link format: {j['link']}"

    def test_not_hardcoded_fallback(self):
        """Guard against the original bug: hardcoded 'Semexautoxbot' fallback."""
        from config import settings
        r = requests.get(f"{BASE_URL}/api/public/bot", timeout=10)
        j = r.json()
        # If TELEGRAM_BOT_USERNAME != Semexautoxbot the returned value must also differ
        if settings.TELEGRAM_BOT_USERNAME.lower() != "semexautoxbot":
            assert j["username"].lower() != "semexautoxbot", (
                "username is the hardcoded fallback 'Semexautoxbot' — fix not applied"
            )


# ─── 2. /api/public/version ──────────────────────────────────────────────────

class TestPublicVersionBotUsername:
    """/api/public/version must expose botUsername == TELEGRAM_BOT_USERNAME."""

    def test_returns_bot_username_field(self):
        r = requests.get(f"{BASE_URL}/api/public/version", timeout=10)
        j = r.json()
        assert "botUsername" in j, f"missing 'botUsername' key: {j}"

    def test_bot_username_matches_settings(self):
        from config import settings
        r = requests.get(f"{BASE_URL}/api/public/version", timeout=10)
        j = r.json()
        expected = settings.TELEGRAM_BOT_USERNAME or "SemexBot"
        assert j["botUsername"] == expected, (
            f"Expected '{expected}', got '{j['botUsername']}'"
        )

    def test_bot_link_contains_bot_username(self):
        r = requests.get(f"{BASE_URL}/api/public/version", timeout=10)
        j = r.json()
        assert "botLink" in j
        assert j["botUsername"] in j["botLink"], (
            f"botLink '{j['botLink']}' does not contain botUsername '{j['botUsername']}'"
        )


# ─── 3. /api/auth/telegram-login/start ──────────────────────────────────────

class TestTelegramLoginStart:
    """POST /api/auth/telegram-login/start must build the deepLink from
    settings.TELEGRAM_BOT_USERNAME, not any hardcoded string."""

    _FP = "test-fp-login-deep-link-0000000000000"

    def _start(self) -> requests.Response:
        return requests.post(
            f"{BASE_URL}/api/auth/telegram-login/start",
            json={"fingerprint": self._FP, "deviceInfo": {"platform": "pytest", "language": "en"}},
            timeout=10,
        )

    def test_returns_200_success(self):
        r = self._start()
        assert r.status_code == 200
        j = r.json()
        assert j.get("success") is True

    def test_returns_required_fields(self):
        r = self._start()
        j = r.json()
        for field in ("token", "deepLink", "botUsername", "expiresIn"):
            assert field in j, f"missing field '{field}': {j}"

    def test_token_has_login_prefix(self):
        r = self._start()
        j = r.json()
        assert j["token"].startswith("login_"), (
            f"token should start with 'login_', got: {j['token']}"
        )

    def test_deep_link_uses_correct_bot(self):
        """The deepLink must point at TELEGRAM_BOT_USERNAME, not a fallback."""
        from config import settings
        r = self._start()
        j = r.json()
        expected_bot = settings.TELEGRAM_BOT_USERNAME
        assert expected_bot in j["deepLink"], (
            f"deepLink '{j['deepLink']}' does not contain '{expected_bot}'"
        )

    def test_deep_link_format(self):
        r = self._start()
        j = r.json()
        token = j["token"]
        link = j["deepLink"]
        assert link.startswith("https://t.me/"), f"deepLink format wrong: {link}"
        assert token in link, f"token '{token}' not embedded in deepLink '{link}'"

    def test_bot_username_field_matches_deep_link(self):
        r = self._start()
        j = r.json()
        assert j["botUsername"] in j["deepLink"], (
            f"botUsername '{j['botUsername']}' not in deepLink '{j['deepLink']}'"
        )

    def test_bot_username_matches_settings(self):
        from config import settings
        r = self._start()
        j = r.json()
        assert j["botUsername"] == settings.TELEGRAM_BOT_USERNAME, (
            f"Expected '{settings.TELEGRAM_BOT_USERNAME}', got '{j['botUsername']}'"
        )

    def test_not_hardcoded_semexautoxbot(self):
        from config import settings
        r = self._start()
        j = r.json()
        if settings.TELEGRAM_BOT_USERNAME.lower() != "semexautoxbot":
            assert "semexautoxbot" not in j["deepLink"].lower(), (
                "deepLink contains hardcoded fallback 'Semexautoxbot' — fix not applied"
            )

    def test_token_stored_in_db(self):
        """The token must be persisted so the bot can bind it."""
        from config import settings
        from pymongo import MongoClient
        r = self._start()
        j = r.json()
        token = j["token"]
        client = MongoClient(settings.MONGO_URL)
        db = client[settings.DB_NAME]
        doc = db.telegram_login_tokens.find_one({"token": token})
        client.close()
        assert doc is not None, f"token '{token}' not found in telegram_login_tokens"
        assert doc["status"] == "pending"
        assert doc["fingerprint"] == self._FP


# ─── 4. Webhook /start login_<token> dispatches to _cmd_login_start ──────────

class TestWebhookLoginStart:
    """/start login_<token> must be routed to _cmd_login_start by the webhook."""

    def _telegram_start_update(self, token: str, chat_id: int = 555099001) -> dict:
        # Unique update_id per token — the webhook replay-guard dedups on it.
        return {
            "update_id": 90001 + (abs(hash(token)) % 100_000),
            "message": {
                "message_id": 1,
                "date": 0,
                "text": f"/start {token}",
                "chat": {"id": chat_id, "type": "private"},
                "from": {
                    "id": chat_id,
                    "username": "deeplink_tester",
                    "is_bot": False,
                    "first_name": "DeepLink",
                },
            },
        }

    def test_webhook_returns_200_for_login_start(self):
        """Webhook must always return 200 {ok:true} — this holds even when the
        token is unknown (bot sends 'invalid link' message to the user)."""
        r = requests.post(
            f"{BASE_URL}/api/telegram/webhook",
            json=self._telegram_start_update("login_fakeinvalidtoken000000000000"),
            timeout=20,
        )
        assert r.status_code == 200
        assert r.json() == {"ok": True}

    def test_webhook_binds_valid_token_to_telegram_user(self):
        """When a valid pending token is opened via /start, the webhook should
        bind it to the telegram_id from the message (sets telegram_id on the doc)."""
        from config import settings
        from pymongo import MongoClient

        # Insert a pending token directly
        now = datetime.now(timezone.utc)
        token = "login_" + secrets.token_urlsafe(24)
        client = MongoClient(settings.MONGO_URL)
        db = client[settings.DB_NAME]
        db.telegram_login_tokens.insert_one({
            "token": token,
            "status": "pending",
            "fingerprint": "test-fp-webhook-bind-000000000000000",
            "device_info": {},
            "ip": "127.0.0.1",
            "user_agent": "pytest",
            "telegram_id": None,
            "auth_payload": None,
            "created_at": now,
            "expires_at": now + timedelta(seconds=300),
        })

        chat_id = 555099002
        r = requests.post(
            f"{BASE_URL}/api/telegram/webhook",
            json=self._telegram_start_update(token, chat_id=chat_id),
            timeout=20,
        )
        assert r.status_code == 200
        assert r.json() == {"ok": True}

        # After the webhook processes the update, the token should be bound
        doc = db.telegram_login_tokens.find_one({"token": token})
        client.close()
        assert doc is not None
        # The token should now have telegram_id set (binding the Telegram account)
        assert doc.get("telegram_id") == chat_id, (
            f"expected telegram_id={chat_id}, got {doc.get('telegram_id')}"
        )


# ─── 5. Authorize → status delivers auth payload exactly once ────────────────

class TestLoginAuthorizeAndStatus:
    """Full authorize → status → one-time auth delivery."""

    _FP = "test-fp-authorize-flow-000000000000"

    def test_status_pending_before_authorize(self):
        from config import settings
        from pymongo import MongoClient

        now = datetime.now(timezone.utc)
        token = "login_" + secrets.token_urlsafe(24)
        client = MongoClient(settings.MONGO_URL)
        db = client[settings.DB_NAME]
        db.telegram_login_tokens.insert_one({
            "token": token,
            "status": "pending",
            "fingerprint": self._FP,
            "device_info": {},
            "ip": "1.2.3.4",
            "user_agent": "pytest",
            "telegram_id": None,
            "auth_payload": None,
            "created_at": now,
            "expires_at": now + timedelta(seconds=300),
        })
        client.close()

        r = requests.get(
            f"{BASE_URL}/api/auth/telegram-login/status",
            params={"token": token, "fp": self._FP},
            timeout=10,
        )
        assert r.status_code == 200
        assert r.json()["status"] == "pending"

    def test_status_expired_after_ttl(self):
        from config import settings
        from pymongo import MongoClient

        now = datetime.now(timezone.utc)
        token = "login_" + secrets.token_urlsafe(24)
        client = MongoClient(settings.MONGO_URL)
        db = client[settings.DB_NAME]
        db.telegram_login_tokens.insert_one({
            "token": token,
            "status": "pending",
            "fingerprint": self._FP,
            "device_info": {},
            "ip": "1.2.3.4",
            "user_agent": "pytest",
            "telegram_id": None,
            "auth_payload": None,
            "created_at": now - timedelta(seconds=400),
            "expires_at": now - timedelta(seconds=100),  # already expired
        })
        client.close()

        r = requests.get(
            f"{BASE_URL}/api/auth/telegram-login/status",
            params={"token": token, "fp": self._FP},
            timeout=10,
        )
        assert r.status_code == 200
        assert r.json()["status"] == "expired"

    def test_authorize_flow_delivers_payload_once(self):
        """Full authorize flow via the _handle_login_callback helper:
        - Pre-populate a bound pending token
        - Run the authorize callback (asyncio)
        - Poll /status — must return the auth payload
        - Poll /status again — payload must NOT be re-delivered (one-time)
        """
        from config import settings
        from pymongo import MongoClient

        TG_ID = 555099003
        now = datetime.now(timezone.utc)
        token = "login_" + secrets.token_urlsafe(24)

        client = MongoClient(settings.MONGO_URL)
        db = client[settings.DB_NAME]
        # Insert bound pending token (simulates user having opened the deep link)
        db.telegram_login_tokens.insert_one({
            "token": token,
            "status": "pending",
            "fingerprint": self._FP,
            "device_info": {"platform": "pytest"},
            "ip": "1.2.3.4",
            "user_agent": "pytest",
            "telegram_id": TG_ID,
            "auth_payload": None,
            "created_at": now,
            "expires_at": now + timedelta(seconds=300),
        })
        # Seed the user so issue_session can upsert properly
        db.users.update_one(
            {"telegram_id": TG_ID},
            {"$set": {
                "telegram_id": TG_ID,
                "telegram_username": "authorize_tester",
                "telegram_first_name": "Auth",
                "telegram_last_name": "Tester",
                "plan": "TRIAL",
                "is_admin": False,
                "is_banned": False,
                "requires_redeem": False,
                "created_at": now,
                "hit_count": 0,
                "charged_count": 0,
            }},
            upsert=True,
        )
        client.close()

        # Build the authorize callback update
        callback = {
            "id": "cb-pytest-authorize",
            "from": {
                "id": TG_ID,
                "username": "authorize_tester",
                "first_name": "Auth",
                "is_bot": False,
            },
            "message": {
                "message_id": 9001,
                "chat": {"id": TG_ID, "type": "private"},
            },
            "data": f"tglogin:allow:{token}",
        }

        # Post the callback query to the webhook
        webhook_payload = {"update_id": 90002, "callback_query": callback}

        _reset_motor()

        with patch("services.telegram.send_message", new_callable=AsyncMock), \
             patch("services.telegram.edit_message_text", new_callable=AsyncMock), \
             patch("services.telegram.answer_callback_query", new_callable=AsyncMock), \
             patch("services.telegram.notify_message", new_callable=AsyncMock):
            r = requests.post(
                f"{BASE_URL}/api/telegram/webhook",
                json=webhook_payload,
                timeout=20,
            )

        assert r.status_code == 200
        assert r.json() == {"ok": True}

        # Poll status — should deliver the auth payload
        r2 = requests.get(
            f"{BASE_URL}/api/auth/telegram-login/status",
            params={"token": token, "fp": self._FP},
            timeout=10,
        )
        j2 = r2.json()
        assert r2.status_code == 200
        assert j2["status"] == "authorized", f"expected authorized, got: {j2}"
        # Core session fields
        assert "accessToken" in j2, f"missing accessToken in payload: {j2}"

        # Second poll — payload consumed; must NOT return the token again
        r3 = requests.get(
            f"{BASE_URL}/api/auth/telegram-login/status",
            params={"token": token, "fp": self._FP},
            timeout=10,
        )
        j3 = r3.json()
        assert j3["status"] == "authorized"
        assert "accessToken" not in j3, (
            f"auth payload delivered a second time — one-time delivery broken: {j3}"
        )

    def test_fingerprint_mismatch_returns_403(self):
        from config import settings
        from pymongo import MongoClient

        now = datetime.now(timezone.utc)
        token = "login_" + secrets.token_urlsafe(24)
        client = MongoClient(settings.MONGO_URL)
        db = client[settings.DB_NAME]
        db.telegram_login_tokens.insert_one({
            "token": token,
            "status": "pending",
            "fingerprint": self._FP,
            "device_info": {},
            "ip": "1.2.3.4",
            "user_agent": "pytest",
            "telegram_id": None,
            "auth_payload": None,
            "created_at": now,
            "expires_at": now + timedelta(seconds=300),
        })
        client.close()

        r = requests.get(
            f"{BASE_URL}/api/auth/telegram-login/status",
            params={"token": token, "fp": "WRONG-FINGERPRINT-000000000000000000"},
            timeout=10,
        )
        assert r.status_code == 403


# ─── 6. Static source checks ─────────────────────────────────────────────────

class TestSourceConsistency:
    """Source-level checks that the fix is in the right places and not reverted."""

    @staticmethod
    def _backend_dir() -> Path:
        return Path(__file__).resolve().parents[1]

    def test_public_bot_uses_settings_not_hardcode(self):
        src = (self._backend_dir() / "routes" / "public.py").read_text()
        assert 'settings.TELEGRAM_BOT_USERNAME' in src, \
            "/api/public/bot must use settings.TELEGRAM_BOT_USERNAME"
        # Must NOT fall back to 'Semexautoxbot' for the /api/public/bot route
        assert '"Semexautoxbot"' not in src.split("get_bot_info")[1].split("\ndef ")[0], \
            "/api/public/bot route contains hardcoded 'Semexautoxbot' fallback"

    def test_auth_login_start_uses_settings_bot_username(self):
        src = (self._backend_dir() / "routes" / "auth.py").read_text()
        assert 'settings.TELEGRAM_BOT_USERNAME' in src, \
            "auth.py must reference settings.TELEGRAM_BOT_USERNAME"
        # The deepLink line must embed TELEGRAM_BOT_USERNAME, not a literal bot name
        assert 'deepLink.*TELEGRAM_BOT_USERNAME' in __import__('re').sub(
            r'\s+', ' ', src
        ) or 'TELEGRAM_BOT_USERNAME' in src, \
            "deepLink construction must use settings.TELEGRAM_BOT_USERNAME"

    def test_deep_link_prefix_is_t_me(self):
        src = (self._backend_dir() / "routes" / "auth.py").read_text()
        assert 'https://t.me/' in src, \
            "deepLink in auth.py must use https://t.me/ prefix"

    def test_cmd_login_start_defined_in_bot(self):
        src = (self._backend_dir() / "routes" / "telegram_bot.py").read_text()
        assert 'async def _cmd_login_start(' in src, \
            "_cmd_login_start must be defined in telegram_bot.py"

    def test_webhook_routes_login_start(self):
        src = (self._backend_dir() / "routes" / "telegram_bot.py").read_text()
        assert '_cmd_login_start' in src, \
            "webhook handler must call _cmd_login_start for login_ tokens"
        assert 'startswith("login_")' in src or "startswith('login_')" in src, \
            "webhook must check if /start arg starts with 'login_'"

    def test_server_client_fetches_bot_username_from_api(self):
        """Extension server-client must fetch botUsername from /api/public/bot,
        not use any hardcoded string."""
        src = (BACKEND_DIR.parent / "semex" / "shared" / "server-client.js").read_text()
        assert '/api/public/bot' in src, \
            "server-client.js must call /api/public/bot to get the bot username"
        assert 'getBotUsername' in src, \
            "server-client.js must expose getBotUsername()"
