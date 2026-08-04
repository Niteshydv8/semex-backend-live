"""Tests for the custom-emoji entity builder used to send premium emoji in
public group + admin log messages via Telegram Bot API."""
from services.custom_emojis import build_entities, DEFAULT_EMOJI_MAP


def test_builds_entities_for_defaults():
    ents = build_entities("✅ CHARGED ⚡ Radar 🔥 done")
    ids = [e["custom_emoji_id"] for e in ents]
    assert DEFAULT_EMOJI_MAP["✅"] in ids
    assert DEFAULT_EMOJI_MAP["⚡"] in ids
    assert DEFAULT_EMOJI_MAP["🔥"] in ids


def test_utf16_length_correct():
    ents = build_entities("✅ ⚡ 🔥")
    lengths = {e["custom_emoji_id"]: e["length"] for e in ents}
    # ✅ (U+2705) and ⚡ (U+26A1) are BMP → 1 UTF-16 unit
    assert lengths[DEFAULT_EMOJI_MAP["✅"]] == 1
    assert lengths[DEFAULT_EMOJI_MAP["⚡"]] == 1
    # 🔥 (U+1F525) is above the BMP → 2 UTF-16 units (surrogate pair)
    assert lengths[DEFAULT_EMOJI_MAP["🔥"]] == 2


def test_offsets_are_utf16_and_ignore_html_tags():
    """Offsets must be computed against the RENDERED (HTML-stripped) text."""
    text = "✅ <b>CHARGED</b> ⚡ Radar 🔥 done"
    ents = build_entities(text)
    # Plain rendered form: "✅ CHARGED ⚡ Radar 🔥 done"
    #  offset 0  = ✅
    #  offset 10 = ⚡ (10 UTF-16 units before it: ✅ + " " + "CHARGED" + " " = 1+1+7+1=10)
    #  offset 18 = 🔥 (10 + 1(⚡) + 1(sp) + 5(Radar) + 1(sp) = 18)
    offsets = sorted(e["offset"] for e in ents)
    assert offsets == [0, 10, 18]


def test_empty_input_returns_empty():
    assert build_entities("") == []
    assert build_entities("   ") == []


def test_no_known_emoji_returns_empty():
    assert build_entities("Just plain text no emoji") == []


def test_variation_selector_16_matches():
    """⚡️ (⚡ + U+FE0F variation selector) must still match the ⚡ entry."""
    ents = build_entities("⚡️ live")
    assert len(ents) == 1
    assert ents[0]["custom_emoji_id"] == DEFAULT_EMOJI_MAP["⚡"]


def test_extra_entities_preserved():
    extra = [{"type": "bold", "offset": 0, "length": 4}]
    ents = build_entities("word ✅", extra_entities=extra)
    assert extra[0] in ents
