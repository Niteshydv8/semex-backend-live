"""Premium (custom) emoji entity builder for Telegram.

Telegram lets bots that operate in premium contexts send animated custom
emojis by attaching `MessageEntity` items of type `custom_emoji` with a
`custom_emoji_id`. Free users see the regular fallback char, premium users
see the animation.

This module scans the plain-text (post-HTML-strip) view of a message and
emits the correct offset/length/custom_emoji_id triples that Telegram
expects. Offsets are UTF-16 code units per the Bot API spec.

Configure the emoji map via the CUSTOM_EMOJI_MAP env var (JSON dict of
`char -> custom_emoji_id string`). Defaults ship the sample pack the user
shared:

    ✅  → 5895458739703517004
    🔥  → 5420315771991497307
    ⚡  → 4958479549265347295
"""
from __future__ import annotations

import json
import logging
import os
import re

log = logging.getLogger("semex.emoji")

DEFAULT_EMOJI_MAP = {
    "✅": "5895458739703517004",
    "🔥": "5420315771991497307",
    "⚡": "4958479549265347295",
    "⚡️": "4958479549265347295",  # some inputs carry the VS16 selector
}


def _load_map() -> dict[str, str]:
    raw = os.environ.get("CUSTOM_EMOJI_MAP", "").strip()
    if not raw:
        return DEFAULT_EMOJI_MAP
    try:
        m = json.loads(raw)
        if not isinstance(m, dict):
            raise ValueError("must be a JSON object")
        # Normalise values to strings — Telegram wants strings
        return {str(k): str(v) for k, v in m.items() if k and v}
    except Exception as e:
        log.warning("CUSTOM_EMOJI_MAP invalid — falling back to defaults: %s", e)
        return DEFAULT_EMOJI_MAP


EMOJI_MAP = _load_map()


_HTML_TAG_RE = re.compile(r"<[^>]+>")


def _utf16_len(s: str) -> int:
    """UTF-16 code-unit length of s, per the Bot API entity offset spec.

    Every codepoint > 0xFFFF (like most emoji) counts as 2 UTF-16 units."""
    n = 0
    for ch in s:
        n += 1 if ord(ch) <= 0xFFFF else 2
    return n


def build_entities(html_text: str, extra_entities: list[dict] | None = None) -> list[dict]:
    """Return `entities` array for sendMessage/sendPhoto that adds custom_emoji
    metadata for every known emoji found in the rendered (HTML-stripped) text.

    Telegram computes offsets against the RENDERED text (not the HTML source),
    so we strip HTML tags first. Existing `entities` (e.g. HTML converted to
    entities by parse_mode) are still applied by Telegram; the two lists merge.
    """
    if not html_text or not EMOJI_MAP:
        return extra_entities or []

    # Telegram renders the HTML → plain text on its side. We simulate that by
    # stripping tags. Character offsets in the resulting plain text (in UTF-16
    # code units) is what we return.
    plain = _HTML_TAG_RE.sub("", html_text)

    entities: list[dict] = list(extra_entities or [])
    # Sort emoji chars by descending length so multi-char sequences like ⚡️ (2
    # codepoints) match BEFORE their single-char prefixes.
    keys = sorted(EMOJI_MAP.keys(), key=len, reverse=True)

    # Sweep with a cursor so we don't double-count overlapping matches.
    i = 0
    offset_utf16 = 0
    n = len(plain)
    while i < n:
        matched = False
        for k in keys:
            klen = len(k)
            if plain[i:i + klen] == k:
                entities.append({
                    "type": "custom_emoji",
                    "offset": offset_utf16,
                    "length": _utf16_len(k),
                    "custom_emoji_id": EMOJI_MAP[k],
                })
                offset_utf16 += _utf16_len(k)
                i += klen
                matched = True
                break
        if not matched:
            offset_utf16 += _utf16_len(plain[i])
            i += 1
    return entities
