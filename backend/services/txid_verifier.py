"""On-chain TxID verifier for USDT wallet transfers.

Uses only PUBLIC, FREE, keyless endpoints — no API registration required:

  TRC20 (TRON)  — Tronscan public REST API   https://apilist.tronscan.org
  BEP20 (BSC)   — BSC public JSON-RPC node   https://bsc-dataseed.binance.org
                  (official node maintained by Binance — always free)

Returns True when the transaction is confirmed and transfers at least the
expected plan amount of USDT to the owner's configured wallet address (±1%).
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

# ERC-20 / BEP-20 Transfer(address,address,uint256) event signature
_TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"

# TRC20 tx hashes: 64 hex chars, NO 0x prefix
# BEP20 tx hashes: 66 chars starting with 0x
_RE_BEP20 = re.compile(r"^0x[0-9a-fA-F]{64}$")
_RE_TRC20 = re.compile(r"^[0-9a-fA-F]{64}$")

# Expected USDT amounts per plan
_PLAN_AMOUNTS: dict[str, float] = {
    "group_weekly":  25.0,
    "group_2week":   38.0,
    "group_monthly": 50.0,
}

# Public RPC endpoints — maintained by Binance, always free, no key
_BSC_RPC_URLS = [
    "https://bsc-dataseed.binance.org/",
    "https://bsc-dataseed1.binance.org/",
    "https://bsc-dataseed2.binance.org/",
]


def detect_chain(txid: str) -> str | None:
    """Return 'bep20', 'trc20', or None based on TxID format."""
    t = txid.strip()
    if _RE_BEP20.match(t):
        return "bep20"
    if _RE_TRC20.match(t):
        return "trc20"
    return None


def looks_like_txid(text: str) -> bool:
    """Quick check: does this string look like a blockchain transaction hash?"""
    t = text.strip()
    return bool(_RE_BEP20.match(t) or _RE_TRC20.match(t))


# ─── TRC20 via Tronscan public API (free, no key) ─────────────────────────────

async def _verify_trc20(txid: str, expected_to: str, expected_amount: float) -> bool:
    url = f"https://apilist.tronscan.org/api/transaction-info?hash={txid}"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(url, headers={"User-Agent": "SEMEX/1.0"})
            if r.status_code != 200:
                log.warning("tronscan: HTTP %s for %s", r.status_code, txid[:16])
                return False
            data = r.json()

        if not data.get("confirmed"):
            log.info("txid_verifier: TRC20 tx %s not yet confirmed", txid[:16])
            return False

        for transfer in data.get("trc20TransferInfo", []):
            contract  = transfer.get("contract_address", "")
            to_addr   = transfer.get("to_address", "")
            # USDT on TRC20 has 6 decimals; Tronscan returns amount_str in sun
            raw       = transfer.get("amount_str") or transfer.get("amount", "0")
            amount    = float(raw) / 1_000_000

            if (
                contract.lower() == _USDT_TRC20_CONTRACT.lower()
                and to_addr.lower() == expected_to.lower()
                and amount >= expected_amount * 0.99
            ):
                log.info("txid_verifier: TRC20 ✓ %.2f USDT → %s", amount, to_addr[:12])
                return True

        log.info("txid_verifier: TRC20 tx found but no matching USDT transfer")
    except httpx.HTTPError as e:
        log.warning("txid_verifier: tronscan network error: %s", e)
    except Exception as e:
        log.exception("txid_verifier: TRC20 error: %s", e)
    return False


# ─── BEP20 via Binance public BSC RPC (free, no key, no registration) ─────────

async def _rpc_call(method: str, params: list) -> dict | None:
    """Send a JSON-RPC call to the public BSC node. Tries all fallback URLs."""
    payload = {"jsonrpc": "2.0", "id": 1, "method": method, "params": params}
    last_err = None
    for url in _BSC_RPC_URLS:
        try:
            async with httpx.AsyncClient(timeout=12) as client:
                r = await client.post(url, json=payload,
                                      headers={"Content-Type": "application/json",
                                               "User-Agent": "SEMEX/1.0"})
                data = r.json()
                if "error" in data:
                    log.warning("bsc_rpc: %s returned error: %s", url, data["error"])
                    continue
                return data.get("result")
        except httpx.HTTPError as e:
            last_err = e
            continue
        except Exception as e:
            last_err = e
            continue
    log.warning("txid_verifier: all BSC RPC endpoints failed: %s", last_err)
    return None


async def _verify_bep20(txid: str, expected_to: str, expected_amount: float) -> bool:
    # Step 1: get the transaction receipt
    receipt = await _rpc_call("eth_getTransactionReceipt", [txid])
    if receipt is None:
        log.info("txid_verifier: BEP20 tx %s not found / pending", txid[:16])
        return False

    # status "0x1" = success
    if receipt.get("status") != "0x1":
        log.info("txid_verifier: BEP20 tx %s failed on-chain", txid[:16])
        return False

    usdt_lower = _USDT_BEP20_CONTRACT.lower()
    to_lower   = expected_to.lower()

    for log_entry in receipt.get("logs", []):
        # Only look at events emitted by the USDT contract
        if log_entry.get("address", "").lower() != usdt_lower:
            continue
        topics = log_entry.get("topics", [])
        if not topics or topics[0].lower() != _TRANSFER_TOPIC:
            continue
        if len(topics) < 3:
            continue

        # topics[1] = from (zero-padded 32 bytes), topics[2] = to
        recipient = "0x" + topics[2][-40:]
        data_hex  = log_entry.get("data", "0x") or "0x"
        try:
            raw_value = int(data_hex, 16)
        except ValueError:
            continue

        # BEP20 USDT has 18 decimals
        amount = raw_value / 1e18

        if recipient.lower() == to_lower and amount >= expected_amount * 0.99:
            log.info("txid_verifier: BEP20 ✓ %.2f USDT → %s", amount, recipient[:12])
            return True

    log.info("txid_verifier: BEP20 tx found but no matching USDT Transfer to our address")
    return False


# ─── Public entry point ───────────────────────────────────────────────────────

async def verify_txid(txid: str, product: str) -> tuple[bool, str]:
    """Verify a transaction hash for the given product plan.

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
