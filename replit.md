# SEMEX

Chrome extension for checkout automation with Telegram OTP auth, redeem-code access control, multi-device sessions, and real-time hit forwarding.

## Project structure

| Directory | What it is |
|-----------|-----------|
| `backend/` | FastAPI + MongoDB API server (Python 3.12) |
| `frontend/` | React admin panel (Create React App) |
| `semex/` | Chrome extension source |
| `semex-build/` | Pre-built Chrome extension — load this into Chrome directly |

## Backend (`backend/`)

- **Entry point:** `server.py` — FastAPI app with CORS, lifespan startup (DB indexes + expiry watcher)
- **Config:** `config.py` — all settings read from env vars via `dotenv`
- **DB:** `db.py` — Motor (async MongoDB) client; `models.py` — Pydantic models
- **Routes:** `routes/admin.py`, `routes/auth.py`, `routes/data.py`, `routes/public.py`, `routes/telegram_bot.py`, `routes/user.py`
- **Services:** `services/telegram.py` (message sending), `services/expiry_watcher.py` (session expiry)
- **Tests:** `backend/tests/` + top-level `backend_test.py`

### Required env vars (backend)
```
MONGO_URL                   # MongoDB connection string
DB_NAME                     # Database name
TELEGRAM_BOT_TOKEN          # Bot token from @BotFather
TELEGRAM_BOT_USERNAME       # Bot username (no @)
ADMIN_TELEGRAM_ID           # Your Telegram user ID
ADMIN_LOG_CHANNEL_ID        # Channel ID for admin logs
JWT_SECRET                  # openssl rand -hex 32
HMAC_SECRET                 # openssl rand -hex 32 (different from JWT_SECRET)
```

Optional: `CORS_ORIGINS`, `PUBLIC_SHOWCASE_CHANNEL_ID`, `ACCESS_TOKEN_TTL_MINUTES`, `REFRESH_TOKEN_TTL_DAYS`, `OTP_TTL_MINUTES`, `BIN_LOOKUP_URL`, `MAX_DEVICES_PER_USER`, `OTP_RATE_LIMIT_PER_HOUR`, `LOGIN_RATE_LIMIT_PER_HOUR`, `BASE_URL`, `OWNER_HANDLE`, `PLAN_PRICE_*`, `PAYMENT_*`

### Run locally
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env   # fill in values
uvicorn server:app --reload --port 8001
```

## Frontend (`frontend/`)

React admin panel bootstrapped with Create React App.

```bash
cd frontend
npm install
npm start   # dev server on :3000
```

## Chrome extension

Load the pre-built extension from `semex-build/` into Chrome:
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the `semex-build/` folder

To rebuild from source, run `build.sh` inside `semex/`.

## User preferences

_None recorded yet._
