"""Unit tests: lifespan bot-username resolution is non-blocking.

Verifies that a Telegram API outage (timeout or network error) during
startup does NOT delay application readiness.  The lifespan async context
manager must yield (hand control back to the caller) in well under one
second even when get_bot_info() would normally take 20–60 seconds.
"""
from __future__ import annotations

import asyncio
import time
from unittest.mock import AsyncMock, patch

import pytest

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _run_lifespan_startup(get_bot_info_mock) -> float:
    """Run only the startup half of the lifespan context manager and return
    how many seconds elapsed before it yielded."""
    import importlib
    import server as srv

    start = time.monotonic()
    async with srv.lifespan.__wrapped__(srv.app):  # type: ignore[attr-defined]
        elapsed = time.monotonic() - start
    return elapsed


# ---------------------------------------------------------------------------
# 1. Telegram timeout does not delay startup
# ---------------------------------------------------------------------------

class TestStartupNonBlocking:
    """The lifespan must yield immediately regardless of Telegram reachability."""

    @pytest.mark.asyncio
    async def test_yields_quickly_on_telegram_timeout(self):
        """When get_bot_info() times out the lifespan must still yield in < 1 s."""
        import server as srv

        async def _slow_get_bot_info():
            await asyncio.sleep(60)  # simulates a completely unresponsive Telegram
            return None  # pragma: no cover

        with (
            patch("server.get_bot_info", side_effect=_slow_get_bot_info),
            patch("server.init_indexes", new_callable=AsyncMock),
            patch("server.start_expiry_task"),
            patch("server.start_outbox_task"),
            patch("server.stop_expiry_task"),
            patch("server.stop_outbox_task"),
        ):
            start = time.monotonic()
            async with srv.lifespan(srv.app):
                elapsed = time.monotonic() - start
            # Give any background tasks a moment to settle.
            await asyncio.sleep(0.1)

        assert elapsed < 1.0, (
            f"Startup took {elapsed:.2f}s — Telegram timeout must not block the lifespan yield"
        )

    @pytest.mark.asyncio
    async def test_yields_quickly_on_telegram_network_error(self):
        """When get_bot_info() raises a network exception startup must not block."""
        import server as srv

        async def _failing_get_bot_info():
            raise ConnectionError("Telegram DNS resolution failed")

        with (
            patch("server.get_bot_info", side_effect=_failing_get_bot_info),
            patch("server.init_indexes", new_callable=AsyncMock),
            patch("server.start_expiry_task"),
            patch("server.start_outbox_task"),
            patch("server.stop_expiry_task"),
            patch("server.stop_outbox_task"),
        ):
            start = time.monotonic()
            async with srv.lifespan(srv.app):
                elapsed = time.monotonic() - start
            await asyncio.sleep(0.1)

        assert elapsed < 1.0, (
            f"Startup took {elapsed:.2f}s — network error must not block the lifespan yield"
        )

    @pytest.mark.asyncio
    async def test_configured_username_retained_on_timeout(self):
        """When Telegram is unreachable, the env-configured username is preserved."""
        import server as srv
        from config import settings

        original = settings.TELEGRAM_BOT_USERNAME
        settings.TELEGRAM_BOT_USERNAME = "configured_bot"

        async def _slow_get_bot_info():
            await asyncio.sleep(60)
            return None  # pragma: no cover

        try:
            with (
                patch("server.get_bot_info", side_effect=_slow_get_bot_info),
                patch("server.init_indexes", new_callable=AsyncMock),
                patch("server.start_expiry_task"),
                patch("server.start_outbox_task"),
                patch("server.stop_expiry_task"),
                patch("server.stop_outbox_task"),
            ):
                async with srv.lifespan(srv.app):
                    pass
                # Let the background task run its 3-second wait_for guard.
                await asyncio.sleep(0.1)

            # Username must still be the configured value (not blanked).
            assert settings.TELEGRAM_BOT_USERNAME == "configured_bot"
        finally:
            settings.TELEGRAM_BOT_USERNAME = original

    @pytest.mark.asyncio
    async def test_username_updated_when_telegram_responds_fast(self):
        """When Telegram responds quickly, username is updated in the background."""
        import server as srv
        from config import settings

        original = settings.TELEGRAM_BOT_USERNAME
        settings.TELEGRAM_BOT_USERNAME = "old_bot"

        async def _fast_get_bot_info():
            return {"username": "new_bot", "id": 1}

        try:
            with (
                patch("server.get_bot_info", side_effect=_fast_get_bot_info),
                patch("server.init_indexes", new_callable=AsyncMock),
                patch("server.start_expiry_task"),
                patch("server.start_outbox_task"),
                patch("server.stop_expiry_task"),
                patch("server.stop_outbox_task"),
            ):
                async with srv.lifespan(srv.app):
                    pass
                # Allow the background task time to apply the update.
                await asyncio.sleep(0.2)

            assert settings.TELEGRAM_BOT_USERNAME == "new_bot"
        finally:
            settings.TELEGRAM_BOT_USERNAME = original
