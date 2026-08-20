"""Conftest for unit tests that don't need a live server or real DB.

Sets the minimal env vars so config.py loads without errors.
TELEGRAM_BOT_USERNAME is intentionally NOT set here so that tests can
verify the behaviour when the variable is absent from the environment
(config.py now defaults it to "" when unset).
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

# Add the backend root to sys.path so `import server`, `import config`, etc. work
# whether tests are invoked via `python -m pytest` or bare `pytest unit/`.
_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

# Must be set before any backend module is imported.
# TELEGRAM_BOT_USERNAME is deliberately omitted — config.py defaults it to "".
_FAKE_ENV = {
    "MONGO_URL": "mongodb://localhost:27017",
    "DB_NAME": "semex_unit_test",
    "TELEGRAM_BOT_TOKEN": "0:fake_token_for_unit_tests",
    "ADMIN_TELEGRAM_ID": "1",
    "ADMIN_LOG_CHANNEL_ID": "1",
    "JWT_SECRET": "fake_jwt_secret_for_unit_tests_only",
    "HMAC_SECRET": "fake_hmac_secret_for_unit_tests_only",
}

for k, v in _FAKE_ENV.items():
    os.environ.setdefault(k, v)

# Ensure TELEGRAM_BOT_USERNAME is absent so the default ("") applies.
os.environ.pop("TELEGRAM_BOT_USERNAME", None)
