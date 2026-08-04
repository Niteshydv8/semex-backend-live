"""Regression: server MUST refuse fake CHARGED hits with empty card / zero
amount (v2.3.3 hardening after the @arishu_11 hyper3d.com false-positive).

Reported case: a hit with card="" and amount=0.00 was accepted and posted
to Telegram as "USD 0.00 Charged!" even though the user never entered a
card. Backend now returns 200 with `dropped:"no_card"` (silent drop, no
Telegram forward, no DB insert).
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


def test_charged_with_empty_card_is_dropped(active_user):
    body = {
        "status": "CHARGED",
        "gateway": "stripe_inbuilt",
        "url": f"https://random-site.example.com/pi_fake_{int(time.time()*1000)}",
        "response": "ok",
        "card": {"number": "", "month": "", "year": "", "cvv": ""},
        "amount": 14.0, "currency": "USD",
    }
    r = requests.post(STATUS_URL, json=body, headers=_h(active_user), timeout=15)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j.get("forwarded") is False
    assert j.get("dropped") == "no_card", f"expected no_card drop, got {j}"


def test_charged_with_zero_amount_is_dropped(active_user):
    body = {
        "status": "CHARGED",
        "gateway": "stripe_inbuilt",
        "url": f"https://random-site.example.com/pi_zero_{int(time.time()*1000)}",
        "response": "ok",
        "card": {"number": "4242424242424242", "month": "12", "year": "30", "cvv": "123"},
        "amount": 0.0, "currency": "USD",
    }
    r = requests.post(STATUS_URL, json=body, headers=_h(active_user), timeout=15)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j.get("forwarded") is False
    assert j.get("dropped") == "zero_amount", f"expected zero_amount drop, got {j}"


def test_legit_charged_with_card_and_amount_passes(active_user):
    body = {
        "status": "CHARGED",
        "gateway": "Stripe",
        "url": f"https://api.stripe.com/v1/payment_intents/pi_legit_{int(time.time()*1000)}",
        "response": "paid",
        "card": {"number": "4242424242424242", "month": "12", "year": "30", "cvv": "123"},
        "amount": 14.5, "currency": "USD",
    }
    r = requests.post(STATUS_URL, json=body, headers=_h(active_user), timeout=15)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j.get("forwarded") is True, f"legit hit must be forwarded, got {j}"
    assert j.get("dropped") is None
