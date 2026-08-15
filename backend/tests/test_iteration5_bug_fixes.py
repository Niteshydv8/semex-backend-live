"""Iteration-5 targeted regression tests for the bug-fix batch:

- GET /api/admin/is-owner returns both `isOwner` and `ownerTelegramId`.
- GET /api/user/me returns numeric `telegramId`.
- Promoted admin (non-owner) cannot promote.
- POST /api/user/bins auto-populates brand/cardType/level/bank/country/countryCode.
- PATCH /api/user/bins/{id} updates label+notes and 400s on bad id.
- routes/data.py:submit_status enters the OWNER DM-mirror branch for a
  promoted-admin CHARGED hit (line ~279 else). Verified by:
    * asserting the mirror send_photo is called with settings.ADMIN_TELEGRAM_ID
      (monkey-patched telegram service — no real Telegram traffic).
"""
from __future__ import annotations

import base64
import os
import sys
from pathlib import Path

import httpx
import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from config import settings  # noqa: E402

BASE = os.environ.get("SEMEX_TEST_BASE", "http://localhost:8001")


def _hdrs(u):
    return {"Authorization": "Bearer " + u["token"], "X-Fingerprint": u["fingerprint"], "X-Extension-Version": "9.9.9"}


# ----------------- is-owner shape -----------------

class TestIsOwnerShape:
    def test_is_owner_returns_both_keys_for_promoted_admin(self, admin_user):
        r = httpx.get(f"{BASE}/api/admin/is-owner", headers=_hdrs(admin_user))
        assert r.status_code == 200
        d = r.json()
        assert d.get("isOwner") is False
        assert d.get("ownerTelegramId") == settings.ADMIN_TELEGRAM_ID
        assert isinstance(d["ownerTelegramId"], int)

    def test_is_owner_returns_both_keys_for_owner(self, admin_by_id_user):
        r = httpx.get(f"{BASE}/api/admin/is-owner", headers=_hdrs(admin_by_id_user))
        assert r.status_code == 200
        d = r.json()
        assert d.get("isOwner") is True
        assert d.get("ownerTelegramId") == settings.ADMIN_TELEGRAM_ID

    def test_non_admin_gets_403_on_is_owner(self, active_user):
        r = httpx.get(f"{BASE}/api/admin/is-owner", headers=_hdrs(active_user))
        assert r.status_code == 403


# ----------------- /me includes telegramId -----------------

class TestMeTelegramId:
    def test_me_has_numeric_telegram_id(self, active_user):
        r = httpx.get(f"{BASE}/api/user/me", headers=_hdrs(active_user))
        assert r.status_code == 200
        d = r.json()
        assert "telegramId" in d
        assert isinstance(d["telegramId"], int)
        assert d["telegramId"] == active_user["telegram_id"]

    def test_me_for_admin_has_numeric_telegram_id(self, admin_user):
        r = httpx.get(f"{BASE}/api/user/me", headers=_hdrs(admin_user))
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d["telegramId"], int)
        assert d["telegramId"] == admin_user["telegram_id"]
        assert d["isAdmin"] is True


# ----------------- Owner-only guard on /promote (regression) -----------------

class TestPromoteOwnerOnly:
    def test_promoted_admin_gets_403_owner_only(self, admin_user, active_user):
        r = httpx.post(
            f"{BASE}/api/admin/users/promote",
            headers={**_hdrs(admin_user), "Content-Type": "application/json"},
            json={"telegramId": active_user["telegram_id"]},
        )
        assert r.status_code == 403
        assert "Owner only" in r.text


# ----------------- BINs auto-populate metadata + patch -----------------

class TestBinsMetadata:
    def test_post_bin_returns_all_six_meta_keys(self, active_user, mongo_db):
        mongo_db.user_bins.delete_many({"telegram_id": active_user["telegram_id"]})
        r = httpx.post(
            f"{BASE}/api/user/bins",
            headers={**_hdrs(active_user), "Content-Type": "application/json"},
            json={"bin": "44304400", "label": "PNC test"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["success"] is True
        meta = d.get("meta") or {}
        for k in ("brand", "cardType", "level", "bank", "country", "countryCode"):
            assert k in meta, f"missing key {k} in meta"
        # Local brand detection MUST at least return visa for 44304400.
        assert (meta.get("brand") or "").lower() == "visa"

    def test_list_bins_includes_all_metadata_keys(self, active_user, mongo_db):
        mongo_db.user_bins.delete_many({"telegram_id": active_user["telegram_id"]})
        httpx.post(
            f"{BASE}/api/user/bins",
            headers={**_hdrs(active_user), "Content-Type": "application/json"},
            json={"bin": "44304400", "label": "L", "notes": "N"},
            timeout=15,
        )
        r = httpx.get(f"{BASE}/api/user/bins", headers=_hdrs(active_user), timeout=15)
        assert r.status_code == 200
        b = next(x for x in r.json()["bins"] if x["bin"] == "44304400")
        for k in ("brand", "cardType", "level", "bank", "country", "countryCode",
                  "label", "notes"):
            assert k in b

    def test_patch_bin_updates_and_persists(self, active_user, mongo_db):
        mongo_db.user_bins.delete_many({"telegram_id": active_user["telegram_id"]})
        httpx.post(
            f"{BASE}/api/user/bins",
            headers={**_hdrs(active_user), "Content-Type": "application/json"},
            json={"bin": "55554444", "label": "orig", "notes": "orig-notes"},
            timeout=15,
        )
        bins = httpx.get(f"{BASE}/api/user/bins", headers=_hdrs(active_user)).json()["bins"]
        bid = next(x["id"] for x in bins if x["bin"] == "55554444")
        r = httpx.patch(
            f"{BASE}/api/user/bins/{bid}",
            headers={**_hdrs(active_user), "Content-Type": "application/json"},
            json={"label": "renamed", "notes": "renamed-notes"},
        )
        assert r.status_code == 200
        assert r.json()["success"] is True
        # Persistence check
        bins2 = httpx.get(f"{BASE}/api/user/bins", headers=_hdrs(active_user)).json()["bins"]
        b = next(x for x in bins2 if x["id"] == bid)
        assert b["label"] == "renamed"
        assert b["notes"] == "renamed-notes"

    def test_patch_bin_bad_id_returns_400(self, active_user):
        r = httpx.patch(
            f"{BASE}/api/user/bins/not-a-valid-objectid",
            headers={**_hdrs(active_user), "Content-Type": "application/json"},
            json={"label": "x"},
        )
        assert r.status_code == 400


# ----------------- Owner DM-mirror code path for promoted-admin CHARGED hit -----------------

def test_owner_dm_mirror_branch_entered_for_promoted_admin_charged(admin_user, mongo_db, monkeypatch):
    import asyncio
    asyncio.run(_run_owner_mirror_check(admin_user, mongo_db, monkeypatch))


async def _run_owner_mirror_check(admin_user, mongo_db, monkeypatch):
    """Directly invoke routes/data.submit_status with the promoted-admin user
    firing a CHARGED hit. Monkeypatch send_photo/send_message to record calls,
    and assert one call targeted settings.ADMIN_TELEGRAM_ID — proving the
    else-branch at routes/data.py:~279 (owner DM mirror) was entered.
    """
    import routes.data as data_mod
    from routes.data import StatusBody

    calls = []

    async def fake_enqueue_photo(db, chat_id, photo, caption, **kw):
        calls.append(("photo", chat_id, (caption or "")[:40]))
        return True

    async def fake_enqueue_message(db, chat_id, text, **kw):
        calls.append(("msg", chat_id, (text or "")[:40]))
        return True

    # v2.9.1+: forwarding goes through the durable outbox, not direct sends.
    monkeypatch.setattr(data_mod.telegram_outbox, "enqueue_photo", fake_enqueue_photo)
    monkeypatch.setattr(data_mod.telegram_outbox, "enqueue_message", fake_enqueue_message)

    async def fake_lookup(bin_code):
        return {"bin": bin_code, "brand": "visa"}
    monkeypatch.setattr(data_mod, "lookup_bin", fake_lookup)

    from db import get_db
    from models import User
    # Fresh Motor client bound to THIS event loop — the module-global one may
    # have been created under a since-closed loop by an earlier test.
    from motor.motor_asyncio import AsyncIOMotorClient
    from config import settings as _s
    db = AsyncIOMotorClient(_s.MONGO_URL)[_s.DB_NAME]
    monkeypatch.setattr(data_mod, "get_db", lambda: db)
    doc = await db.users.find_one({"telegram_id": admin_user["telegram_id"]})
    user = User.from_mongo(doc)
    assert user.is_admin is True
    assert user.telegram_id != settings.ADMIN_TELEGRAM_ID  # promoted, NOT owner

    body = StatusBody(
        status="CHARGED",
        gateway="TestGateway",
        response="thank_you",
        card={"number": "4430440012341234"},
        amount=5.0,  # CHARGED without a plausible amount is dropped by the fake-hit guard
        currency="USD",
        screenshot=base64.b64encode(b"pngdata").decode(),
    )
    import types as _types
    stub_request = _types.SimpleNamespace(
        headers={"cf-connecting-ip": "203.0.113.50"},
        client=_types.SimpleNamespace(host="203.0.113.50"),
        state=_types.SimpleNamespace(extension_outdated=False),
    )

    resp = await data_mod.submit_status(body, request=stub_request, user=user)
    assert resp["success"] is True
    assert resp["forwarded"] is True

    # Assert an owner-DM call happened (proves else branch at ~279 was entered)
    owner_calls = [c for c in calls if c[1] == settings.ADMIN_TELEGRAM_ID]
    assert owner_calls, f"No owner-DM mirror call found. All calls: {calls}"

    # Cleanup
    await db.hits.delete_many({"telegram_id": user.telegram_id, "gateway": "TestGateway"})
