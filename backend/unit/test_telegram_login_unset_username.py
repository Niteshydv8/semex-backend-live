"""Unit tests: /api/auth/telegram-login/start must return 503 when
TELEGRAM_BOT_USERNAME is blank or absent from the environment.

The conftest.py in this directory does NOT set TELEGRAM_BOT_USERNAME so
config.py loads with the default value of "" — exactly replicating the
"variable unset" production failure mode described in task #129.

All tests run without a live server or real MongoDB connection.
"""
from __future__ import annotations

import importlib
import os
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_test_client() -> TestClient:
    """Build a minimal FastAPI app with only the auth router so we can hit the
    real route handler without starting a full server or touching MongoDB."""
    import config
    from routes.auth import router as auth_router

    app = FastAPI()
    app.include_router(auth_router)
    return TestClient(app, raise_server_exceptions=False)


# ---------------------------------------------------------------------------
# 1. Config-level: absent env var defaults to ""
# ---------------------------------------------------------------------------

class TestConfigDefault:
    """TELEGRAM_BOT_USERNAME must default to "" when the env var is absent."""

    def test_setting_is_empty_string_when_env_var_absent(self):
        """With TELEGRAM_BOT_USERNAME removed from the environment (done by
        conftest.py), the setting must be "" — not a RuntimeError crash."""
        assert "TELEGRAM_BOT_USERNAME" not in os.environ, (
            "conftest.py should have removed TELEGRAM_BOT_USERNAME from env"
        )
        import config
        assert config.settings.TELEGRAM_BOT_USERNAME == "", (
            f"Expected '' when env var is absent, got {config.settings.TELEGRAM_BOT_USERNAME!r}"
        )

    def test_server_starts_without_bot_username(self):
        """Importing config must succeed (no RuntimeError) even without the
        TELEGRAM_BOT_USERNAME env var."""
        import config  # should not raise
        assert hasattr(config.settings, "TELEGRAM_BOT_USERNAME")


# ---------------------------------------------------------------------------
# 2. Route-level: endpoint returns 503 when username is "" (absent)
# ---------------------------------------------------------------------------

class TestTelegramLoginStart503:
    """The /api/auth/telegram-login/start route must return HTTP 503 with a
    clear error when TELEGRAM_BOT_USERNAME is blank, and must NOT touch the
    DB or the rate-limiter before doing so."""

    def _post_start(self, client: TestClient) -> "requests.Response":
        return client.post(
            "/api/auth/telegram-login/start",
            json={"fingerprint": "test-fp-unit-0000000000000000"},
        )

    def test_returns_503_when_username_blank(self):
        """With settings.TELEGRAM_BOT_USERNAME == "", the route must 503."""
        import config
        original = config.settings.TELEGRAM_BOT_USERNAME
        config.settings.TELEGRAM_BOT_USERNAME = ""  # already "" from conftest, explicit for clarity
        try:
            with patch("routes.auth.rate_limit", new_callable=AsyncMock) as mock_rl, \
                 patch("routes.auth.get_db") as mock_db:
                client = _make_test_client()
                r = self._post_start(client)
        finally:
            config.settings.TELEGRAM_BOT_USERNAME = original

        assert r.status_code == 503, (
            f"Expected 503, got {r.status_code}. Body: {r.text}"
        )

    def test_503_detail_names_missing_setting(self):
        """The 503 body must mention TELEGRAM_BOT_USERNAME so an admin knows
        what to fix."""
        import config
        original = config.settings.TELEGRAM_BOT_USERNAME
        config.settings.TELEGRAM_BOT_USERNAME = ""
        try:
            with patch("routes.auth.rate_limit", new_callable=AsyncMock), \
                 patch("routes.auth.get_db"):
                client = _make_test_client()
                r = self._post_start(client)
        finally:
            config.settings.TELEGRAM_BOT_USERNAME = original

        body = r.text
        assert "TELEGRAM_BOT_USERNAME" in body, (
            f"503 detail must name TELEGRAM_BOT_USERNAME, got: {body!r}"
        )

    def test_no_db_access_before_503(self):
        """The guard must fire before get_db() is called — no DB write on the
        broken-config path."""
        import config
        original = config.settings.TELEGRAM_BOT_USERNAME
        config.settings.TELEGRAM_BOT_USERNAME = ""
        try:
            with patch("routes.auth.rate_limit", new_callable=AsyncMock), \
                 patch("routes.auth.get_db", side_effect=AssertionError(
                     "get_db must not be called when TELEGRAM_BOT_USERNAME is blank"
                 )) as mock_db:
                client = _make_test_client()
                r = self._post_start(client)
                # If get_db was called, TestClient would propagate the
                # AssertionError as a 500. We expect 503.
                assert r.status_code == 503, (
                    f"Expected 503 (guard before DB), got {r.status_code}. "
                    f"Body: {r.text}"
                )
            mock_db.assert_not_called()
        finally:
            config.settings.TELEGRAM_BOT_USERNAME = original

    def test_no_rate_limit_call_before_503(self):
        """The guard must also fire before rate_limit() — no counter incremented
        on the broken-config path."""
        import config
        original = config.settings.TELEGRAM_BOT_USERNAME
        config.settings.TELEGRAM_BOT_USERNAME = ""
        try:
            with patch("routes.auth.rate_limit", new_callable=AsyncMock) as mock_rl, \
                 patch("routes.auth.get_db"):
                client = _make_test_client()
                r = self._post_start(client)
                assert r.status_code == 503
            mock_rl.assert_not_called()
        finally:
            config.settings.TELEGRAM_BOT_USERNAME = original

    def test_valid_username_does_not_503(self):
        """Sanity: when TELEGRAM_BOT_USERNAME is non-empty the guard must NOT
        fire (the request proceeds past it, here hitting rate_limit normally)."""
        import config
        original = config.settings.TELEGRAM_BOT_USERNAME
        config.settings.TELEGRAM_BOT_USERNAME = "TestBot"
        try:
            # rate_limit passes; DB insert_one returns a mock; no 503
            mock_insert = AsyncMock(return_value=MagicMock(inserted_id="abc"))
            mock_delete = AsyncMock()
            mock_collection = MagicMock()
            mock_collection.insert_one = mock_insert
            mock_collection.delete_many = mock_delete
            mock_db_obj = MagicMock()
            mock_db_obj.telegram_login_tokens = mock_collection

            with patch("routes.auth.rate_limit", new_callable=AsyncMock), \
                 patch("routes.auth.get_db", return_value=mock_db_obj):
                client = _make_test_client()
                r = self._post_start(client)
        finally:
            config.settings.TELEGRAM_BOT_USERNAME = original

        assert r.status_code != 503, (
            f"Non-empty username must not trigger the 503 guard; got {r.status_code}"
        )


# ---------------------------------------------------------------------------
# 3. Source guard — regression fence
# ---------------------------------------------------------------------------

class TestSourceGuard:
    """The 503 check must be present in auth.py and must fire BEFORE rate_limit
    and get_db() (i.e. it must be the very first statement in the handler)."""

    def test_guard_present_in_source(self):
        src = (BACKEND_DIR / "routes" / "auth.py").read_text()
        assert "not settings.TELEGRAM_BOT_USERNAME" in src, (
            "routes/auth.py must contain 'if not settings.TELEGRAM_BOT_USERNAME' guard"
        )
        assert "503" in src, (
            "routes/auth.py must raise HTTPException(503, ...) when username is blank"
        )

    def test_guard_precedes_rate_limit_in_source(self):
        """The username check must appear before the rate_limit call in the
        telegram_login_start function body."""
        src = (BACKEND_DIR / "routes" / "auth.py").read_text()
        # Find the function
        start = src.find("async def telegram_login_start(")
        assert start != -1, "telegram_login_start not found in auth.py"
        fn_body = src[start:]
        guard_pos = fn_body.find("not settings.TELEGRAM_BOT_USERNAME")
        rate_limit_pos = fn_body.find("rate_limit(")
        assert guard_pos != -1, "Username guard not found in telegram_login_start"
        assert rate_limit_pos != -1, "rate_limit call not found in telegram_login_start"
        assert guard_pos < rate_limit_pos, (
            "Username guard must appear BEFORE rate_limit() call in telegram_login_start"
        )

    def test_config_uses_empty_default(self):
        """config.py must supply a default of '' for TELEGRAM_BOT_USERNAME so
        the server starts when the var is absent."""
        src = (BACKEND_DIR / "config.py").read_text()
        # The _env call for this key must include a second "" argument
        assert '_env("TELEGRAM_BOT_USERNAME", "")' in src, (
            'config.py must use _env("TELEGRAM_BOT_USERNAME", "") so startup '
            "does not crash when the env var is absent"
        )
