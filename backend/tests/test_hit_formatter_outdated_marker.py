"""Verify v2.3.7 formatter changes:
- from_outdated_ext hits show a subtle version marker in admin-view only
- No "TAMPERED" wording anywhere
- User-view (admin_view=False) has NO version marker at all
"""
from services.hit_formatter import format_hit


def _base_hit(**over):
    h = {
        "card_number": "4111111111111111",
        "card_exp_month": "12",
        "card_exp_year": "2027",
        "card_cvv": "123",
        "status": "charged",
        "response": "Approved",
        "gateway": "Stripe",
        "bin_bank": "TEST",
        "bin_country": "United States",
        "bin_country_flag": "🇺🇸",
        "amount": "1.00",
        "currency": "USD",
        "product": "Test",
        "merchant": "Merch",
        "success_url": "-",
        "customer_email": "-",
        "ip": "1.2.3.4",
        "ip_country": "US",
        "from_outdated_ext": False,
        "ext_sent_version": None,
    }
    h.update(over)
    return h


def _base_user():
    return {"telegram_id": 42, "telegram_username": "tester", "plan": "TRIAL"}


def test_admin_view_shows_outdated_ext_marker():
    h = _base_hit(from_outdated_ext=True, ext_sent_version="1.0.0")
    out = format_hit(h, _base_user(), admin_view=True)
    assert "Ext version" in out
    assert "v1.0.0" in out
    assert "outdated" in out
    # No scary wording
    assert "TAMPERED" not in out
    assert "🚨" not in out


def test_user_view_never_shows_ext_marker():
    h = _base_hit(from_outdated_ext=True, ext_sent_version="1.0.0")
    out = format_hit(h, _base_user(), admin_view=False)
    assert "Ext version" not in out
    assert "outdated" not in out


def test_admin_view_current_ext_no_marker():
    h = _base_hit(from_outdated_ext=False)
    out = format_hit(h, _base_user(), admin_view=True)
    assert "Ext version" not in out
    assert "outdated" not in out
