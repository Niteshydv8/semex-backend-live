"""Tests for services.telegram._post retry behavior.

Regression guard for the silent-drop bug: a hit was saved to the DB + dashboard
but never reached Telegram because _post did not retry 429 throttling or
transient network errors. We fake httpx.AsyncClient (and no-op asyncio.sleep) so
no real network call or delay happens, then assert _post retries and delivers.
"""
from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from services import telegram as tg  # noqa: E402


def _run(coro):
    return asyncio.new_event_loop().run_until_complete(coro)


class _FakeResp:
    def __init__(self, status_code: int, payload: dict):
        self.status_code = status_code
        self._payload = payload
        self.text = json.dumps(payload)

    def json(self):
        return self._payload


def _install(monkeypatch, post_impl):
    """Patch httpx.AsyncClient with a fake whose .post runs post_impl, and make
    asyncio.sleep a no-op so retries don't actually wait."""
    class _FakeClient:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def post(self, url, json=None, data=None, files=None):
            return await post_impl(url, json=json, data=data, files=files)

    async def _fake_sleep(_s):
        return None

    monkeypatch.setattr(tg.httpx, "AsyncClient", _FakeClient)
    monkeypatch.setattr(tg.asyncio, "sleep", _fake_sleep)


def test_post_retries_on_429_then_succeeds(monkeypatch):
    """A 429 must be retried (honoring retry_after) and the message delivered."""
    calls = {"n": 0}

    async def post_impl(url, json=None, data=None, files=None):
        calls["n"] += 1
        if calls["n"] == 1:
            return _FakeResp(429, {"ok": False, "error_code": 429,
                                   "parameters": {"retry_after": 2}})
        return _FakeResp(200, {"ok": True, "result": {"message_id": 5}})

    _install(monkeypatch, post_impl)
    res = _run(tg._post("sendMessage", {"chat_id": 1, "text": "hi"}))
    assert res and res.get("ok") is True
    assert calls["n"] == 2, "must resend once after a 429"


def test_post_retries_on_network_error_then_succeeds(monkeypatch):
    """A transient network/timeout error must be retried, not silently dropped."""
    calls = {"n": 0}

    async def post_impl(url, json=None, data=None, files=None):
        calls["n"] += 1
        if calls["n"] == 1:
            raise tg.httpx.ReadTimeout("boom")
        return _FakeResp(200, {"ok": True, "result": {"message_id": 9}})

    _install(monkeypatch, post_impl)
    res = _run(tg._post("sendMessage", {"chat_id": 1, "text": "hi"}))
    assert res and res.get("ok") is True
    assert calls["n"] == 2, "must retry once after a network blip"


def test_post_429_gives_up_after_max_attempts_returns_resp(monkeypatch):
    """Sustained 429 must stop after _MAX_SEND_ATTEMPTS and return the 429 body
    (not None) so callers can still inspect ok/error_code."""
    calls = {"n": 0}

    async def post_impl(url, json=None, data=None, files=None):
        calls["n"] += 1
        return _FakeResp(429, {"ok": False, "error_code": 429,
                               "parameters": {"retry_after": 1}})

    _install(monkeypatch, post_impl)
    res = _run(tg._post("sendMessage", {"chat_id": 1, "text": "hi"}))
    assert calls["n"] == tg._MAX_SEND_ATTEMPTS, "must stop at the attempt cap"
    assert res and res.get("error_code") == 429


def test_post_success_first_try_no_retry(monkeypatch):
    """The happy path must add no latency: exactly one POST, no retry."""
    calls = {"n": 0}

    async def post_impl(url, json=None, data=None, files=None):
        calls["n"] += 1
        return _FakeResp(200, {"ok": True, "result": {"message_id": 1}})

    _install(monkeypatch, post_impl)
    res = _run(tg._post("sendMessage", {"chat_id": 1, "text": "hi"}))
    assert res and res.get("ok") is True
    assert calls["n"] == 1, "no retry on first-try success"
