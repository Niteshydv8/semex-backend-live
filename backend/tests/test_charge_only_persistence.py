"""Verify charge-only persistence policy: only CHARGED hits get inserted into `hits`.

LIVE hits are forwarded to Telegram but NOT persisted (forwarded=true, hitId=null).
DEAD hits are not forwarded and not persisted (forwarded=false, hitId=null).
"""
from __future__ import annotations
import os
import httpx

BASE = os.environ.get("SEMEX_TEST_BASE", "http://localhost:8001")


def _hdrs(u):
    return {
        "Authorization": "Bearer " + u["token"],
        "X-Fingerprint": u["fingerprint"],
        "X-Extension-Version": "2.4.1",
        "X-Extension-Version": "2.4.1",
        "Content-Type": "application/json",
    }


def test_charge_only_persistence(active_user, mongo_db):
    tid = active_user["telegram_id"]
    # Reset the user's hits so counts start clean
    mongo_db.hits.delete_many({"telegram_id": tid})

    base_card = {"number": "4242424242424242", "month": "12", "year": "29", "cvv": "123", "holder": "TEST"}

    # 1) CHARGED — should insert 1 hit
    r_charged = httpx.post(
        f"{BASE}/api/data/status",
        headers=_hdrs(active_user),
        json={
            "status": "CHARGED",
            "gateway": "TestGateway",
            "hostname": "example.com",
            "card": base_card,
            "amount": 1.00,
            "currency": "USD",
        },
    )
    assert r_charged.status_code == 200, r_charged.text
    d = r_charged.json()
    assert d["success"] is True
    assert d.get("hitId"), "CHARGED must return hitId"

    # 2) LIVE — should NOT insert, but forwarded=True and hitId=None
    r_live = httpx.post(
        f"{BASE}/api/data/status",
        headers=_hdrs(active_user),
        json={
            "status": "LIVE",
            "gateway": "TestGateway",
            "hostname": "example.com",
            "card": base_card,
        },
    )
    assert r_live.status_code == 200, r_live.text
    d = r_live.json()
    assert d.get("hitId") is None, f"LIVE must NOT return hitId; got {d}"
    assert d.get("forwarded") is True, f"LIVE must be forwarded; got {d}"

    # 3) DEAD/DECLINED — should NOT insert, forwarded=False, hitId=None
    r_dead = httpx.post(
        f"{BASE}/api/data/status",
        headers=_hdrs(active_user),
        json={
            "status": "DEAD",
            "gateway": "TestGateway",
            "hostname": "example.com",
            "card": base_card,
        },
    )
    assert r_dead.status_code == 200, r_dead.text
    d = r_dead.json()
    assert d.get("hitId") is None, f"DEAD must NOT return hitId; got {d}"
    assert d.get("forwarded") is False, f"DEAD must NOT be forwarded; got {d}"

    # Mongo assertions: exactly 1 CHARGED hit, 0 LIVE, 0 DEAD
    charged_count = mongo_db.hits.count_documents({"telegram_id": tid, "status": {"$regex": r"^charged$", "$options": "i"}})
    live_count = mongo_db.hits.count_documents({"telegram_id": tid, "status": {"$regex": r"^live$", "$options": "i"}})
    dead_count = mongo_db.hits.count_documents({"telegram_id": tid, "status": {"$regex": r"^dead$", "$options": "i"}})
    assert charged_count == 1, f"Expected 1 charged, got {charged_count}"
    assert live_count == 0, f"Expected 0 live persisted, got {live_count}"
    assert dead_count == 0, f"Expected 0 dead persisted, got {dead_count}"

    # Cleanup
    mongo_db.hits.delete_many({"telegram_id": tid, "gateway": "TestGateway"})
