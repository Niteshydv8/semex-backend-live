"""Tests for enriched /api/user/bins endpoints (Phase B)."""
from __future__ import annotations
import os
import httpx

BASE = os.environ.get("SEMEX_TEST_BASE", "http://localhost:8001")


def _hdrs(u):
    return {"Authorization": "Bearer " + u["token"], "X-Fingerprint": u["fingerprint"], "X-Extension-Version": "2.4.1"}


def _cleanup(mongo_db, tid):
    mongo_db.user_bins.delete_many({"telegram_id": tid})


def test_save_bin_auto_populates_metadata(active_user, mongo_db):
    _cleanup(mongo_db, active_user["telegram_id"])
    r = httpx.post(
        f"{BASE}/api/user/bins",
        headers={**_hdrs(active_user), "Content-Type": "application/json"},
        json={"bin": "44304400", "label": "PNC Debit", "notes": "Works on Shopify"},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["success"] is True
    assert d["bin"] == "44304400"
    # Best-effort — network may fail, but brand should at least be locally detected as visa
    meta = d.get("meta") or {}
    assert (meta.get("brand") or "").lower() in ("visa", None)


def test_list_bins_returns_metadata(active_user, mongo_db):
    _cleanup(mongo_db, active_user["telegram_id"])
    # Save with label + notes
    httpx.post(
        f"{BASE}/api/user/bins",
        headers={**_hdrs(active_user), "Content-Type": "application/json"},
        json={"bin": "44304400", "label": "PNC ★", "notes": "hi"},
        timeout=15,
    )
    r = httpx.get(f"{BASE}/api/user/bins", headers=_hdrs(active_user), timeout=15)
    assert r.status_code == 200
    bins = r.json()["bins"]
    assert len(bins) >= 1
    b = next(x for x in bins if x["bin"] == "44304400")
    assert b["label"] == "PNC ★"
    assert b["notes"] == "hi"
    # brand/cardType/level etc are all optional (network-dependent) but keys should be present
    for k in ("brand", "cardType", "level", "bank", "country", "countryCode"):
        assert k in b


def test_patch_bin_updates_label_and_notes(active_user, mongo_db):
    _cleanup(mongo_db, active_user["telegram_id"])
    r = httpx.post(
        f"{BASE}/api/user/bins",
        headers={**_hdrs(active_user), "Content-Type": "application/json"},
        json={"bin": "55554444", "label": "old"},
        timeout=15,
    )
    bins = httpx.get(f"{BASE}/api/user/bins", headers=_hdrs(active_user)).json()["bins"]
    bid = next(x["id"] for x in bins if x["bin"] == "55554444")
    r = httpx.patch(
        f"{BASE}/api/user/bins/{bid}",
        headers={**_hdrs(active_user), "Content-Type": "application/json"},
        json={"label": "new-name", "notes": "new-notes"},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    assert r.json()["success"] is True
    bins2 = httpx.get(f"{BASE}/api/user/bins", headers=_hdrs(active_user)).json()["bins"]
    b = next(x for x in bins2 if x["id"] == bid)
    assert b["label"] == "new-name"
    assert b["notes"] == "new-notes"


def test_patch_bin_bad_id(active_user):
    r = httpx.patch(
        f"{BASE}/api/user/bins/notavalidid",
        headers={**_hdrs(active_user), "Content-Type": "application/json"},
        json={"label": "x"},
        timeout=10,
    )
    assert r.status_code == 400
