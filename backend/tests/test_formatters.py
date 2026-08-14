"""Unit tests for the Telegram message formatters:
- clean_response: raw Stripe/JSON response -> short human-readable status
- format_hit: OWNER label, plan/banned labels
- format_public_showcase: FULL username (not masked), clean response
"""
from services.hit_formatter import clean_response, format_hit
from services.extra_formatters import format_public_showcase

RAW_SESSION = (
    '{"id":"ppage_1TuHYtLqKQNxGiIMki5UrtgU","object":"checkout.session",'
    '"account_settings":{"account_id":"acct_1T2CStLqKQNxGiIM"},'
    '"payment_status":"paid","status":"complete","payment_intent":"pi_1TuHZabc123"}'
)


def _hit(**over):
    base = {
        "card_number": "4118709831370322", "card_exp_month": "11", "card_exp_year": "2030",
        "card_cvv": "635", "status": "charged", "amount": 1696.17, "currency": "NPR",
        "response": RAW_SESSION, "gateway": "Stripe Checkout", "bin_bank": "FIRST-CITIZENS BANK",
        "bin_brand": "VISA", "bin_type": "CREDIT", "bin_level": "CONSUMER",
        "bin_country": "United States", "bin_country_flag": "US", "product": "opencode credits",
        "merchant": "Anomaly", "success_url": "https://opencode.ai/x/billing",
        "customer_email": "a@b.com",
    }
    base.update(over)
    return base


class TestCleanResponse:
    def test_stripe_session_json_becomes_clean(self):
        out = clean_response(RAW_SESSION)
        assert out == "paid · complete — pi_1TuHZabc123"
        assert "{" not in out and "account_settings" not in out

    def test_error_json_shows_message(self):
        out = clean_response('{"error":{"code":"card_declined","message":"Your card was declined."}}')
        assert out == "Your card was declined."

    def test_plain_string_preserved(self):
        assert clean_response("succeeded — pm_1Tlscm2StuRr0IbXpmM7ucwn") == "succeeded — pm_1Tlscm2StuRr0IbXpmM7ucwn"

    def test_empty(self):
        assert clean_response(None) == "—"
        assert clean_response("") == "—"

    def test_long_plain_capped(self):
        out = clean_response("x" * 500)
        assert len(out) <= 160 and out.endswith("...")

    def test_dict_input(self):
        import json
        out = clean_response(json.loads(RAW_SESSION))
        assert out == "paid · complete — pi_1TuHZabc123"


class TestFormatHitOwner:
    def test_owner_flag_shows_OWNER(self):
        u = {"telegram_username": "CARAXSS", "plan": "MONTHLY", "telegram_id": 5762701937, "is_owner": True}
        assert "@CARAXSS (OWNER)" in format_hit(_hit(), u)

    def test_admin_flag_shows_OWNER(self):
        u = {"telegram_username": "CARAXSS", "plan": "YEARLY", "telegram_id": 1, "is_admin": True}
        assert "(OWNER)" in format_hit(_hit(), u)

    def test_normal_user_shows_plan(self):
        u = {"telegram_username": "bob", "plan": "MONTHLY", "telegram_id": 2}
        out = format_hit(_hit(), u)
        assert "@bob (MONTHLY)" in out
        assert "OWNER" not in out

    def test_banned_shows_dead(self):
        u = {"telegram_username": "bob", "plan": "MONTHLY", "telegram_id": 2, "is_banned": True}
        assert "(*Dead*)" in format_hit(_hit(), u)

    def test_response_is_clean_in_message(self):
        u = {"telegram_username": "bob", "plan": "MONTHLY", "telegram_id": 2}
        out = format_hit(_hit(), u)
        assert "paid · complete — pi_1TuHZabc123" in out
        assert "account_settings" not in out


class TestPublicShowcase:
    def test_username_clickable_link(self):
        u = {"telegram_username": "CARAXSS", "telegram_id": 5762701937}
        out = format_public_showcase(_hit(), u)
        assert "CARAXSS" in out
        assert 'href="https://t.me/CARAXSS"' in out

    def test_clickable_by_id_when_no_username(self):
        u = {"telegram_first_name": "Kobe", "telegram_id": 999}
        out = format_public_showcase(_hit(), u)
        assert 'href="tg://user?id=999"' in out and "Kobe" in out

    def test_charged_template(self):
        u = {"telegram_username": "Mugiwara", "telegram_id": 9}
        h = _hit(status="charged", gateway="stripe_checkout", amount=20.0, currency="usd")
        out = format_public_showcase(h, u)
        assert "「" in out and "STRIPE HITTER" in out
        assert "User ❝" in out and "Mugiwara" in out
        assert "CHARGED ✅" in out
        assert "USD 20.00" in out
        assert "Payment successful" in out  # friendly response for charged
        assert "account_settings" not in out
        assert "𝗕𝗼𝘁 𝗯𝘆 𝗡𝗲𝗽𝗮𝗹𝗶 𝗕𝗵𝗮𝗶" in out
        assert "@SEMEXHITSBOT" in out

    def test_live_shows_decline_reason(self):
        u = {"telegram_username": "Mugiwara", "telegram_id": 9}
        h = _hit(status="live", gateway="stripe", response="Incorrect CVC")
        out = format_public_showcase(h, u)
        assert "LIVE 🔥" in out
        assert "Incorrect CVC" in out
        assert "Payment successful" not in out

    def test_live_includes_amount_when_present(self):
        u = {"telegram_username": "Mugiwara", "telegram_id": 9}
        h = _hit(status="live", gateway="stripe", amount=14.5, currency="usd")
        out = format_hit(h, u, admin_view=True)
        assert "LIVE 🔥" in out
        assert "USD 14.5" in out

    def test_live_without_amount_omits_amount(self):
        u = {"telegram_username": "Mugiwara", "telegram_id": 9}
        h = _hit(status="live", gateway="stripe", amount=None, currency=None)
        out = format_hit(h, u, admin_view=True)
        assert "LIVE 🔥" in out
        assert "USD None" not in out
        assert "None" not in out.split("LIVE 🔥")[1].split("\n")[0]

