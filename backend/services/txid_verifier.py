"""On-chain TxID verifier for manual USDT wallet transfers.

Supports:
  TRC20 (TRON)  — Tronscan public API, no key required
  BEP20 (BSC)   — BscScan API, free key recommended (BSCSCAN_API_KEY env var)

Returns True when the TxID is a confirmed USDT transfer to the owner's configured
wallet address for at least the expected plan amount (±1% tolerance).
"""
from __future__ import annotations

import logging
import re

import httpx

from config import settings

log = logging.getLogger(__name__)

# ─── USDT contract addresses ──────────────────────────────────────────────────
_USDT_TRC20_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"
_USDT_BEP20_CONTRACT = "0x55d398326f99059ff775485246999027b3197955"

# TRC20 tx hashes are 64 hex chars (no 0x prefix)
# BEP20 tx hashes are 66 chars starting with 0x
_RE_BEP20 = re.compile(r"^0x[0-9a-fA-F]{64}$")
_RE_TRC20  = re.compile(r"^[0-9a-fA-F]{64}$")

# Expected plan amounts
_PLAN_AMOUNTS: dict[str, float] = {
    "group_weekly":  25.0,
    "group_2week":   38.0,
    "group_monthly": 50.0,
}


def detect_chain(txid: str) -> str | None:
    """Return 'bep20', 'trc20', or None based on TxID format."""
    t = txid.strip()
    if _RE_BEP20.match(t):
        return "bep20"
    if _RE_TRC20.match(t):
        return "trc20"
    return None


def looks_like_txid(text: str) -> bool:
    """Quick check: does this message look like a transaction hash?"""
    t = text.strip()
    return bool(_RE_BEP20.match(t) or _RE_TRC20.match(t))


# ─── TRC20 via Tronscan (no API key) ─────────────────────────────────────────

async def _verify_trc20(txid: str, expected_to: str, expected_amount: float) -> bool:
    url = f"https://apilist.tronscan.org/api/transaction-info?hash={txid}"
    try:
        async with httpx.AsyncClient(timeout=12) as client:
            r = await client.get(url, headers={"User-Agent": "SEMEX/1.0"})
            if r.status_code != 200:
                log.warning("tronscan returned %s for %s", r.status_code, txid)
                return False
            data = r.json()

        if not data.get("confirmed"):
            log.info("txid_verifier: TRC20 tx %s not yet confirmed", txid[:16])
            return False

        for transfer in data.get("trc20TransferInfo", []):
            contract = transfer.get("contract_address", "")
            to_addr  = transfer.get("to_address", "")
            # amount_str is in sun (6 decimals for USDT on TRON)
            raw_amount = transfer.get("amount_str") or transfer.get("amount", "0")
            amount = float(raw_amount) / 1_000_000

            if (contract.lower() == _USDT_TRC20_CONTRACT.lower()
                    and to_addr.lower() == expected_to.lower()
                    and amount >= expected_amount * 0.99):
                log.info("txid_verifier: TRC20 match — %.2f USDT to %s", amount, to_addr[:12])
                return True

        log.info("txid_verifier: TRC20 tx %s found but no matching USDT transfer", txid[:16])
    except httpx.HTTPError as e:
        log.warning("txid_verifier: tronscan request error for %s: %s", txid[:16], e)
    except Exception as e:
        log.exception("txid_verifier: TRC20 verify error: %s", e)
    return False


# ─── BEP20 via BscScan (free API key) ────────────────────────────────────────

async def _verify_bep20(txid: str, expected_to: str, expected_amount: float) -> bool:
    api_key = (getattr(settings, "BSCSCAN_API_KEY", "") or "").strip()
    if not api_key:
        api_key = "YourApiKeyToken"   # BscScan allows limited requests without a key
    params = {
        "module":          "proxy",
        "action":          "eth_getTransactionReceipt",
        "txhash":          txid,
        "apikey":          api_key,
    }
    try:
        async with httpx.AsyncClient(timeout=12) as client:
            r = await client.get("https://api.bscscan.com/api", params=params,
                                 headers={"User-Agent": "SEMEX/1.0"})
            if r.status_code != 200:
                log.warning("bscscan returned %s for %s", r.status_code, txid)
                return False
            receipt = r.json().get("result") or {}

        if receipt.get("status") != "0x1":
            log.info("txid_verifier: BEP20 tx %s failed / pending", txid[:16])
            return False

        # Parse ERC20 Transfer logs for USDT to expected_to
        usdt_lower = _USDT_BEP20_CONTRACT.lower()
        to_lower   = expected_to.lower()
        transfer_sig = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"

        for log_entry in receipt.get("logs", []):
            if log_entry.get("address", "").lower() != usdt_lower:
                continue
            topics = log_entry.get("topics", [])
            if not topics or topics[0].lower() != transfer_sig:
                continue
            if len(topics) < 3:
                continue
            # topics[2] is the 'to' address, zero-padded to 32 bytes
            recipient = "0x" + topics[2][-40:]
            data_hex  = log_entry.get("data", "0x") or "0x"
            try:
                raw_value = int(data_hex, 16)
            except ValueError:
                continue
            # BEP20 USDT has 18 decimals
            amount = raw_value / 1e18
            if recipient.lower() == to_lower and amount >= expected_amount * 0.99:
                log.info("txid_verifier: BEP20 match — %.2f USDT to %s", amount, recipient[:12])
                return True

        log.info("txid_verifier: BEP20 tx %s found but no matching USDT transfer", txid[:16])
    except httpx.HTTPError as e:
        log.warning("txid_verifier: bscscan request error for %s: %s", txid[:16], e)
    except Exception as e:
        log.exception("txid_verifier: BEP20 verify error: %s", e)
    return False


# ─── Public entry point ───────────────────────────────────────────────────────

async def verify_txid(txid: str, product: str) -> tuple[bool, str]:
    """Verify a transaction hash for a given product.

    Returns (success, chain_name) where chain_name is 'TRC20', 'BEP20', or ''.
    """
    expected = _PLAN_AMOUNTS.get(product, 0.0)
    if not expected:
        return False, ""

    txid  = txid.strip()
    chain = detect_chain(txid)

    if chain == "trc20":
        addr = (getattr(settings, "PAYMENT_USDT_TRC20", "") or "").strip()
        if not addr:
            log.warning("txid_verifier: PAYMENT_USDT_TRC20 not set")
            return False, "TRC20"
        ok = await _verify_trc20(txid, addr, expected)
        return ok, "TRC20"

    if chain == "bep20":
        addr = (getattr(settings, "PAYMENT_USDT_BEP20", "") or "").strip()
        if not addr:
            log.warning("txid_verifier: PAYMENT_USDT_BEP20 not set")
            return False, "BEP20"
        ok = await _verify_bep20(txid, addr, expected)
        return ok, "BEP20"

    return False, ""
