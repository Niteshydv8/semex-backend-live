"""Standalone end-to-end test for the /buy → /paid → /sendlink payment flow.

Runs without a real MongoDB or Telegram token by patching env vars and
mocking every outbound I/O call.  Covers all four "Done looks like" criteria:

  1. /buy renders the offer with all 3 wallet addresses as <code> blocks
  2. /paid + photo → proof forwarded to owner with /sendlink hint in caption
  3. /sendlink (owner) → DMs invite; /sendlink (non-owner) → silently ignored
  4. /buy with PLAN_PRICE_YEARLY="" → yearly line hidden
"""
from __future__ import annotations

import asyncio
import os
import sys
import time
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

# ─── Patch env vars BEFORE any project import ───────────────────────────────
_FAKE_ENV = {
    "MONGO_URL": "mongodb://localhost:27017",
    "DB_NAME": "semex_test",
    "TELEGRAM_BOT_TOKEN": "1111111111:FAKE_TOKEN_FOR_TESTING",
    "TELEGRAM_BOT_USERNAME": "SemexTestBot",
    "ADMIN_TELEGRAM_ID": "9876543210",
    "ADMIN_LOG_CHANNEL_ID": "-100000000001",
    "JWT_SECRET": "fake_jwt_secret_for_testing_only",
    "HMAC_SECRET": "fake_hmac_secret_for_testing_only",
    "PAYMENT_USDT_BEP20": "0xb1ab479abe81d6be059d5bb9d55a6e8d99b64bfd",
    "PAYMENT_USDT_TRC20": "TCn8eNownsyUzMeHNMeUpzXJFDruCWYr5w",
    "PAYMENT_USDT_TON": "UQAmwQDBLUHsSZI3SiKTDwSnvte-Y8MkwoDvzHzOGa-3xk68",
    "PLAN_PRICE_MONTHLY": "$180",
    "PLAN_PRICE_YEARLY": "",     # ← empty; yearly line must be hidden
    "PLAN_PRICE_LIFETIME": "$900",
    "GROUP_PRICE_WEEKLY": "$29",
    "GROUP_PRICE_MONTHLY": "$59",
    "PREMIUM_GROUP_LINK": "https://t.me/+FakePrivateGroupLink",
    "OWNER_HANDLE": "TestOwner",
    "TELEGRAM_WEBHOOK_SECRET": "",
}
for k, v in _FAKE_ENV.items():
    os.environ.setdefault(k, v)

# ─── Make backend importable ─────────────────────────────────────────────────
BACKEND_DIR = Path(__file__).parent
sys.path.insert(0, str(BACKEND_DIR))

# Stub out the DB layer entirely so no real Mongo connection is attempted
import types
_fake_db_module = types.ModuleType("db")
async def _fake_get_db():
    raise RuntimeError("DB must not be called in payment-flow unit tests")
_fake_db_module.get_db = _fake_get_db
sys.modules["db"] = _fake_db_module

# Stub motor / pymongo so nothing tries to resolve mongodb://
for _m in ("motor", "motor.motor_asyncio", "pymongo", "pymongo.errors"):
    if _m not in sys.modules:
        sys.modules[_m] = types.ModuleType(_m)
        if _m == "pymongo.errors":
            sys.modules[_m].DuplicateKeyError = Exception

# Now import the bot module (config will load from env vars we set above)
import routes.telegram_bot as bot  # noqa: E402
from config import settings         # noqa: E402

ADMIN_ID = settings.ADMIN_TELEGRAM_ID   # 9876543210


# ─── Helpers ─────────────────────────────────────────────────────────────────

def run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


PASS = "\033[32mPASS\033[0m"
FAIL = "\033[31mFAIL\033[0m"
_results: list[tuple[str, bool, str]] = []


def check(name: str, condition: bool, detail: str = ""):
    icon = PASS if condition else FAIL
    print(f"  {icon}  {name}" + (f"\n        {detail}" if detail and not condition else ""))
    _results.append((name, condition, detail))


# ─── Scenario 1: /buy → all 3 USDT addresses in <code> blocks ───────────────

print("\n── Scenario 1: /buy renders all 3 wallet addresses as <code> blocks ──")

captured_buy: list[str] = []

async def fake_send_buy(chat_id, text, **kw):
    captured_buy.append(text)
    return {"ok": True}

with patch.object(bot, "send_message", fake_send_buy):
    run(bot._cmd_buy(chat_id=11111, username="testbuyer"))

check("send_message called once", len(captured_buy) == 1)
body = captured_buy[0] if captured_buy else ""
check("BEP20 address in <code> block",
      "<code>0xb1ab479abe81d6be059d5bb9d55a6e8d99b64bfd</code>" in body)
check("TRC20 address in <code> block",
      "<code>TCn8eNownsyUzMeHNMeUpzXJFDruCWYr5w</code>" in body)
check("TON address in <code> block",
      "<code>UQAmwQDBLUHsSZI3SiKTDwSnvte-Y8MkwoDvzHzOGa-3xk68</code>" in body)
check("BEP20 network label present", "BEP20" in body)
check("TRC20 network label present", "TRC20" in body)
check("TON network label present", "TON" in body)
check("/paid instruction present", "/paid" in body)
check("group weekly price $29", "$29" in body)
check("group monthly price $59", "$59" in body)


# ─── Scenario 2: PLAN_PRICE_YEARLY="" → yearly line hidden ──────────────────

print("\n── Scenario 2: /buy with empty PLAN_PRICE_YEARLY hides YEARLY line ──")

check("PLAN_PRICE_YEARLY setting is empty",
      (getattr(settings, "PLAN_PRICE_YEARLY", "") or "").strip() == "")
check("YEARLY line absent from /buy output", "YEARLY" not in body)
check("MONTHLY line still present", "MONTHLY" in body)
check("LIFETIME line still present", "LIFETIME" in body)


# ─── Scenario 3: /paid → photo intake → proof forwarded to owner ────────────

print("\n── Scenario 3: /paid → photo → proof forwarded to owner ──")

bot._PROOF_STATE.clear()

# 3a: /paid puts user into proof mode
captured_paid: list[str] = []
async def fake_send_paid(chat_id, text, **kw):
    captured_paid.append(text)
    return {"ok": True}

with patch.object(bot, "send_message", fake_send_paid):
    run(bot._cmd_paid(chat_id=22222, username="buyer99", telegram_id=22222))

check("/paid sets proof state", 22222 in bot._PROOF_STATE)
check("/paid stores username", bot._PROOF_STATE.get(22222, {}).get("username") == "buyer99")
check("/paid ack mentions 30 minutes",
      any("30 minutes" in t for t in captured_paid))

# 3b: Photo message → forwarded to owner with /sendlink hint
copy_calls: list[dict] = []
send_calls: list[str] = []

async def fake_copy(to_chat_id, from_chat_id, message_id, caption=None, **kw):
    copy_calls.append({"to": to_chat_id, "from": from_chat_id,
                        "msg_id": message_id, "caption": caption})
    return {"ok": True}

async def fake_send_confirm(chat_id, text, **kw):
    send_calls.append(text)
    return {"ok": True}

with patch.object(bot, "copy_message", fake_copy), \
     patch.object(bot, "send_message", fake_send_confirm):
    run(bot._forward_proof_to_owner(
        chat_id=22222,
        user_message_id=555,
        photo_caption="MONTHLY — txhash 0xabc",
    ))

check("copy_message called once (photo copied to owner)", len(copy_calls) == 1)
if copy_calls:
    cap = copy_calls[0]["caption"] or ""
    check("owner received admin caption with NEW PROOF header",
          "NEW PROOF OF PAYMENT" in cap)
    check("admin caption has buyer username",
          "@buyer99" in cap)
    check("admin caption has telegram_id", "22222" in cap)
    check("admin caption contains /sendlink hint",
          "/sendlink" in cap and "22222" in cap)
    check("admin caption has user note (txhash)",
          "MONTHLY" in cap or "txhash" in cap)
    check("photo sent to ADMIN_TELEGRAM_ID",
          copy_calls[0]["to"] == ADMIN_ID)
    check("photo copied from user's chat",
          copy_calls[0]["from"] == 22222)
check("user received confirmation DM", any("Proof received" in t for t in send_calls))
check("proof state cleared after forwarding (single-use)", 22222 not in bot._PROOF_STATE)


# ─── Scenario 4a: /sendlink — owner sends invite to buyer ───────────────────

print("\n── Scenario 4a: /sendlink (owner) → DMs invite to buyer ──")

target_user_id = 33333
sendlink_sends: list[tuple[int, str]] = []

async def fake_send_link(chat_id, text, **kw):
    sendlink_sends.append((chat_id, text))
    return {"ok": True}

with patch.object(bot, "send_message", fake_send_link):
    run(bot._cmd_sendlink(
        chat_id=ADMIN_ID,            # owner's chat
        from_user_id=ADMIN_ID,       # owner's user id
        args=[str(target_user_id)],  # /sendlink 33333
    ))

check("owner /sendlink sends 2 messages (DM + confirm)",
      len(sendlink_sends) == 2, f"got {len(sendlink_sends)} send calls")

dm_to_buyer = [t for cid, t in sendlink_sends if cid == target_user_id]
confirm_to_owner = [t for cid, t in sendlink_sends if cid == ADMIN_ID]

check("invite DM sent to buyer's chat_id", len(dm_to_buyer) == 1)
if dm_to_buyer:
    check("invite DM contains the premium group link",
          settings.PREMIUM_GROUP_LINK in dm_to_buyer[0])
    check("invite DM mentions payment confirmed",
          "confirmed" in dm_to_buyer[0].lower() or "welcome" in dm_to_buyer[0].lower())

check("owner receives delivery confirmation", len(confirm_to_owner) == 1)
if confirm_to_owner:
    check("confirm mentions target user id",
          str(target_user_id) in confirm_to_owner[0])


# ─── Scenario 4b: /sendlink — non-owner is silently ignored ─────────────────

print("\n── Scenario 4b: /sendlink (non-owner) → silently ignored ──")

non_owner_sends: list = []

async def fake_send_nonowner(chat_id, text, **kw):
    non_owner_sends.append((chat_id, text))
    return {"ok": True}

with patch.object(bot, "send_message", fake_send_nonowner):
    run(bot._cmd_sendlink(
        chat_id=99999,            # non-owner chat
        from_user_id=99999,       # non-owner user id
        args=["33333"],
    ))

check("non-owner /sendlink sends nothing at all (silent ignore)",
      len(non_owner_sends) == 0,
      f"got {len(non_owner_sends)} unexpected send calls: {non_owner_sends}")


# ─── Scenario 4c: /sendlink with no args → usage hint to owner ─────────────

print("\n── Scenario 4c: /sendlink with no target_id → usage hint ──")

usage_sends: list[str] = []

async def fake_send_usage(chat_id, text, **kw):
    usage_sends.append(text)
    return {"ok": True}

with patch.object(bot, "send_message", fake_send_usage):
    run(bot._cmd_sendlink(
        chat_id=ADMIN_ID,
        from_user_id=ADMIN_ID,
        args=[],  # no arguments
    ))

check("empty /sendlink sends usage hint to owner",
      len(usage_sends) == 1 and "Usage" in (usage_sends[0] if usage_sends else ""),
      f"sends: {usage_sends}")


# ─── Scenario 4d: /sendlink with missing PREMIUM_GROUP_LINK ─────────────────

print("\n── Scenario 4d: /sendlink with no configured group link → warning ──")

no_link_sends: list[str] = []

async def fake_send_nolink(chat_id, text, **kw):
    no_link_sends.append(text)
    return {"ok": True}

_orig_link = settings.PREMIUM_GROUP_LINK
settings.PREMIUM_GROUP_LINK = ""  # temporarily unset

with patch.object(bot, "send_message", fake_send_nolink):
    run(bot._cmd_sendlink(
        chat_id=ADMIN_ID,
        from_user_id=ADMIN_ID,
        args=["33333"],
    ))

settings.PREMIUM_GROUP_LINK = _orig_link  # restore

check("missing group link → warning sent to owner",
      len(no_link_sends) == 1 and "PREMIUM_GROUP_LINK" in (no_link_sends[0] if no_link_sends else ""),
      f"sends: {no_link_sends}")


# ─── Scenario 5: proof-mode expires after 30 min ────────────────────────────

print("\n── Scenario 5: expired proof state is silently ignored ──")

bot._PROOF_STATE.clear()
# Inject an already-expired entry (timestamp 31 minutes ago)
bot._PROOF_STATE[44444] = {"ts": time.time() - 31 * 60, "username": "late", "telegram_id": 44444}

expired_copy_calls: list = []
expired_send_calls: list = []

async def _fake_copy_expired(*a, **kw):
    expired_copy_calls.append(1)
async def _fake_send_expired(*a, **kw):
    expired_send_calls.append(1)

with patch.object(bot, "copy_message", _fake_copy_expired), \
     patch.object(bot, "send_message", _fake_send_expired):
    run(bot._forward_proof_to_owner(
        chat_id=44444,
        user_message_id=777,
        photo_caption="late proof",
    ))

check("expired proof: copy_message NOT called", len(expired_copy_calls) == 0)
check("expired proof: send_message NOT called", len(expired_send_calls) == 0)

bot._PROOF_STATE.clear()


# ─── Summary ─────────────────────────────────────────────────────────────────

print()
total = len(_results)
passed = sum(1 for _, ok, _ in _results if ok)
failed = total - passed

print("=" * 58)
print(f"  Results: {passed}/{total} passed" + (f"  ({failed} FAILED)" if failed else "  ✓ All passed"))
print("=" * 58)

if failed:
    print("\nFailed checks:")
    for name, ok, detail in _results:
        if not ok:
            print(f"  ✗ {name}" + (f"\n    {detail}" if detail else ""))
    sys.exit(1)
else:
    sys.exit(0)
