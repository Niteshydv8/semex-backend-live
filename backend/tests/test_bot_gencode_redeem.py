"""Integration: bot /gencode → admin codes list → bot /redeem round-trip.

Verifies the full path described in the task spec:
  - _cmd_gencode inserts 3 × 30-day MONTHLY codes into redeem_codes
  - GET /api/admin/codes reflects all 3 with correct preview / planTag /
    durationDays / used=false
  - _cmd_redeem successfully claims each code once; admin list then shows
    used=true + correct usedBy
  - A second /redeem attempt on any claimed code returns "already redeemed"

Design note: Motor (async MongoDB driver) keeps a global singleton client
bound to the event loop it was first used in. Running multiple asyncio.run()
calls in the same test would leave that client bound to a closed loop. We
work around this by resetting the global _client to None between asyncio.run()
calls, forcing Motor to create a fresh client on the next use.
"""
from __future__ import annotations

import asyncio
import re

import pytest
import requests

BASE_URL = "http://localhost:8001"


def _hdr(token: str) -> dict:
    return {
        "Authorization": f"Bearer {token}",
        "X-Fingerprint": "test-fp-000000000000000000000000000000",
        "X-Extension-Version": "9.9.9",
    }


def _reset_motor() -> None:
    """Force the Motor client singleton to reconnect on the next use.

    Motor's AsyncIOMotorClient binds its internal state to the event loop it
    was first created in. After asyncio.run() closes that loop the client is
    unusable. Resetting the global _client causes db.get_client() to create a
    fresh Motor client bound to the next event loop.
    """
    import db as db_module
    db_module._client = None


def _parse_codes(text: str) -> list[str]:
    """Extract SEMEX-XXXX-XXXX-XXXX codes from a bot message."""
    return re.findall(r"SEMEX-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}", text)


class TestBotGencodeRedeem:
    """Full round-trip: bot /gencode → admin list → bot /redeem → admin list (used)."""

    def _run_gencode(self, monkeypatch, owner_id: int, days: int, qty: int, note: str) -> list[str]:
        """Call _cmd_gencode and return the plaintext codes from the bot reply."""
        from routes import telegram_bot as tg

        sent: list[str] = []

        async def _fake_send(chat_id, text, **kw):
            sent.append(text)
            return {"ok": True, "result": {"message_id": 1}}

        monkeypatch.setattr(tg, "send_message", _fake_send)

        asyncio.run(tg._cmd_gencode(
            chat_id=owner_id,
            from_user_id=owner_id,
            args=[str(days), str(qty), note],
        ))
        _reset_motor()

        assert sent, "_cmd_gencode produced no Telegram message"
        codes = _parse_codes(sent[-1])
        assert len(codes) == qty, (
            f"Expected {qty} codes in gencode reply, found {codes!r}:\n{sent[-1]}"
        )
        return codes

    def _run_redeem(self, monkeypatch, tid: int, code: str) -> str:
        """Call _cmd_redeem for *tid* with *code* and return the bot reply text."""
        from routes import telegram_bot as tg

        sent: list[str] = []

        async def _fake_send(chat_id, text, **kw):
            sent.append(text)
            return {"ok": True, "result": {"message_id": 1}}

        monkeypatch.setattr(tg, "send_message", _fake_send)

        asyncio.run(tg._cmd_redeem(
            chat_id=tid,
            from_user_id=tid,
            args=[code],
        ))
        _reset_motor()

        assert sent, "_cmd_redeem produced no Telegram message"
        return sent[-1]

    # ── main test ──────────────────────────────────────────────────────────────

    def test_gencode_list_redeem_full_flow(
        self,
        monkeypatch,
        admin_by_id_user,   # HTTP token for /api/admin/* calls (owner)
        active_user,        # existing SEMEX user who will redeem the codes
        mongo_db,
    ):
        from config import settings
        from security import hash_redeem_code, preview_redeem_code

        owner_id = settings.ADMIN_TELEGRAM_ID
        redeem_tid = active_user["telegram_id"]
        codes: list[str] = []

        try:
            # ── 1. Generate 3 × 30-day MONTHLY codes via the bot ──────────────
            codes = self._run_gencode(monkeypatch, owner_id, days=30, qty=3, note="task119 test")
            assert len(codes) == 3

            # ── 2. Admin GET /api/admin/codes must list all 3 as unused ────────
            r = requests.get(
                f"{BASE_URL}/api/admin/codes?used=false&limit=500",
                headers=_hdr(admin_by_id_user["token"]),
                timeout=15,
            )
            assert r.status_code == 200, f"GET /api/admin/codes failed ({r.status_code}): {r.text}"

            all_entries = r.json()["codes"]
            by_preview = {entry["preview"]: entry for entry in all_entries}

            for code in codes:
                preview = preview_redeem_code(code)
                assert preview in by_preview, (
                    f"Code preview {preview!r} not found in admin codes list.\n"
                    f"Available previews: {list(by_preview)!r}"
                )
                entry = by_preview[preview]
                assert entry["durationDays"] == 30, (
                    f"durationDays should be 30, got {entry['durationDays']!r}: {entry}"
                )
                assert entry["planTag"] == "MONTHLY", (
                    f"planTag should be MONTHLY, got {entry['planTag']!r}: {entry}"
                )
                assert entry["used"] is False, (
                    f"Code should be unused at this point: {entry}"
                )

            # ── 3. Redeem all 3 codes via the bot ─────────────────────────────
            for i, code in enumerate(codes):
                reply = self._run_redeem(monkeypatch, redeem_tid, code)
                assert "redeemed successfully" in reply.lower() or "🎉" in reply, (
                    f"Expected success message for code #{i+1}, got: {reply!r}"
                )

            # ── 4. Admin list must now show all 3 as used ──────────────────────
            r2 = requests.get(
                f"{BASE_URL}/api/admin/codes?limit=500",
                headers=_hdr(admin_by_id_user["token"]),
                timeout=15,
            )
            assert r2.status_code == 200, (
                f"GET /api/admin/codes (after redeem) failed ({r2.status_code}): {r2.text}"
            )

            all_entries2 = r2.json()["codes"]
            by_preview2 = {entry["preview"]: entry for entry in all_entries2}

            for code in codes:
                preview = preview_redeem_code(code)
                assert preview in by_preview2, (
                    f"Code preview {preview!r} missing from admin list after redemption"
                )
                entry = by_preview2[preview]
                assert entry["used"] is True, (
                    f"Code should be used=true after redemption: {entry}"
                )
                assert entry["usedBy"] == redeem_tid, (
                    f"usedBy should be {redeem_tid}, got {entry['usedBy']!r}: {entry}"
                )
                assert entry["usedAt"] is not None, (
                    f"usedAt should be set after redemption: {entry}"
                )

            # ── 5. Duplicate redemption → "already redeemed" ──────────────────
            dup_reply = self._run_redeem(monkeypatch, redeem_tid, codes[0])
            assert "already redeemed" in dup_reply.lower(), (
                f"Expected 'already redeemed' on duplicate attempt, got: {dup_reply!r}"
            )

        finally:
            # Cleanup: remove the test codes regardless of pass/fail
            if codes:
                from security import hash_redeem_code
                hashes = [hash_redeem_code(c) for c in codes]
                mongo_db.redeem_codes.delete_many({"code_hash": {"$in": hashes}})
