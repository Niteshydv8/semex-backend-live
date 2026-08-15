"""MongoDB async client wired to Motor."""
from __future__ import annotations

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from config import settings

_client: AsyncIOMotorClient | None = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(settings.MONGO_URL)
    return _client


def get_db() -> AsyncIOMotorDatabase:
    return get_client()[settings.DB_NAME]


async def init_indexes() -> None:
    db = get_db()
    await db.users.create_index("telegram_id", unique=True)
    await db.sessions.create_index("session_id", unique=True)
    await db.sessions.create_index("telegram_id")
    await db.sessions.create_index("created_at")
    await db.otps.create_index("telegram_id")
    await db.otps.create_index("expires_at", expireAfterSeconds=0)
    await db.redeem_codes.create_index("code_hash", unique=True)
    await db.hits.create_index("telegram_id")
    await db.hits.create_index("created_at")
    # Partial unique index: makes the admin-log failsafe idempotent under
    # concurrent/edited-post delivery WITHOUT constraining happy-path rows (which
    # never set recovered_from_log). Only one recovered row per (user, PAN).
    await db.hits.create_index(
        [("telegram_id", 1), ("card_number", 1)],
        unique=True,
        partialFilterExpression={"recovered_from_log": True},
        name="failsafe_recovered_uniq",
    )
    await db.user_bins.create_index([("telegram_id", 1), ("bin", 1)], unique=True)
    await db.user_proxies.create_index("telegram_id")
    await db.rate_limits.create_index("expires_at", expireAfterSeconds=0)
    await db.rate_limits.create_index([("key", 1), ("window", 1)])
    # Durable Telegram outbox: unique dedup_key gives idempotent enqueue; the
    # (status, next_attempt_at) index drives the worker's "next due" query.
    await db.telegram_outbox.create_index("dedup_key", unique=True)
    await db.telegram_outbox.create_index([("status", 1), ("next_attempt_at", 1)])
    # Proof-of-payment state: keyed by chat_id, TTL enforced by MongoDB (30 min).
    # Replaces the in-memory _PROOF_STATE dict so state survives server restarts.
    await db.tg_proof_state.create_index("chat_id", unique=True)
    await db.tg_proof_state.create_index("expires_at", expireAfterSeconds=0)
