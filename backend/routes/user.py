"""User-scoped routes — profile, settings, BINs, proxies, hit history, live SSE stream."""
from __future__ import annotations

import asyncio
import json as _json
from datetime import datetime, timezone
from typing import AsyncGenerator, List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from db import get_db
from deps import get_current_user
from deps import get_current_user_unlocked  # redeem-gate for locked Telegram signups
from models import User, UserBin, UserProxy, UserSettings
from services.sync import sync_manager

router = APIRouter(prefix="/api/user", tags=["user"])


@router.get("/me")
async def me(user: User = Depends(get_current_user_unlocked)):
    plan_exp = None
    if user.plan_expires_at:
        pe = user.plan_expires_at
        if pe.tzinfo is None:
            pe = pe.replace(tzinfo=timezone.utc)
        plan_exp = pe.isoformat()

    db = get_db()
    sessions = await db.sessions.count_documents(
        {"telegram_id": user.telegram_id, "revoked": False}
    )
    return {
        "telegramId": user.telegram_id,
        "username": user.telegram_username,
        "firstName": user.telegram_first_name,
        "lastName": user.telegram_last_name,
        "photoUrl": user.telegram_photo_url,
        "plan": user.plan,
        "planExpiresAt": plan_exp,
        "isAdmin": user.is_admin,
        "hitCount": user.hit_count,
        "chargedCount": user.charged_count,
        "activeDevices": sessions,
    }


@router.get("/settings")
async def get_settings(user: User = Depends(get_current_user_unlocked)):
    db = get_db()
    doc = await db.user_settings.find_one({"telegram_id": user.telegram_id})
    return {"settings": (doc or {}).get("settings", {})}


class SettingsBody(BaseModel):
    settings: dict


@router.post("/settings")
async def save_settings(body: SettingsBody, user: User = Depends(get_current_user_unlocked)):
    db = get_db()
    await db.user_settings.update_one(
        {"telegram_id": user.telegram_id},
        {
            "$set": {
                "settings": body.settings,
                "updated_at": datetime.now(timezone.utc),
            }
        },
        upsert=True,
    )
    sync_manager.publish(user.telegram_id, "settings")
    return {"success": True}


from services.bin_lookup import lookup_bin

# ---------- BINs ----------

@router.get("/bins")
async def list_bins(user: User = Depends(get_current_user_unlocked)):
    db = get_db()
    cursor = db.user_bins.find({"telegram_id": user.telegram_id}).sort("created_at", -1)
    out = []
    async for doc in cursor:
        out.append(
            {
                "id": str(doc["_id"]),
                "bin": doc["bin"],
                "label": doc.get("label"),
                "notes": doc.get("notes"),
                "expiry": doc.get("expiry"),
                "cvv": doc.get("cvv"),
                "brand": doc.get("brand"),
                "cardType": doc.get("card_type"),
                "level": doc.get("level"),
                "bank": doc.get("bank"),
                "country": doc.get("country"),
                "countryCode": doc.get("country_code"),
                "createdAt": doc["created_at"].isoformat() if doc.get("created_at") else None,
            }
        )
    return {"bins": out}


class BinBody(BaseModel):
    bin: str
    label: Optional[str] = None
    notes: Optional[str] = None
    expiry: Optional[str] = None   # MM/YY
    cvv: Optional[str] = None      # 3-4 digits


@router.post("/bins")
async def add_bin(body: BinBody, user: User = Depends(get_current_user_unlocked)):
    # Keep all digits — allow 6-19 digits (full card numbers welcome, not just 6-8 BIN prefixes).
    bin_clean = "".join(c for c in body.bin if c.isdigit())[:19]
    if len(bin_clean) < 6:
        raise HTTPException(400, "BIN must be at least 6 digits.")
    # Sanitize expiry / CVV
    expiry_clean = (body.expiry or "").strip()[:5] or None   # "MM/YY"
    cvv_clean = "".join(c for c in (body.cvv or "") if c.isdigit())[:4] or None

    # Auto-detect brand/type/level/bank/country using first 8 digits (BIN databases
    # only recognise 6–8 digit prefixes; longer numbers are trimmed inside lookup_bin).
    meta = {}
    try:
        m = await lookup_bin(bin_clean[:8])
        if m:
            meta = m
    except Exception:
        meta = {}

    db = get_db()
    try:
        b = UserBin(
            telegram_id=user.telegram_id,
            bin=bin_clean,
            label=body.label,
            notes=body.notes,
            expiry=expiry_clean,
            cvv=cvv_clean,
            brand=meta.get("brand"),
            card_type=meta.get("cardType"),
            level=meta.get("level"),
            bank=meta.get("bank"),
            country=meta.get("country"),
            country_code=meta.get("countryCode"),
        )
        await db.user_bins.insert_one(b.to_mongo())
    except Exception as e:
        # Unique constraint violation → already exists
        if "duplicate" in str(e).lower():
            raise HTTPException(400, "BIN already saved.")
        raise
    sync_manager.publish(user.telegram_id, "bins")
    return {
        "success": True,
        "bin": bin_clean,
        "meta": {
            "brand": meta.get("brand"),
            "cardType": meta.get("cardType"),
            "level": meta.get("level"),
            "bank": meta.get("bank"),
            "country": meta.get("country"),
            "countryCode": meta.get("countryCode"),
        },
    }


class BinPatchBody(BaseModel):
    label: Optional[str] = None
    notes: Optional[str] = None
    expiry: Optional[str] = None
    cvv: Optional[str] = None


@router.patch("/bins/{bin_id}")
async def update_bin(bin_id: str, body: BinPatchBody, user: User = Depends(get_current_user_unlocked)):
    """Rename, add notes, or update expiry/CVV on a saved BIN."""
    db = get_db()
    try:
        oid = ObjectId(bin_id)
    except Exception:
        raise HTTPException(400, "Bad id")
    updates = {}
    if body.label is not None: updates["label"] = body.label
    if body.notes is not None: updates["notes"] = body.notes
    if body.expiry is not None: updates["expiry"] = body.expiry.strip()[:5] or None
    if body.cvv is not None: updates["cvv"] = "".join(c for c in body.cvv if c.isdigit())[:4] or None
    if not updates:
        return {"success": True, "modified": 0}
    r = await db.user_bins.update_one(
        {"_id": oid, "telegram_id": user.telegram_id},
        {"$set": updates},
    )
    sync_manager.publish(user.telegram_id, "bins")
    return {"success": r.modified_count > 0}


@router.delete("/bins/{bin_id}")
async def delete_bin(bin_id: str, user: User = Depends(get_current_user_unlocked)):
    db = get_db()
    try:
        oid = ObjectId(bin_id)
    except Exception:
        raise HTTPException(400, "Bad id")
    r = await db.user_bins.delete_one({"_id": oid, "telegram_id": user.telegram_id})
    sync_manager.publish(user.telegram_id, "bins")
    return {"success": r.deleted_count > 0}


class BulkBinBody(BaseModel):
    bins: List[str]


@router.post("/bins/bulk")
async def add_bins_bulk(body: BulkBinBody, user: User = Depends(get_current_user_unlocked)):
    db = get_db()
    added, skipped = 0, 0
    for raw in body.bins:
        bin_clean = "".join(c for c in raw if c.isdigit())[:19]
        if len(bin_clean) < 6:
            skipped += 1
            continue
        try:
            b = UserBin(telegram_id=user.telegram_id, bin=bin_clean)
            await db.user_bins.insert_one(b.to_mongo())
            added += 1
        except Exception:
            skipped += 1
    if added:
        sync_manager.publish(user.telegram_id, "bins")
    return {"success": True, "added": added, "skipped": skipped}


# ---------- Proxies ----------

@router.get("/proxies")
async def list_proxies(user: User = Depends(get_current_user_unlocked)):
    db = get_db()
    cursor = db.user_proxies.find({"telegram_id": user.telegram_id}).sort("created_at", -1)
    out = []
    async for doc in cursor:
        out.append(
            {
                "id": str(doc["_id"]),
                "scheme": doc.get("scheme", "http"),
                "host": doc.get("host"),
                "port": doc.get("port"),
                "username": doc.get("username"),
                "hasPassword": bool(doc.get("password")),
                "label": doc.get("label"),
            }
        )
    return {"proxies": out}


class ProxyBody(BaseModel):
    scheme: str = "http"
    host: str
    port: int
    username: Optional[str] = None
    password: Optional[str] = None
    label: Optional[str] = None


@router.post("/proxies")
async def add_proxy(body: ProxyBody, user: User = Depends(get_current_user_unlocked)):
    db = get_db()
    p = UserProxy(
        telegram_id=user.telegram_id,
        scheme=body.scheme,
        host=body.host,
        port=body.port,
        username=body.username,
        password=body.password,
        label=body.label,
    )
    r = await db.user_proxies.insert_one(p.to_mongo())
    return {"success": True, "id": str(r.inserted_id)}


@router.delete("/proxies/{proxy_id}")
async def delete_proxy(proxy_id: str, user: User = Depends(get_current_user_unlocked)):
    db = get_db()
    try:
        oid = ObjectId(proxy_id)
    except Exception:
        raise HTTPException(400, "Bad id")
    r = await db.user_proxies.delete_one({"_id": oid, "telegram_id": user.telegram_id})
    return {"success": r.deleted_count > 0}


# ---------- Hit history ----------

@router.get("/hits")
async def list_my_hits(limit: int = 50, user: User = Depends(get_current_user_unlocked)):
    db = get_db()
    cursor = db.hits.find(
        {"telegram_id": user.telegram_id},
        {"screenshot_b64": 0},  # exclude heavy screenshot from listing
    ).sort("created_at", -1).limit(min(limit, 200))
    out = []
    async for doc in cursor:
        doc["id"] = str(doc.pop("_id"))
        if "created_at" in doc and hasattr(doc["created_at"], "isoformat"):
            doc["created_at"] = doc["created_at"].isoformat()
        out.append(doc)
    return {"hits": out}


# ---------- Cross-device state sync ----------
# Stores an opaque JSON blob (statistics, transactionHistory, settings) keyed
# by telegram_id so the same user gets the same dashboard on PC + mobile.
# Size cap ~256KB to keep Mongo docs sane (history is capped to 200 rows client-side).

_STATE_MAX_BYTES = 262144


class StateBody(BaseModel):
    data: dict


@router.get("/state")
async def get_user_state(user: User = Depends(get_current_user_unlocked)):
    db = get_db()
    doc = await db.user_state.find_one({"telegram_id": user.telegram_id})
    if not doc:
        return {"data": None, "updatedAt": None}
    return {
        "data": doc.get("data") or {},
        "updatedAt": doc["updated_at"].isoformat() if doc.get("updated_at") else None,
    }


@router.post("/state")
async def put_user_state(body: StateBody, user: User = Depends(get_current_user_unlocked)):
    import json as _json
    payload = body.data or {}
    # Guard against runaway uploads
    try:
        size = len(_json.dumps(payload, ensure_ascii=False))
    except Exception:
        raise HTTPException(400, "Invalid state payload")
    if size > _STATE_MAX_BYTES:
        raise HTTPException(413, f"state too large ({size} bytes, max {_STATE_MAX_BYTES})")
    now = datetime.now(timezone.utc)
    db = get_db()
    await db.user_state.update_one(
        {"telegram_id": user.telegram_id},
        {"$set": {"data": payload, "updated_at": now},
         "$setOnInsert": {"telegram_id": user.telegram_id, "created_at": now}},
        upsert=True,
    )
    sync_manager.publish(user.telegram_id, "state")
    return {"success": True, "updatedAt": now.isoformat()}


# ---------- Live SSE stream ----------

@router.get("/stream")
async def user_stream(request: Request, user: User = Depends(get_current_user_unlocked)):
    """Server-Sent Events — push state-change notifications to all open dashboards for
    this user so hits, BINs and settings appear live on every device within ~1-2 s.

    The client connects with Authorization: Bearer <token> and reads the stream.
    Events pushed: ``state`` (stats/history updated), ``settings``, ``bins``, ``ping``
    (30 s heartbeat to keep proxies/CDNs from closing idle connections).
    """

    async def _generate() -> AsyncGenerator[str, None]:
        queue: asyncio.Queue[dict] = asyncio.Queue(maxsize=50)
        sync_manager.subscribe(user.telegram_id, queue)
        try:
            # Immediate ping confirms the connection is alive
            yield "event: ping\ndata: {}\n\n"
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=25.0)
                    yield f"event: {event['type']}\ndata: {_json.dumps(event['data'])}\n\n"
                except (asyncio.TimeoutError, TimeoutError):
                    if await request.is_disconnected():
                        break
                    yield "event: ping\ndata: {}\n\n"
        finally:
            sync_manager.unsubscribe(user.telegram_id, queue)

    return StreamingResponse(
        _generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # disable nginx/Railway response buffering
        },
    )


# ---------- Devices / sessions ----------

@router.get("/devices")
async def list_devices(user: User = Depends(get_current_user_unlocked)):
    db = get_db()
    cursor = db.sessions.find({"telegram_id": user.telegram_id, "revoked": False}).sort("last_used_at", -1)
    out = []
    async for doc in cursor:
        out.append(
            {
                "id": doc["session_id"],
                "deviceInfo": doc.get("device_info", {}),
                "createdAt": doc["created_at"].isoformat() if doc.get("created_at") else None,
                "lastUsedAt": doc["last_used_at"].isoformat() if doc.get("last_used_at") else None,
            }
        )
    return {"devices": out}


@router.delete("/devices/{session_id}")
async def revoke_device(session_id: str, user: User = Depends(get_current_user_unlocked)):
    db = get_db()
    r = await db.sessions.update_one(
        {"session_id": session_id, "telegram_id": user.telegram_id},
        {"$set": {"revoked": True}},
    )
    return {"success": r.modified_count > 0}


# ---------- IP check (geo + fraud/proxy detection) ----------

@router.get("/ip-check")
async def ip_check(ip: Optional[str] = None, user: User = Depends(get_current_user_unlocked)):
    """Look up geo + fraud/vpn/proxy signals for the given IP (or the caller's IP).

    Combines two free public services:
      - ipwho.is         -> geo, ISP, ASN, timezone, flag emoji
      - proxycheck.io    -> proxy/vpn/tor detection + risk score (0-100)
    All errors are non-fatal and merged into a partial response so the UI can
    still render what's available.
    """
    import asyncio, httpx

    target = (ip or "").strip()
    if not target:
        # If no IP provided, ipwho.is with empty path returns caller's IP.
        target = ""

    async def _ipwho(client: httpx.AsyncClient) -> dict:
        try:
            r = await client.get(f"https://ipwho.is/{target}", timeout=8.0)
            if r.status_code != 200:
                return {}
            d = r.json() or {}
            if d.get("success") is False:
                return {}
            flag_emoji = ""
            try:
                flag_emoji = ((d.get("flag") or {}).get("emoji")) or ""
            except Exception:
                flag_emoji = ""
            conn = d.get("connection") or {}
            tz = d.get("timezone") or {}
            return {
                "ip": d.get("ip"),
                "country": d.get("country_code") or "",
                "countryName": d.get("country") or "",
                "flag": flag_emoji,
                "region": d.get("region") or "",
                "city": d.get("city") or "",
                "postal": d.get("postal") or "",
                "latitude": d.get("latitude"),
                "longitude": d.get("longitude"),
                "isp": conn.get("isp") or "",
                "org": conn.get("org") or "",
                "asn": ("AS" + str(conn.get("asn"))) if conn.get("asn") else "",
                "domain": conn.get("domain") or "",
                "timezone": tz.get("id") or "",
                "utcOffset": tz.get("utc") or "",
            }
        except Exception:
            return {}

    async def _ipapi(client: httpx.AsyncClient) -> dict:
        """Fallback geo provider: ip-api.com (free, no key, 45 req/min per IP)."""
        try:
            r = await client.get(
                f"http://ip-api.com/json/{target}?fields=status,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query",
                timeout=8.0,
            )
            if r.status_code != 200:
                return {}
            d = r.json() or {}
            if d.get("status") != "success":
                return {}
            cc = d.get("countryCode") or ""
            # Derive flag emoji from country code (regional indicator symbols).
            flag_emoji = ""
            if len(cc) == 2 and cc.isalpha():
                flag_emoji = "".join(chr(0x1F1E6 + (ord(c.upper()) - ord("A"))) for c in cc)
            asn = d.get("as") or ""
            return {
                "ip": d.get("query"),
                "country": cc,
                "countryName": d.get("country") or "",
                "flag": flag_emoji,
                "region": d.get("regionName") or d.get("region") or "",
                "city": d.get("city") or "",
                "postal": d.get("zip") or "",
                "latitude": d.get("lat"),
                "longitude": d.get("lon"),
                "isp": d.get("isp") or "",
                "org": d.get("org") or "",
                "asn": asn.split(" ")[0] if asn.startswith("AS") else "",
                "timezone": d.get("timezone") or "",
            }
        except Exception:
            return {}

    async def _proxycheck(client: httpx.AsyncClient) -> dict:
        try:
            # proxycheck.io: free tier 1000 queries/day, no key required.
            # `vpn=1&risk=1&asn=1` returns proxy/vpn/tor flags + risk score 0-100.
            r = await client.get(
                f"https://proxycheck.io/v2/{target or ''}?vpn=1&risk=1&asn=1",
                timeout=8.0,
            )
            if r.status_code != 200:
                return {}
            d = r.json() or {}
            if d.get("status") != "ok":
                return {}
            # The IP-keyed sub-dict is under the IP itself, but if we passed
            # no IP, proxycheck echoes back the querier's IP as the key.
            for k, v in d.items():
                if k in ("status", "node") or not isinstance(v, dict):
                    continue
                risk_val = v.get("risk")
                try:
                    risk_int = int(risk_val) if risk_val is not None else 0
                except (TypeError, ValueError):
                    risk_int = 0
                return {
                    "detectedIp": k,
                    "vpn": (v.get("proxy") == "yes" and v.get("type", "").lower() == "vpn"),
                    "proxy": v.get("proxy") == "yes",
                    "tor": v.get("type", "").lower() == "tor",
                    "type": v.get("type") or "residential",
                    "provider": v.get("provider") or "",
                    "risk": risk_int,
                    "operator": (v.get("operator") or {}).get("name") if isinstance(v.get("operator"), dict) else "",
                }
            return {}
        except Exception:
            return {}

    async with httpx.AsyncClient() as client:
        geo, fraud = await asyncio.gather(_ipwho(client), _proxycheck(client))
        # Fallback to ip-api.com if ipwho rate-limited or empty
        if not geo:
            geo = await _ipapi(client)

    if not geo and not fraud:
        raise HTTPException(502, "All lookup providers failed. Try again shortly.")

    # Merge — proxycheck's IP is usually more reliable if geo returned empty
    merged = dict(geo)
    if fraud:
        merged.setdefault("ip", fraud.get("detectedIp") or "")
        merged["vpn"] = bool(fraud.get("vpn"))
        merged["proxy"] = bool(fraud.get("proxy"))
        merged["tor"] = bool(fraud.get("tor"))
        merged["type"] = fraud.get("type") or "residential"
        merged["provider"] = fraud.get("provider") or ""
        merged["risk"] = fraud.get("risk") or 0
    else:
        merged.setdefault("vpn", False)
        merged.setdefault("proxy", False)
        merged.setdefault("tor", False)
        merged.setdefault("type", "residential")
        merged.setdefault("risk", 0)

    # Human-readable risk label
    risk = merged.get("risk") or 0
    if risk >= 66:
        merged["riskLabel"] = "HIGH"
    elif risk >= 34:
        merged["riskLabel"] = "MEDIUM"
    else:
        merged["riskLabel"] = "LOW"

    return merged
