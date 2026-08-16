"""Verify the v4.1 persistence policy in POST /api/data/status.

- CHARGED  -> persisted + forwarded (hitId set, forwarded=true).
- LIVE     -> persisted + forwarded (hitId set, forwarded=true).
- DECLINED/DEAD with a real card -> persisted, NOT forwarded (hitId set,
  forwarded=false) so the user's dashboard History tab shows the attempt.
- DECLINED/DEAD with NO card     -> NOT persisted (hitId=null) — junk guard.
"""
from __future__ import annotations
import os
import httpx

BASE = os.environ.get("SEMEX_TEST_BASE", "http://localhost:8001")


def _hdrs(u):
    return {
        "Authorization": "Bearer " + u["token"],
        "X-Fingerprint": u["fingerprint"],
        "X-Extension-Version": "9.9.9",
        "X-Extension-Version": "9.9.9",
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

    # 2) LIVE — v4.0 policy: LIVE IS persisted (admin per-user card lookup
    # covers charged + live) and forwarded. Needs amount>0? No — only CHARGED
    # requires a plausible amount; LIVE needs a real card number.
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
    assert d.get("hitId"), f"LIVE must return hitId (v4.0 persists LIVE); got {d}"
    assert d.get("forwarded") is True, f"LIVE must be forwarded; got {d}"

    # 3) DEAD/DECLINED with a real card — v4.1: PERSISTED (shows in History) but
    # NOT forwarded to Telegram.
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
    assert d.get("hitId"), f"DEAD with a real card must be persisted (v4.1); got {d}"
    assert d.get("forwarded") is False, f"DEAD must NOT be forwarded; got {d}"

    # 4) DEAD with NO card — must NOT persist (junk-gateway-JSON guard).
    r_nocard = httpx.post(
        f"{BASE}/api/data/status",
        headers=_hdrs(active_user),
        json={"status": "DEAD", "gateway": "TestGateway", "hostname": "example.com"},
    )
    assert r_nocard.status_code == 200, r_nocard.text
    d = r_nocard.json()
    assert d.get("hitId") is None, f"card-less DEAD must NOT persist; got {d}"
    assert d.get("forwarded") is False

    # Mongo assertions: 1 CHARGED, 1 LIVE, and the card-carrying DEAD now persists.
    charged_count = mongo_db.hits.count_documents({"telegram_id": tid, "status": {"$regex": r"^charged$", "$options": "i"}})
    live_count = mongo_db.hits.count_documents({"telegram_id": tid, "status": {"$regex": r"^live$", "$options": "i"}})
    dead_count = mongo_db.hits.count_documents({"telegram_id": tid, "status": {"$regex": r"^dead$", "$options": "i"}})
    assert charged_count == 1, f"Expected 1 charged, got {charged_count}"
    assert live_count == 1, f"Expected 1 live persisted (v4.0 policy), got {live_count}"
    assert dead_count == 1, f"Expected 1 dead persisted (v4.1 policy), got {dead_count}"

    # Cleanup
    mongo_db.hits.delete_many({"telegram_id": tid, "gateway": "TestGateway"})
