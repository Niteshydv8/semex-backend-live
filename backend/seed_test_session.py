"""Seed a test user + active session and print a valid access/refresh token.

Used ONLY for automated backend testing (OTP login needs real Telegram, which
cannot be automated). Creates a NON-admin test user with a far-future plan so
authenticated endpoints work. Telegram DM forwards will fail gracefully for this
fake telegram_id, which is fine — we only assert DB persistence + endpoint logic.

Run: python seed_test_session.py
"""
from __future__ import annotations

import asyncio
import secrets
from datetime import datetime, timedelta, timezone

import motor.motor_asyncio

from config import settings
from security import create_access_token, create_refresh_token, generate_redeem_code, hash_redeem_code, preview_redeem_code

TEST_TELEGRAM_ID = 999000111
TEST_FINGERPRINT = "test-fp-000000000000000000000000000000"


async def main() -> None:
    client = motor.motor_asyncio.AsyncIOMotorClient(settings.MONGO_URL)
    db = client[settings.DB_NAME]
    now = datetime.now(timezone.utc)

    # NOTE: plan_expires_at is set to the PAST so we can verify the catch-22 fix
    # (an expired user must still get a valid session + be able to redeem).
    await db.users.update_one(
        {"telegram_id": TEST_TELEGRAM_ID},
        {
            "$set": {
                "telegram_id": TEST_TELEGRAM_ID,
                "telegram_username": "semex_tester",
                "telegram_first_name": "SEMEX",
                "telegram_last_name": "Tester",
                "plan": "TRIAL",
                "plan_expires_at": now - timedelta(days=1),
                "is_admin": False,
                "is_banned": False,
                "last_seen_at": now,
            },
            "$setOnInsert": {"created_at": now, "hit_count": 0, "charged_count": 0},
        },
        upsert=True,
    )

    session_id = secrets.token_urlsafe(24)
    await db.sessions.insert_one(
        {
            "session_id": session_id,
            "telegram_id": TEST_TELEGRAM_ID,
            "fingerprint": TEST_FINGERPRINT,
            "device_info": {"ua": "backend-test"},
            "created_at": now,
            "last_used_at": now,
            "expires_at": now + timedelta(days=60),
            "revoked": False,
        }
    )

    access = create_access_token(session_id, TEST_TELEGRAM_ID, TEST_FINGERPRINT)
    refresh = create_refresh_token(session_id, TEST_TELEGRAM_ID, TEST_FINGERPRINT)

    # Insert a fresh, unused redeem code (same path the admin uses) for redeem test.
    code = generate_redeem_code("SEMEX")
    await db.redeem_codes.insert_one(
        {
            "code_hash": hash_redeem_code(code),
            "code_preview": preview_redeem_code(code),
            "duration_days": 30,
            "plan_tag": "MONTHLY",
            "created_by": 0,
            "created_at": now,
            "used": False,
        }
    )

    print("=== SEMEX TEST SESSION ===")
    print(f"TELEGRAM_ID={TEST_TELEGRAM_ID}")
    print(f"FINGERPRINT={TEST_FINGERPRINT}")
    print(f"SESSION_ID={session_id}")
    print(f"ACCESS_TOKEN={access}")
    print(f"REFRESH_TOKEN={refresh}")
    print(f"REDEEM_CODE={code}")
    print("PLAN_STATE=expired (plan_expires_at is in the past)")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
