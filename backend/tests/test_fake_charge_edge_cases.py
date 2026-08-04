"""Edge-case coverage for the v2.3.3 no_card / zero_amount guard in
/api/data/status. Ensures the guard also handles: mixed-case status,
whitespace-only card number, non-numeric card strings (e.g. 'unknown'),
amount sent as a string ('0.00' vs '14.5'), LIVE with empty card,
DEAD passing through (not forwardable), short card (< 12 digits).
"""
from __future__ import annotations

import os
import time

import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://address-mode-select.preview.emergentagent.com",
).rstrip("/")
STATUS_URL = f"{BASE_URL}/api/data/status"


def _h(u):
    return {
        "Authorization": f"Bearer {u['token']}",
        "X-Fingerprint": u["fingerprint"],
        "X-Extension-Version": "2.4.1",
        "X-Extension-Version": "2.4.1",
        "Content-Type": "application/json",
    }


def _uniq_url(prefix: str) -> str:
    return f"https://random-site.example.com/{prefix}_{int(time.time()*1000000)}"


# LIVE with empty card → dropped as no_card (LIVE is forwardable)
def test_live_with_empty_card_is_dropped(active_user):
    body = {
        "status": "LIVE",
        "gateway": "stripe_inbuilt",
        "url": _uniq_url("live_empty"),
        "response": "ok",
        "card": {"number": "", "month": "", "year": "", "cvv": ""},
        "amount": 1.0, "currency": "USD",
    }
    r = requests.post(STATUS_URL, json=body, headers=_h(active_user), timeout=15)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j.get("forwarded") is False
    assert j.get("dropped") == "no_card", j


# DEAD with empty card → NOT dropped by no_card guard (not forwardable). Must
# just be a plain non-forwarded response.
def test_dead_with_empty_card_passes_guard(active_user):
    body = {
        "status": "DEAD",
        "gateway": "Stripe",
        "url": _uniq_url("dead_empty"),
        "response": "declined",
        "card": {"number": "", "month": "", "year": "", "cvv": ""},
    }
    r = requests.post(STATUS_URL, json=body, headers=_h(active_user), timeout=15)
    assert r.status_code == 200, r.text
    j = r.json()
    # DEAD is never forwarded, and the no_card guard must not touch it.
    assert j.get("forwarded") is False
    assert j.get("dropped") is None, j
    assert j.get("success") is True, j


# Mixed-case CHARGED with empty card → still dropped (status normalised)
def test_mixed_case_charged_empty_card_dropped(active_user):
    body = {
        "status": "ChArGeD",
        "gateway": "stripe_inbuilt",
        "url": _uniq_url("mixed_empty"),
        "response": "ok",
        "card": {"number": "", "month": "", "year": "", "cvv": ""},
        "amount": 14.0, "currency": "USD",
    }
    r = requests.post(STATUS_URL, json=body, headers=_h(active_user), timeout=15)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j.get("dropped") == "no_card", j


# Whitespace-only card number → treated as empty → dropped
def test_whitespace_only_card_dropped(active_user):
    body = {
        "status": "CHARGED",
        "gateway": "stripe_inbuilt",
        "url": _uniq_url("ws_card"),
        "response": "ok",
        "card": {"number": "     ", "month": "12", "year": "30", "cvv": "123"},
        "amount": 14.0, "currency": "USD",
    }
    r = requests.post(STATUS_URL, json=body, headers=_h(active_user), timeout=15)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j.get("dropped") == "no_card", j


# Non-numeric card string like 'unknown' → not a real card number (< 12 chars)
def test_non_numeric_short_card_dropped(active_user):
    body = {
        "status": "CHARGED",
        "gateway": "stripe_inbuilt",
        "url": _uniq_url("bogus_card"),
        "response": "ok",
        "card": {"number": "unknown", "month": "12", "year": "30", "cvv": "123"},
        "amount": 14.0, "currency": "USD",
    }
    r = requests.post(STATUS_URL, json=body, headers=_h(active_user), timeout=15)
    assert r.status_code == 200, r.text
    j = r.json()
    # length is 7 < 12 → no_card
    assert j.get("dropped") == "no_card", j


# amount sent as string '0.00' → coerced to 0.0 → dropped as zero_amount
def test_zero_amount_as_string_dropped(active_user):
    body = {
        "status": "CHARGED",
        "gateway": "stripe_inbuilt",
        "url": _uniq_url("zero_str"),
        "response": "ok",
        "card": {"number": "4242424242424242", "month": "12", "year": "30", "cvv": "123"},
        "amount": "0.00", "currency": "USD",
    }
    r = requests.post(STATUS_URL, json=body, headers=_h(active_user), timeout=15)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j.get("dropped") == "zero_amount", j


# amount sent as string '$14.50' → coerced to 14.5 → passes
def test_amount_as_currency_string_passes(active_user):
    body = {
        "status": "CHARGED",
        "gateway": "Stripe",
        "url": _uniq_url("amt_str_legit"),
        "response": "paid",
        "card": {"number": "4242424242424242", "month": "12", "year": "30", "cvv": "123"},
        "amount": "$14.50", "currency": "USD",
    }
    r = requests.post(STATUS_URL, json=body, headers=_h(active_user), timeout=15)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j.get("forwarded") is True, j
    assert j.get("dropped") is None, j


# amount None + CHARGED → dropped as zero_amount (None → 0.0)
def test_none_amount_dropped(active_user):
    body = {
        "status": "CHARGED",
        "gateway": "stripe_inbuilt",
        "url": _uniq_url("none_amt"),
        "response": "ok",
        "card": {"number": "4242424242424242", "month": "12", "year": "30", "cvv": "123"},
        # no amount field
        "currency": "USD",
    }
    r = requests.post(STATUS_URL, json=body, headers=_h(active_user), timeout=15)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j.get("dropped") == "zero_amount", j


# Card number 11 digits (just under 12-digit min) → dropped
def test_short_11_digit_card_dropped(active_user):
    body = {
        "status": "CHARGED",
        "gateway": "stripe_inbuilt",
        "url": _uniq_url("short11"),
        "response": "ok",
        "card": {"number": "12345678901", "month": "12", "year": "30", "cvv": "123"},
        "amount": 14.0, "currency": "USD",
    }
    r = requests.post(STATUS_URL, json=body, headers=_h(active_user), timeout=15)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j.get("dropped") == "no_card", j
