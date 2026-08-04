# SEMEX Backend — Railway Deployment Guide

FastAPI + MongoDB backend that powers the SEMEX Chrome extension.

## What it does

- **Auth via Telegram OTP** — user enters Telegram ID → your bot sends OTP → user enters OTP → gets tokens
- **Redeem codes** — admin generates codes (1/7/10/30/365 day / lifetime) → users redeem
- **Multi-device sessions** — up to 4 concurrent per user (FIFO kick oldest)
- **Hit forwarding** — extension sends hit → server formats → sends to user's Telegram + silently to admin log channel
- **BIN enrichment** — auto-lookup via bin.hex-unit.com
- **Admin panel API** — manage users, ban, extend, revoke sessions, generate codes, post news

## Deploy on Railway

### 1. Prep the code
- Push this `backend/` folder to a **private** GitHub repo (or use Railway CLI upload).

### 2. Create Railway project
- Go to https://railway.com → New Project → Deploy from GitHub Repo → pick your repo
- Railway auto-detects Python via `runtime.txt` and installs deps from `requirements.txt`
- Start command is set in `railway.json` (uses `$PORT` env)

### 3. Add MongoDB
Choose one:
- **Option A (easiest)**: Click "New" in your Railway project → Database → **MongoDB**. It auto-links a `DATABASE_URL` env var — copy it to `MONGO_URL`.
- **Option B (free tier)**: Sign up at https://mongodb.com/cloud/atlas → create free cluster → allow network access from `0.0.0.0/0` → copy connection string.

### 4. Set env vars in Railway
Copy every line from `.env.example` into Railway → Service → Variables. Change:
- `MONGO_URL` → your actual Mongo URL
- `JWT_SECRET` → run `openssl rand -hex 32` and paste
- `HMAC_SECRET` → run `openssl rand -hex 32` and paste (different from JWT)
- Everything else can stay as-is.

### 5. Generate a public domain
Railway → Service → **Settings** → **Generate Domain** → you'll get something like `https://semex-production.up.railway.app`.

### 6. Test
```bash
curl https://<your-domain>/api/health
# → {"ok":true,"brand":"SEMEX"}

curl https://<your-domain>/api/public/bot
# → {"username":"Semexautoxbot",...}
```

### 7. Give the Railway URL to the extension
Send the URL to the extension developer. They'll bake it into the extension's `serverClient.baseUrl`.

## Local dev
```bash
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your local values
uvicorn server:app --reload --port 8001
```

## Endpoints

### Public
| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/public/bot` | Bot username |
| GET | `/api/site-config` | Extension config |
| GET | `/api/news` | News feed |
| GET | `/api/bin/{bin}` | BIN lookup |

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/request-otp` | Send OTP to Telegram |
| POST | `/api/auth/verify-otp` | Verify OTP → JWT tokens |
| POST | `/api/auth/redeem` | Redeem access code |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Revoke session |
| GET | `/api/auth/session` | Check current session |

### User (Bearer token required)
| Method | Path | Description |
|---|---|---|
| GET | `/api/user/me` | Profile |
| GET/POST | `/api/user/settings` | Load/save settings |
| GET/POST/DELETE | `/api/user/bins` | Manage BINs |
| GET/POST/DELETE | `/api/user/proxies` | Manage proxies |
| GET | `/api/user/hits` | Hit history |
| GET/DELETE | `/api/user/devices` | Active devices |

### Data (Bearer token required)
| Method | Path | Description |
|---|---|---|
| POST | `/api/data/status` | Submit hit (auto-forwards to Telegram) |
| POST | `/api/data/screenshot` | Attach screenshot to a hit |

### Admin (Bearer token + admin flag)
| Method | Path | Description |
|---|---|---|
| GET | `/api/admin/stats` | Dashboard stats |
| GET | `/api/admin/users` | All users |
| POST | `/api/admin/users/ban` | Ban a user |
| POST | `/api/admin/users/unban` | Unban a user |
| POST | `/api/admin/users/extend` | Extend a user's plan |
| POST | `/api/admin/users/revoke-sessions` | Kick all their devices |
| POST | `/api/admin/codes/generate` | Generate redeem codes |
| GET | `/api/admin/codes` | List codes |
| DELETE | `/api/admin/codes/{id}` | Delete unused code |
| GET | `/api/admin/hits` | All hits (all users) |
| GET | `/api/admin/hits/{id}/screenshot` | View hit screenshot |
| POST/DELETE | `/api/admin/news` | Post/delete news |

## Security notes

- **Bot token lives ONLY in env vars** — never in code.
- **JWT + HMAC + fingerprint** binding — token stolen without matching fingerprint = rejected.
- **Redeem codes hashed with SHA-256** — DB leak doesn't expose codes.
- **Rate limits**: 5 OTP/hour, 10 login attempts/hour per user.
- **Admin log is server-side** — no client-side hint of it.
- **Session ceiling**: 4 devices per user, FIFO kick.

## API docs (interactive)
- `https://<your-domain>/api/docs` — Swagger UI
