# SEMEX Chrome Extension

**Brand:** SEMEX
**Bot:** @Semexautoxbot
**Version:** 2.7.0

Advanced checkout automation with Telegram OTP login, real-time hit forwarding, multi-device sessions, and redeem-code access control.

---

## For end users (public distribution)

### 1. Install
1. Download the SEMEX zip.
2. Unzip anywhere on your computer.
3. Open Chrome → `chrome://extensions`.
4. Toggle **Developer mode** (top right).
5. Click **Load unpacked** → select the unzipped folder.
6. The SEMEX icon appears in your toolbar.

### 2. First login
1. Click the SEMEX icon.
2. Enter your Telegram user ID (get it from @userinfobot).
3. Open Telegram → DM **@Semexautoxbot** at least once (say `/start`).
4. Click "Send OTP" — you'll receive a 6-digit code from @Semexautoxbot.
5. Enter the code — you're in.

### 3. Redeem access
- First-time users need a redeem code to unlock the extension.
- Contact the admin via the bot to request a code.
- Enter it in Settings → Redeem Code.
- Access is granted for the duration of the code (1 / 7 / 10 / 30 / 365 days depending on the code).

### 4. Multi-device
- Log in on up to **4 devices** simultaneously.
- 5th device login = the oldest session is auto-kicked.

---

## For the admin (you)

### Deploy the backend
See `backend/README.md`. Once deployed, point your custom domain at the host and use it as your API base URL.

### Build & rebrand the extension

```bash
cd extension
./build.sh https://api.yourdomain.com
# → produces ../semex-v2.7.0.zip
```

For obfuscated public build:
```bash
./build.sh https://api.yourdomain.com --obfuscate
```

### Generate redeem codes
Call your deployed API:
```bash
# Get an admin token first by logging in via the extension.
# Then:
curl -X POST https://api.yourdomain.com/api/admin/codes/generate \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "X-Fingerprint: <YOUR_FINGERPRINT>" \
  -H "Content-Type: application/json" \
  -d '{"days": 7, "quantity": 10, "note": "batch 1"}'
```

---

## Features

- ✅ Telegram OTP-only login (no passwords)
- ✅ Multi-device sessions (4 concurrent, FIFO kick)
- ✅ Redeem code access (1/7/10/30/365 day / lifetime)
- ✅ Auto hit forwarding to user's Telegram
- ✅ Auto-screenshot on hit → local save as `SEMEX_<site>_<status>_<time>.png`
- ✅ BIN enrichment (brand / bank / country) via bin.hex-unit.com
- ✅ Stripe / OpenAI / Krea / Roblox / Epic / Xsolla checkout automation
- ✅ reCAPTCHA + hCaptcha solving (NopeCHA API key required)
- ✅ Proxy support (HTTP / HTTPS / SOCKS5)
- ✅ Custom checkout page theming (colour picker)
- ✅ Toast notifications (SEMEX-themed, slide from right)
- ✅ Draggable overlay with live stats + sound feedback
- ✅ Cloud-synced settings + BINs (follow you across devices)

---

## Security architecture

**Client-side (dumb)**
- Cannot bypass license — no local logic to patch.
- Bot token never in client code.
- Bundle can be obfuscated with `--obfuscate` flag.

**Server-side (brain)**
- All license/redeem/session checks enforced.
- Rate limits: 5 OTP/hr, 10 login/hr per user.
- JWT + refresh token, 15-min access TTL.
- HMAC-signed sensitive payloads.

---

## File layout

```
semex/
├── manifest.json
├── background.js          # Service worker
├── build.sh               # Build & package script
├── utils/
│   ├── server-client.js   # API client (baseUrl injected at build)
│   ├── card-generator.js
│   ├── card-list.js
│   ├── cache-manager.js
│   └── encryption.js
├── content/               # Injected scripts on checkout pages
├── popup/                 # Extension popup UI
├── icons/                 # Logo files
├── assets/                # Sounds, images
└── libs/                  # 3rd-party (jsencrypt)
```

---

## Support

- Bot: [@Semexautoxbot](https://t.me/Semexautoxbot)
