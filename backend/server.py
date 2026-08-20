"""SEMEX backend entry point - FastAPI server."""
from __future__ import annotations

import asyncio
import logging
import time as _time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from config import settings
from db import init_indexes
from routes.admin import router as admin_router
from routes.auth import router as auth_router
from routes.data import router as data_router, _get_min_extension_version, _parse_version
from routes.public import router as public_router
from routes.telegram_bot import router as telegram_bot_router
from routes.user import router as user_router
from security import decode_token
from services.expiry_watcher import start_expiry_task, stop_expiry_task
from services.telegram_outbox import start_outbox_task, stop_outbox_task
from services.telegram import get_bot_info, send_message

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_indexes()
    start_expiry_task()
    start_outbox_task()
    # Auto-resolve bot username from the live token so changing TELEGRAM_BOT_TOKEN
    # on the server (e.g. after a leak) never leaves the display username pointing
    # at the old bot in messages, public-group footer, and login deep-links.
    _log = logging.getLogger("semex.startup")

    async def _resolve_bot_username() -> None:
        """Best-effort background task: resolves bot username from Telegram API.

        Uses a strict 3-second timeout with a single HTTP attempt so a Telegram
        outage or DNS failure never delays application readiness or causes
        health-check failures on Render / other platforms.
        """
        try:
            bot_info = await asyncio.wait_for(get_bot_info(), timeout=3.0)
            if bot_info and bot_info.get("username"):
                fetched = bot_info["username"]
                if fetched != settings.TELEGRAM_BOT_USERNAME:
                    _log.info(
                        "Bot username resolved from Telegram API: %r (was %r)",
                        fetched,
                        settings.TELEGRAM_BOT_USERNAME or "(unset)",
                    )
                settings.TELEGRAM_BOT_USERNAME = fetched
            else:
                _log.warning(
                    "Could not resolve bot username from Telegram API — keeping "
                    "TELEGRAM_BOT_USERNAME env value (%r).",
                    settings.TELEGRAM_BOT_USERNAME or "(unset)",
                )
        except asyncio.TimeoutError:
            _log.warning(
                "Bot username auto-resolve timed out (3 s) — keeping "
                "TELEGRAM_BOT_USERNAME env value (%r).",
                settings.TELEGRAM_BOT_USERNAME or "(unset)",
            )
        except Exception as _e:
            _log.warning("Bot username auto-resolve failed: %s", _e)

    # Fire-and-forget: startup must not block on Telegram availability.
    asyncio.create_task(_resolve_bot_username())
    yield
    stop_outbox_task()
    stop_expiry_task()


app = FastAPI(
    title="SEMEX API",
    version="1.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url=None,
    openapi_url="/api/openapi.json",
)

origins = settings.CORS_ORIGINS.split(",") if settings.CORS_ORIGINS != "*" else ["*"]
# allow_credentials=True is incompatible with a wildcard origin — browsers
# refuse the combination and Starlette/CORS spec bars it. Only enable
# credentials when CORS_ORIGINS is set to an explicit allowlist via the env var.
_allow_credentials = origins != ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=_allow_credentials,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "X-Fingerprint",
        "X-Extension-Version",
        "X-Requested-With",
    ],
)


# ─── Global extension-version gate ────────────────────────────────────────────
# Refuses ALL API traffic from extensions below the minimum required version.
# Only these paths are exempt (so an old build can still fetch the upgrade
# info + reach the bot download):
#   - /api/public/*         (version info, bot download link)
#   - /api/health           (health probe)
#   - /api/telegram/*       (bot webhooks + extension download)
#   - /api/docs, /admin, /, /static/*
# NOTE (v2.3.6): /api/auth/* is NO LONGER exempt — outdated extensions can no
# longer authenticate. They MUST upgrade first. `/api/public/version` is the
# only route they can still reach, which is what the popup uses to render the
# hard-block modal.
_VERSION_EXEMPT_PREFIXES = (
    "/api/public/",
    "/api/health",
    "/api/telegram/",
    "/api/docs",
    "/api/openapi.json",
    "/admin",
    "/static/",
)

# HONEYPOT paths (v2.3.7): if a user has tampered with the client to bypass
# the paywall, we still want their hits so we can observe them. These endpoints
# do NOT 426 for outdated extensions — instead the middleware STAMPS the
# request state and lets the endpoint handler flag / persist / alert-admin
# accordingly. This preserves intel on tamperers.
_VERSION_HONEYPOT_PREFIXES = (
    "/api/data/status",       # main hit submission
    "/api/data/screenshot",   # screenshot upload
)


# ─── Outdated-extension DM notifier (dedup: 6h per telegram_id) ──────────────
_OUTDATED_DM_CACHE: dict[int, float] = {}
_OUTDATED_DM_TTL_SECONDS = 6 * 3600  # 6 hours


def _extract_telegram_id_from_request(request: Request) -> int | None:
    """Best-effort JWT decode from Authorization header. Returns telegram_id or None."""
    auth = request.headers.get("authorization") or ""
    if not auth.lower().startswith("bearer "):
        return None
    token = auth[7:].strip()
    if not token:
        return None
    payload = decode_token(token)
    if not payload:
        return None
    tid = payload.get("tid")
    try:
        return int(tid) if tid is not None else None
    except (TypeError, ValueError):
        return None


async def _dm_outdated_user(telegram_id: int, sent_version: str, min_version: str) -> None:
    """Fire-and-forget Telegram DM to the outdated user. Dedup 6h."""
    now = _time.time()
    last = _OUTDATED_DM_CACHE.get(telegram_id, 0.0)
    if now - last < _OUTDATED_DM_TTL_SECONDS:
        return
    _OUTDATED_DM_CACHE[telegram_id] = now
    bot_handle = settings.TELEGRAM_BOT_USERNAME
    text = (
        "⚠️ <b>SEMEX — Update Required</b>\n\n"
        f"Your extension version <code>{sent_version or 'unknown'}</code> is outdated.\n"
        f"Minimum required: <b>v{min_version}</b>\n\n"
        f"Run <code>/get</code> in @{bot_handle} to download the latest build.\n"
        "Reinstall via <b>chrome://extensions → Load unpacked</b>.\n\n"
        "🔒 All API access is blocked until you upgrade."
    )
    try:
        await send_message(telegram_id, text)
    except Exception as e:
        logging.getLogger("semex.version_gate").warning(
            "outdated-DM send failed for %s: %s", telegram_id, e
        )


@app.middleware("http")
async def enforce_extension_version_globally(request: Request, call_next):
    path = request.url.path
    # Default: extension is considered current until we prove otherwise.
    request.state.extension_outdated = False
    request.state.extension_sent_version = None
    # Non-API routes and exempt endpoints pass through untouched.
    if not path.startswith("/api/") or any(path.startswith(p) for p in _VERSION_EXEMPT_PREFIXES):
        return await call_next(request)
    # Detect the caller: only requests from the SEMEX extension carry the
    # X-Fingerprint header (added by server-client.js on every fetch). curl,
    # web-dashboard, tests never send it — those pass through untouched.
    is_extension = bool(request.headers.get("x-fingerprint"))
    if not is_extension:
        return await call_next(request)
    sent = request.headers.get("x-extension-version") or ""
    min_v = await _get_min_extension_version()
    # A MISSING version header must NOT be treated as outdated. Current builds
    # occasionally issue a fingerprinted request without the version header, and
    # flagging those as outdated caused false 426s AND false "update required"
    # bot DMs for users on the latest build. Only flag a build as outdated when
    # it actually sent a version AND that version is below the minimum. This
    # matches _enforce_min_extension_version() in routes/data.py.
    is_outdated = bool(sent) and (_parse_version(sent) < _parse_version(min_v))
    if not is_outdated:
        return await call_next(request)
    # HONEYPOT: outdated extension hitting a data-submit endpoint. We DO NOT
    # 426 — we let the request through, but stamp state so the handler can
    # persist + admin-alert. This turns tampered old builds into intel.
    if any(path.startswith(p) for p in _VERSION_HONEYPOT_PREFIXES):
        request.state.extension_outdated = True
        request.state.extension_sent_version = sent or "unknown"
        request.state.extension_min_version = min_v
        return await call_next(request)
    # Standard path: outdated → 426 + best-effort Telegram DM.
    # DM SPAM DEFENSE (Round 39): only DM if the sent version is genuinely
    # below the safe FALLBACK floor. Protects users during DB corruption
    # (e.g. bogus "3" min-version) from getting spam DMs telling them a
    # current build is outdated.
    bot_handle = settings.TELEGRAM_BOT_USERNAME
    base = str(settings.BASE_URL or "").rstrip("/") if getattr(settings, "BASE_URL", None) else ""
    from routes.data import _FALLBACK_MIN_VERSION
    if sent and _parse_version(sent) >= _parse_version(_FALLBACK_MIN_VERSION):
        # Extension is at least at the safe floor — don't DM. Still 426 so
        # the client-side paywall renders and the user can upgrade normally.
        pass
    else:
        tid = _extract_telegram_id_from_request(request)
        if tid:
            asyncio.create_task(_dm_outdated_user(tid, sent, min_v))
    return JSONResponse(
        status_code=426,
        content={
            "detail": {
                "error": "upgrade_required",
                "code": "EXTENSION_OUTDATED",
                "sentVersion": sent or "unknown",
                "minVersion": min_v,
                "downloadUrl": f"{base}/api/telegram/download/extension" if base else "/api/telegram/download/extension",
                "botLink": f"https://t.me/{bot_handle}",
                "botCommand": "/get",
                "message": (
                    f"Your SEMEX extension {'is out of date' if sent else 'is too old to identify itself'}. "
                    f"Please update to v{min_v} — run /get in @{bot_handle}."
                ),
            }
        },
    )

app.include_router(public_router)
app.include_router(auth_router)
app.include_router(user_router)
app.include_router(data_router)
app.include_router(admin_router)
app.include_router(telegram_bot_router)


# Serve admin dashboard
import os
_STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
if os.path.isdir(_STATIC_DIR):
    app.mount("/static", StaticFiles(directory=_STATIC_DIR), name="static")


@app.get("/admin")
async def admin_dashboard():
    path = os.path.join(_STATIC_DIR, "admin.html")
    return FileResponse(path)


@app.get("/")
async def root():
    return {"brand": "SEMEX", "status": "online", "admin": "/admin"}
