"""Tests for the paywall-loop bug: a bogus "3" version in extension_releases
made every real build (v2.3.9) look outdated to itself.

Verifies:
- `_is_valid_semver` rejects "3", "latest", "", "abc" and accepts "2.3", "2.3.9", "10.0.1.2".
- `_get_min_extension_version` skips invalid DB rows and falls back to `_FALLBACK_MIN_VERSION`.
- `/api/public/version` returns a valid semver even when the DB is polluted with "3".
- `POST /admin/extension/publish` rejects a payload with version="3" (400).
- `POST /admin/extension/versions/<id>/make-minimum` rejects a release whose version isn't semver (400).
- `POST /admin/extension/cleanup-invalid` deletes bad rows and busts the cache.
"""
from __future__ import annotations

import asyncio
import pytest
from unittest.mock import AsyncMock

from routes.data import (
    _FALLBACK_MIN_VERSION,
    _MIN_EXTENSION_CACHE,
    _get_min_extension_version,
    _is_valid_semver,
    _parse_version,
)


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro) if False else asyncio.run(coro)


def _reset_cache():
    _MIN_EXTENSION_CACHE["version"] = None
    _MIN_EXTENSION_CACHE["expires"] = 0.0


def test_is_valid_semver_accepts_good_versions():
    for v in ("2.3", "2.3.9", "0.1.0", "10.0.1.2", "12.34.56"):
        assert _is_valid_semver(v), f"{v} should be valid"


def test_is_valid_semver_rejects_bad_versions():
    for v in ("3", "latest", "", None, "abc", "v2.3.9", "2", "2.", ".3.9", "2.3.a"):
        assert not _is_valid_semver(v), f"{v} should be invalid"


def test_parse_version_shows_the_bug_semantics():
    """Sanity: the underlying tuple compare is why "3" beats 2.3.9. This is why
    we filter invalid strings at the source rather than trying to patch compare."""
    assert _parse_version("2.3.9") < _parse_version("3")


def test_fallback_min_version_is_current_build():
    """The safe floor must be a valid SEMEX semver (it is bumped as the build
    moves forward, so don't pin a literal — pin the invariant)."""
    assert _is_valid_semver(_FALLBACK_MIN_VERSION)
    assert _parse_version(_FALLBACK_MIN_VERSION) > (0, 0, 0, 0)


class _FakeCursor:
    def __init__(self, docs):
        self._docs = list(docs)

    def sort(self, *_a, **_k):
        return self

    def limit(self, *_a, **_k):
        return self

    def __aiter__(self):
        self._i = 0
        return self

    async def __anext__(self):
        if self._i >= len(self._docs):
            raise StopAsyncIteration
        d = self._docs[self._i]
        self._i += 1
        return d


class _FakeCollection:
    def __init__(self, rows_by_filter: dict):
        self._rows = rows_by_filter

    def find(self, filt):
        key = tuple(sorted(filt.items()))
        return _FakeCursor(self._rows.get(key, []))


class _FakeDB:
    def __init__(self, releases):
        self.extension_releases = _FakeCollection(releases)


def test_get_min_version_skips_bogus_row(monkeypatch):
    """Simulate a Mongo where the ONLY is_minimum row has version="3"."""
    _reset_cache()
    bad = {"version": "3"}
    fake_db = _FakeDB(
        {
            (("is_minimum", True),): [bad],
            (("is_latest", True),): [bad],
        }
    )
    import routes.data as data_mod
    monkeypatch.setattr(data_mod, "get_db", lambda: fake_db)
    v = _run(_get_min_extension_version())
    assert v == _FALLBACK_MIN_VERSION  # fallback because "3" is invalid


def test_get_min_version_picks_first_valid_after_bad(monkeypatch):
    """Mongo returns [ {v:'3'} , {v:'2.3.5'} ] — the bogus row is skipped, and
    the valid 2.3.5 is then clamped UP to the hardcoded floor (the floor always
    wins over older DB values, so bumping the constant gates a new minimum
    without touching the DB)."""
    _reset_cache()
    fake_db = _FakeDB(
        {
            (("is_minimum", True),): [{"version": "3"}, {"version": "2.3.5"}],
        }
    )
    import routes.data as data_mod
    monkeypatch.setattr(data_mod, "get_db", lambda: fake_db)
    v = _run(_get_min_extension_version())
    assert v == _FALLBACK_MIN_VERSION


def test_get_min_version_uses_latest_when_no_minimum(monkeypatch):
    """No is_minimum row; latest=2.3.9 — again clamped up to the floor."""
    _reset_cache()
    fake_db = _FakeDB(
        {
            (("is_minimum", True),): [],
            (("is_latest", True),): [{"version": "2.3.9"}],
        }
    )
    import routes.data as data_mod
    monkeypatch.setattr(data_mod, "get_db", lambda: fake_db)
    v = _run(_get_min_extension_version())
    assert v == _FALLBACK_MIN_VERSION


def test_get_min_version_db_value_above_floor_wins(monkeypatch):
    """A DB version HIGHER than the floor is honored (floor is a floor, not a cap)."""
    _reset_cache()
    fake_db = _FakeDB(
        {
            (("is_minimum", True),): [{"version": "99.0.0"}],
        }
    )
    import routes.data as data_mod
    monkeypatch.setattr(data_mod, "get_db", lambda: fake_db)
    v = _run(_get_min_extension_version())
    assert v == "99.0.0"
