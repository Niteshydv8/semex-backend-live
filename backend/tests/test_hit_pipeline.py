"""Backend regression tests for hit-submission + Telegram forwarding pipeline.

Focus: verify the fingerprint-mismatch soft-pass fix and the persistence /
forwarding logic in POST /api/data/status, plus admin visibility via
GET /api/admin/hits. Telegram DM delivery is NOT asserted (fake IDs); only DB
persistence and endpoint responses are validated.
"""
from __future__ import annotations

import os

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://address-mode-select.preview.emergentagent.com").rstrip("/")
STATUS_URL = f"{BASE_URL}/api/data/status"
ADMIN_HITS_URL = f"{BASE_URL}/api/admin/hits"


def _headers(token: str, fingerprint: str | None) -> dict:
    h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json", "X-Extension-Version": "9.9.9"}
    if fingerprint is not None:
        h["X-Fingerprint"] = fingerprint
    return h


def _charged_payload(url_suffix: str = "test-charged"):
    return {
        "status": "charged",
        "gateway": "TestGateway",
        "url": f"https://example.com/{url_suffix}",
        "hostname": "example.com",
        "response": "TEST_CHARGED_RESPONSE",
        "card": {"number": "4111111111111234", "month": "12", "year": "30", "cvv": "123", "holder": "TEST"},
        "amount": 1.23,
        "currency": "USD",
        "merchant": "TEST_Merchant",
    }


def _dead_payload(url_suffix: str = "test-dead"):
    return {
        "status": "declined",
        "gateway": "TestGateway",
        "url": f"https://example.com/{url_suffix}",
        "hostname": "example.com",
        "response": "TEST_DECLINE_RESPONSE",
        "card": {"number": "4111111111119999", "month": "01", "year": "29", "cvv": "999", "holder": "TEST"},
        "declineCode": "do_not_honor",
        "declineReason": "Card declined",
    }


# ---------- Auth enforcement ----------

class TestAuthEnforcement:
    def test_missing_auth_returns_401(self):
        r = requests.post(STATUS_URL, json=_charged_payload(), timeout=15)
        assert r.status_code == 401, r.text

    def test_revoked_session_returns_401(self, revoked_user_token):
        r = requests.post(
            STATUS_URL,
            json=_charged_payload(),
            headers=_headers(revoked_user_token["token"], "any-fp"),
            timeout=15,
        )
        assert r.status_code == 401, r.text
        body = r.json()
        # message may be "Session revoked"
        assert "session" in str(body).lower() or "revok" in str(body).lower()


# ---------- Fingerprint soft-pass (the core regression) ----------

class TestFingerprintSoftPass:
    def test_matching_fingerprint_success(self, active_user, mongo_db):
        r = requests.post(
            STATUS_URL,
            json=_charged_payload("fp-match"),
            headers=_headers(active_user["token"], active_user["fingerprint"]),
            timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("success") is True
        assert body.get("hitId")
        # DB persistence check
        doc = mongo_db.hits.find_one({"_id": _oid(body["hitId"])})
        assert doc is not None
        assert doc["telegram_id"] == active_user["telegram_id"]
        assert doc["status"] == "charged"

    def test_mismatched_fingerprint_still_saves_hit(self, active_user, mongo_db):
        """CORE REGRESSION: mismatched fingerprint must NOT 401 anymore."""
        r = requests.post(
            STATUS_URL,
            json=_charged_payload("fp-mismatch"),
            headers=_headers(active_user["token"], "test-fp-COMPLETELY-DIFFERENT-VALUE"),
            timeout=30,
        )
        assert r.status_code == 200, f"Expected 200 for fingerprint mismatch, got {r.status_code}: {r.text}"
        body = r.json()
        assert body.get("success") is True
        assert body.get("hitId")
        doc = mongo_db.hits.find_one({"_id": _oid(body["hitId"])})
        assert doc is not None
        assert doc["telegram_id"] == active_user["telegram_id"]

    def test_no_fingerprint_header_still_works(self, active_user):
        """Missing X-Fingerprint header should also work (soft-check gated on presence)."""
        r = requests.post(
            STATUS_URL,
            json=_charged_payload("no-fp"),
            headers=_headers(active_user["token"], None),
            timeout=30,
        )
        assert r.status_code == 200, r.text


# ---------- Charged vs Dead forwarding + persistence ----------

class TestHitPersistenceAndForwarding:
    def test_charged_hit_forwarded_true_and_persisted(self, active_user, mongo_db):
        r = requests.post(
            STATUS_URL,
            json=_charged_payload("charged-fwd"),
            headers=_headers(active_user["token"], active_user["fingerprint"]),
            timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("success") is True
        assert body.get("forwarded") is True, f"CHARGED hit should have forwarded=true, got {body}"
        assert body.get("hitId")
        doc = mongo_db.hits.find_one({"_id": _oid(body["hitId"])})
        assert doc is not None
        assert doc["status"] == "charged"

    def test_dead_hit_not_persisted(self, active_user, mongo_db):
        # NEW policy: only CHARGED hits are saved permanently. DEAD/declined are
        # neither persisted nor forwarded.
        r = requests.post(
            STATUS_URL,
            json=_dead_payload("dead-noforward"),
            headers=_headers(active_user["token"], active_user["fingerprint"]),
            timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("success") is True
        assert body.get("forwarded") is False, f"DEAD hit should have forwarded=false, got {body}"
        assert body.get("hitId") is None, f"DEAD hit must NOT be saved, got hitId={body.get('hitId')}"

    def test_live_hit_persisted_and_forwarded(self, active_user, mongo_db):
        # v4.0 policy: LIVE hits forward to Telegram AND are saved to the DB
        # (admin per-user card lookup covers charged + live). Must carry a real
        # card number — the no-card defense-in-depth guard drops it otherwise.
        r = requests.post(
            STATUS_URL,
            json={"status": "LIVE", "amount": "9.99", "currency": "USD", "hostname": "x",
                  "gateway": "stripe", "response": "Incorrect CVC",
                  "card": {"number": "4111111111111234", "month": "12", "year": "30", "cvv": "123"},
                  "url": f"https://example.com/live-{int(__import__('time').time()*1000)}"},
            headers=_headers(active_user["token"], active_user["fingerprint"]),
            timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("success") is True
        assert body.get("forwarded") is True, f"LIVE hit (active user) should forward, got {body}"
        assert body.get("hitId"), f"LIVE hit must be saved (v4.0 policy), got {body}"
        doc = mongo_db.hits.find_one({"_id": __import__("bson").ObjectId(body["hitId"])})
        assert doc is not None and doc.get("status") == "LIVE"

    def test_string_card_and_currency_amount_do_not_422(self, active_user, mongo_db):
        # Regression: checkout pages send amount like "₹250.00"/"1,250.00" and card
        # sometimes as a "num|mm|yy|cvv" string. These used to 422 (rejected before
        # save) → "server not saved [object Object]". Must now save with 200.
        import time as _time
        payload = {
            "status": "CHARGED",
            "card": "4111111111111111|12|26|123",
            "amount": "₹250.00",
            "currency": "INR",
            "hostname": "checkout.stripe.com",
            "url": f"https://checkout.stripe.com/pay/pi_stringcard_{int(_time.time()*1000)}",
            "gateway": "stripe",
        }
        r = requests.post(
            STATUS_URL,
            json=payload,
            headers=_headers(active_user["token"], active_user["fingerprint"]),
            timeout=30,
        )
        assert r.status_code == 200, f"lenient parse must not 422, got {r.status_code}: {r.text}"
        body = r.json()
        assert body.get("success") is True
        doc = mongo_db.hits.find_one({"_id": _oid(body["hitId"])})
        assert doc is not None
        assert doc.get("amount") == 250.0, f"amount should coerce to 250.0, got {doc.get('amount')}"
        assert doc.get("card_number") == "4111111111111111", f"string card should parse, got {doc.get('card_number')}"

    def test_comma_amount_does_not_422(self, active_user):
        # Card included: the no-card defense-in-depth guard drops cardless
        # hits before save, which would mask the lenient-parse assertion.
        r = requests.post(
            STATUS_URL,
            json={"status": "LIVE", "amount": "1,250.00", "hostname": "x",
                  "card": {"number": "4111111111111234"},
                  "url": f"https://example.com/comma-{int(__import__('time').time()*1000)}"},
            headers=_headers(active_user["token"], active_user["fingerprint"]),
            timeout=30,
        )
        assert r.status_code == 200, f"comma amount must not 422, got {r.status_code}: {r.text}"
        assert r.json().get("success") is True

    def test_object_response_and_nonstring_fields_do_not_422(self, active_user, mongo_db):
        # Regression: gateway `response` can arrive as a JSON object, and other fields
        # (e.g. hostname) as numbers. Must be coerced to strings, not 422.
        import time as _time
        payload = {
            "status": "CHARGED",
            "response": {"error": {"code": "card_declined", "message": "nope"}},
            "hostname": 12345,
            "amount": "₹250.00",
            "card": "4111111111111111|12|26|123",
            "url": f"https://checkout.stripe.com/pay/pi_objresp_{int(_time.time()*1000)}",
            "gateway": "stripe",
        }
        r = requests.post(
            STATUS_URL,
            json=payload,
            headers=_headers(active_user["token"], active_user["fingerprint"]),
            timeout=30,
        )
        assert r.status_code == 200, f"non-string fields must not 422, got {r.status_code}: {r.text}"
        body = r.json()
        assert body.get("success") is True
        doc = mongo_db.hits.find_one({"_id": _oid(body["hitId"])})
        assert doc is not None
        assert isinstance(doc.get("response"), str), "object response must be stored as a string"


# ---------- Admin visibility ----------

class TestAdminHitsListing:
    def test_admin_can_list_hits(self, active_user, admin_by_id_user, mongo_db):
        # Ensure at least one hit exists for the active_user (create one)
        r = requests.post(
            STATUS_URL,
            json=_charged_payload("admin-visibility"),
            headers=_headers(active_user["token"], active_user["fingerprint"]),
            timeout=30,
        )
        assert r.status_code == 200
        expected_hit_id = r.json()["hitId"]

        # Admin lists hits
        r2 = requests.get(
            ADMIN_HITS_URL,
            params={"telegram_id": active_user["telegram_id"], "limit": 50},
            headers=_headers(admin_by_id_user["token"], admin_by_id_user["fingerprint"]),
            timeout=15,
        )
        assert r2.status_code == 200, r2.text
        data = r2.json()
        assert "hits" in data and isinstance(data["hits"], list)
        ids = [h.get("id") for h in data["hits"]]
        assert expected_hit_id in ids, f"Newly inserted hit {expected_hit_id} not in admin listing"

    def test_non_admin_cannot_access_admin_hits(self, active_user):
        r = requests.get(
            ADMIN_HITS_URL,
            headers=_headers(active_user["token"], active_user["fingerprint"]),
            timeout=15,
        )
        assert r.status_code == 403, r.text

    def test_default_listing_excludes_legacy_live_and_dead(self, active_user, admin_by_id_user, mongo_db):
        """New rule (Jan-2026): even if legacy LIVE/DEAD docs exist in db.hits,
        the default GET /api/admin/hits response must contain ONLY charged rows.
        Charged docs for the same telegram_id must still be visible."""
        from datetime import datetime, timezone
        from bson import ObjectId

        tid = active_user["telegram_id"]
        legacy_live_id = ObjectId()
        legacy_dead_id = ObjectId()
        legacy_charged_id = ObjectId()
        now = datetime.now(timezone.utc)
        mongo_db.hits.insert_many([
            {"_id": legacy_live_id,    "telegram_id": tid, "status": "live",     "created_at": now, "gateway": "TestGateway", "response": "legacy-live"},
            {"_id": legacy_dead_id,    "telegram_id": tid, "status": "declined", "created_at": now, "gateway": "TestGateway", "response": "legacy-dead"},
            {"_id": legacy_charged_id, "telegram_id": tid, "status": "charged",  "created_at": now, "gateway": "TestGateway", "response": "legacy-charged"},
        ])
        try:
            r = requests.get(
                ADMIN_HITS_URL,
                params={"telegram_id": tid, "limit": 500},
                headers=_headers(admin_by_id_user["token"], admin_by_id_user["fingerprint"]),
                timeout=15,
            )
            assert r.status_code == 200, r.text
            hits = r.json()["hits"]
            statuses = [str(h.get("status", "")).lower() for h in hits]
            assert all(s in ("charged", "success", "approved", "succeeded", "captured") for s in statuses), (
                f"Non-charged statuses leaked into admin listing: {set(statuses)}"
            )
            ids = [h["id"] for h in hits]
            assert str(legacy_live_id) not in ids, "Legacy LIVE doc leaked into admin listing"
            assert str(legacy_dead_id) not in ids, "Legacy DEAD doc leaked into admin listing"
            assert str(legacy_charged_id) in ids, "Legacy CHARGED doc must still be visible in admin listing"
        finally:
            mongo_db.hits.delete_many({"_id": {"$in": [legacy_live_id, legacy_dead_id, legacy_charged_id]}})

    def test_admin_can_still_filter_by_status_live(self, active_user, admin_by_id_user, mongo_db):
        """Explicit ?status=live must still return the live doc — the default-only
        charged filter must not lock the admin OUT of legacy data when they ask."""
        from datetime import datetime, timezone
        from bson import ObjectId

        tid = active_user["telegram_id"]
        legacy_live_id = ObjectId()
        mongo_db.hits.insert_one(
            {"_id": legacy_live_id, "telegram_id": tid, "status": "live",
             "created_at": datetime.now(timezone.utc), "gateway": "TestGateway",
             "response": "explicit-live"}
        )
        try:
            r = requests.get(
                ADMIN_HITS_URL,
                params={"telegram_id": tid, "status": "live", "limit": 50},
                headers=_headers(admin_by_id_user["token"], admin_by_id_user["fingerprint"]),
                timeout=15,
            )
            assert r.status_code == 200, r.text
            ids = [h["id"] for h in r.json()["hits"]]
            assert str(legacy_live_id) in ids
        finally:
            mongo_db.hits.delete_one({"_id": legacy_live_id})


# ---------- Paywall / plan expiry ----------

class TestPaywall:
    def test_expired_non_admin_saves_but_does_not_forward(self, expired_user, mongo_db):
        # NEW behaviour ("make it working"): an expired/non-admin user's hit is
        # STILL saved to the DB (so it shows in the admin panel + counters) but is
        # NOT forwarded to Telegram (paywall). Previously this 402'd before the
        # insert, which silently dropped every hit and caused the "server not saved"
        # errors the owner reported.
        r = requests.post(
            STATUS_URL,
            json=_charged_payload("expired-user"),
            headers=_headers(expired_user["token"], expired_user["fingerprint"]),
            timeout=15,
        )
        assert r.status_code == 200, f"Expired non-admin hit should still SAVE (200), got {r.status_code}: {r.text}"
        body = r.json()
        assert body.get("success") is True
        # Extension is FREE — plan expiry no longer gates forwarding; everyone
        # with a valid session forwards.
        assert body.get("forwarded") is True, f"Expired non-admin hit forwards under free-access policy, got {body}"
        doc = mongo_db.hits.find_one({"_id": _oid(body["hitId"])})
        assert doc is not None, "Expired user's hit must be persisted to db.hits"

    def test_admin_always_succeeds(self, admin_user, mongo_db):
        r = requests.post(
            STATUS_URL,
            json=_charged_payload("admin-charged"),
            headers=_headers(admin_user["token"], admin_user["fingerprint"]),
            timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("success") is True
        # admin also should get forwarded true for charged
        assert body.get("forwarded") is True
        doc = mongo_db.hits.find_one({"_id": _oid(body["hitId"])})
        assert doc is not None
        assert doc["telegram_id"] == admin_user["telegram_id"]

    def test_admin_by_id_stale_flag_still_forwards(self, admin_by_id_user, mongo_db):
        """Stale-flag safety: user.telegram_id == settings.ADMIN_TELEGRAM_ID must
        be treated as admin by the endpoint EVEN IF is_admin=false in DB and plan
        expired. Charged hit must persist + forward=true.
        """
        r = requests.post(
            STATUS_URL,
            json=_charged_payload("admin-by-id-stale"),
            headers=_headers(admin_by_id_user["token"], admin_by_id_user["fingerprint"]),
            timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("success") is True
        assert body.get("forwarded") is True, (
            f"admin-by-id (ADMIN_TELEGRAM_ID match) with stale is_admin=false + expired plan "
            f"must still forward, got {body}"
        )
        doc = mongo_db.hits.find_one({"_id": _oid(body["hitId"])})
        assert doc is not None
        assert doc["telegram_id"] == admin_by_id_user["telegram_id"]
        assert doc["status"] == "charged"


# ---------- helpers ----------

def _oid(hit_id: str):
    from bson import ObjectId
    return ObjectId(hit_id)
