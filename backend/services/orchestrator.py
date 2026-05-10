"""
LinguBridge AI — Orchestrator
LLM birincil, kural tabanlı motorlar fallback olacak şekilde
tek bir "process" akışı sunar.

Her zaman aynı şemayı döndürür; frontend tek tip yanıt bekleyebilir.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from .llm_client import (
    LLMRateLimited,
    LLMResponseError,
    LLMUnavailable,
    call_llm_json,
    is_configured,
)
from .politeness_engine import get_politeness_level, rewrite_politeness
from .suggestion_engine import generate_suggestions
from .translation_service import SUPPORTED_LANGUAGES, translate_text

logger = logging.getLogger("lingubridge.orchestrator")

# Duygu → TTS varsayılan ipuçları (fallback için)
EMOTION_TTS_DEFAULTS: dict[str, dict[str, float]] = {
    "happy":    {"rate": 1.10, "pitch": 1.15, "volume": 1.0},
    "sad":      {"rate": 0.85, "pitch": 0.85, "volume": 0.85},
    "angry":    {"rate": 1.15, "pitch": 1.10, "volume": 1.0},
    "stressed": {"rate": 1.05, "pitch": 1.05, "volume": 0.9},
    "calm":     {"rate": 0.90, "pitch": 0.95, "volume": 1.0},
    "neutral":  {"rate": 1.00, "pitch": 1.00, "volume": 1.0},
}

# 5 seviyeli nezaket etiketleri
_LEVEL_LABELS = {
    "very_informal": ("Çok Samimi", "Very Informal"),
    "informal":      ("Samimi", "Informal"),
    "neutral":       ("Nötr", "Neutral"),
    "formal":        ("Resmi", "Formal"),
    "very_formal":   ("Çok Resmi", "Very Formal"),
}


def _level_from_slider(value: int) -> str:
    """Slider değeri → 5 seviyeli etiket."""
    if value <= 15:
        return "very_informal"
    if value <= 40:
        return "informal"
    if value <= 60:
        return "neutral"
    if value <= 85:
        return "formal"
    return "very_formal"


def _build_system_prompt(source_lang: str, target_lang: str) -> str:
    source_lang_name = SUPPORTED_LANGUAGES.get(source_lang, source_lang)
    target_lang_name = SUPPORTED_LANGUAGES.get(target_lang, target_lang)
    return (
        "Sen 'LinguBridge AI'sın: duygu ve kültür odaklı bir iletişim asistanı. "
        "Görevin, kullanıcının kaynak metnini hedef dile çevirmek, hedef kültürün "
        "nezaket normlarına göre yeniden yazmak, konuşmacının duygu durumuna empati "
        "göstermek ve 3 farklı yanıt önerisi sunmaktır.\n\n"
        "KURALLAR:\n"
        "- Türkçe için sen/siz hitabını ve uygun fiil çekimini (-iniz/-ınız) kullan.\n"
        "- İngilizce için would/could/might gibi modaliteleri uygun yerde kullan.\n"
        "- 'stressed' veya 'angry' duygusunda adapted_text empatik bir giriş içersin "
        "(\"Anlıyorum, ...\" gibi).\n"
        "- 'happy' duygusunda ton sıcak ve enerjik olsun; 'sad' duygusunda nazik ve yumuşak.\n"
        "- changes_explained kısa, insan dostu maddeler içersin (örn. 'sen → siz (resmi hitap)').\n"
        "- suggestions dizisi TAM OLARAK 3 eleman içermeli: type=accept, neutral, decline sırasıyla.\n"
        f"- suggestions[*].text MUTLAKA KAYNAK dilde, yani {source_lang_name} ({source_lang}) dilinde "
        "yazılmalı; çünkü bu öneriler kullanıcının cevap olarak yazabileceği alternatif "
        "ifadelerdir ve daha sonra hedef dile çevrilmek üzere giriş kutusuna yapıştırılır.\n"
        "- tts_hints: rate (0.7–1.3), pitch (0.7–1.3), volume (0.5–1.0). Duyguya uygun seç.\n"
        "- Yanıtın YALNIZCA aşağıdaki şemayla eşleşen geçerli JSON olmalı. "
        "Açıklama metni, markdown veya kod bloğu YAZMA.\n"
        f"- adapted_text mutlaka HEDEF dilde ({target_lang_name}) olsun, "
        f"suggestions[*].text ise mutlaka KAYNAK dilde ({source_lang_name}) olsun.\n"
    )


def _build_user_prompt(
    *,
    text: str,
    source_lang: str,
    target_lang: str,
    politeness_level: int,
    politeness_label: str,
    emotion: str,
    history: list[dict],
) -> str:
    history_lines = []
    for turn in history[-5:]:
        role = turn.get("role", "user")
        content = (turn.get("text") or "").strip()
        emo = turn.get("emotion") or "neutral"
        if content:
            history_lines.append(f"- [{role}|{emo}] {content}")
    history_block = "\n".join(history_lines) if history_lines else "(boş)"

    schema = (
        '{\n'
        '  "translated_text": "string (hedef dilde ham çeviri)",\n'
        '  "adapted_text": "string (nezaket+duygu uyumlu nihai metin)",\n'
        '  "politeness_label": "very_informal|informal|neutral|formal|very_formal",\n'
        '  "changes_explained": ["kısa madde", ...],\n'
        '  "suggestions": [\n'
        '    {"text": "...", "type": "accept",  "label": "...", "icon": "✅"},\n'
        '    {"text": "...", "type": "neutral", "label": "...", "icon": "💬"},\n'
        '    {"text": "...", "type": "decline", "label": "...", "icon": "❌"}\n'
        '  ],\n'
        '  "tts_hints": {"rate": 1.0, "pitch": 1.0, "volume": 1.0},\n'
        '  "reasoning": "kısa, neden bu adaptasyon yapıldı?"\n'
        '}\n'
    )

    return (
        f"Hedef şema:\n{schema}\n"
        f"Kaynak dil: {source_lang}\n"
        f"Hedef dil: {target_lang}\n"
        f"Nezaket seviyesi: {politeness_level}/100 (etiket: {politeness_label})\n"
        f"Tespit edilen duygu: {emotion}\n"
        f"Son konuşma turları:\n{history_block}\n\n"
        "<user_text>\n"
        f"{text}\n"
        "</user_text>\n\n"
        "Yalnızca yukarıdaki şemada geçerli JSON döndür."
    )


def _normalize_llm_payload(
    raw: dict,
    *,
    fallback_translated: str,
    politeness_label: str,
    emotion: str,
    target_lang: str,
) -> dict:
    """LLM yanıtını projenin standart şemasına normalize eder."""
    translated = (raw.get("translated_text") or fallback_translated or "").strip()
    adapted = (raw.get("adapted_text") or translated).strip()
    label = raw.get("politeness_label") or politeness_label
    if label not in _LEVEL_LABELS:
        label = politeness_label

    changes = raw.get("changes_explained") or []
    if not isinstance(changes, list):
        changes = [str(changes)]

    suggestions_raw = raw.get("suggestions") or []
    suggestions: list[dict] = []
    type_to_meta = {
        "accept":  {"label_tr": "Kabul",  "label_en": "Accept",  "icon": "✅"},
        "neutral": {"label_tr": "Nötr",   "label_en": "Neutral", "icon": "💬"},
        "decline": {"label_tr": "Reddet", "label_en": "Decline", "icon": "❌"},
    }
    for s in suggestions_raw[:5]:
        if not isinstance(s, dict):
            continue
        s_text = (s.get("text") or "").strip()
        if not s_text:
            continue
        s_type = s.get("type") or "neutral"
        meta = type_to_meta.get(s_type, type_to_meta["neutral"])
        suggestions.append({
            "text": s_text,
            "type": s_type,
            "label": s.get("label") or (meta["label_tr"] if target_lang == "tr" else meta["label_en"]),
            "icon": s.get("icon") or meta["icon"],
        })

    tts_hints = raw.get("tts_hints") or {}
    if not isinstance(tts_hints, dict):
        tts_hints = {}
    defaults = EMOTION_TTS_DEFAULTS.get(emotion, EMOTION_TTS_DEFAULTS["neutral"])
    merged_hints = {
        "rate":   _clamp(tts_hints.get("rate",   defaults["rate"]),   0.5, 1.6),
        "pitch":  _clamp(tts_hints.get("pitch",  defaults["pitch"]),  0.5, 1.6),
        "volume": _clamp(tts_hints.get("volume", defaults["volume"]), 0.3, 1.0),
    }

    return {
        "translated_text": translated,
        "adapted_text": adapted,
        "politeness_label": label,
        "changes_explained": [str(c) for c in changes][:8],
        "suggestions": suggestions,
        "tts_hints": merged_hints,
        "reasoning": (raw.get("reasoning") or "").strip(),
    }


def _clamp(value: Any, lo: float, hi: float) -> float:
    try:
        v = float(value)
    except (TypeError, ValueError):
        return (lo + hi) / 2
    return max(lo, min(hi, v))


async def _fallback_pipeline(
    *,
    text: str,
    source_lang: str,
    target_lang: str,
    politeness_level: int,
    emotion: str,
    history: list[dict],
) -> dict:
    """LLM kullanılamadığında kural tabanlı yedek akış."""
    translation = await translate_text(
        text=text,
        source_lang=source_lang,
        target_lang=target_lang,
    )
    translated_text = translation["translated_text"]

    politeness = rewrite_politeness(
        text=translated_text,
        politeness_level=politeness_level,
        language=target_lang,
        emotion=emotion,
    )

    suggestions_payload = generate_suggestions(
        text=text,
        language=source_lang,
        emotion=emotion,
        politeness_level=politeness_level,
        conversation_history=[h.get("text", "") for h in history],
    )

    label = _level_from_slider(politeness_level)
    defaults = EMOTION_TTS_DEFAULTS.get(emotion, EMOTION_TTS_DEFAULTS["neutral"])

    return {
        "translated_text": translated_text,
        "adapted_text": politeness["rewritten_text"],
        "politeness_label": politeness.get("politeness_label", label),
        "changes_explained": politeness.get("changes_made", []),
        "suggestions": suggestions_payload.get("suggestions", []),
        "tts_hints": dict(defaults),
        "reasoning": suggestions_payload.get("reasoning", ""),
        "match_quality": translation.get("match_quality", 0),
    }


async def process_message(
    *,
    text: str,
    source_lang: str,
    target_lang: str,
    politeness_level: int,
    emotion: str,
    conversation_history: Optional[list[dict]] = None,
) -> dict:
    """
    Çeviri + nezaket + öneri + TTS hint'leri tek seferde döndürür.

    Yanıt sözlüğüne `mode` alanı eklenir:
      - "llm"     : LLM yanıtı kullanıldı.
      - "fallback": Kural tabanlı yedek kullanıldı.
    """
    history = conversation_history or []
    politeness_label = _level_from_slider(politeness_level)

    if not text or not text.strip():
        return {
            "translated_text": "",
            "adapted_text": "",
            "politeness_label": politeness_label,
            "changes_explained": [],
            "suggestions": [],
            "tts_hints": dict(EMOTION_TTS_DEFAULTS.get(emotion, EMOTION_TTS_DEFAULTS["neutral"])),
            "reasoning": "",
            "mode": "fallback",
            "source_lang": source_lang,
            "target_lang": target_lang,
            "emotion": emotion,
        }

    if is_configured():
        try:
            system = _build_system_prompt(source_lang, target_lang)
            user_prompt = _build_user_prompt(
                text=text,
                source_lang=source_lang,
                target_lang=target_lang,
                politeness_level=politeness_level,
                politeness_label=politeness_label,
                emotion=emotion,
                history=history,
            )
            raw = await call_llm_json(user_prompt, system=system)
            normalized = _normalize_llm_payload(
                raw,
                fallback_translated=text,
                politeness_label=politeness_label,
                emotion=emotion,
                target_lang=target_lang,
            )
            normalized.update({
                "mode": "llm",
                "source_lang": source_lang,
                "target_lang": target_lang,
                "emotion": emotion,
                "fallback_reason": None,
            })
            logger.info("✅ LLM başarılı (%s → %s, duygu=%s)", source_lang, target_lang, emotion)
            return normalized
        except LLMRateLimited as e:
            fallback_reason = "rate_limit"
            fallback_detail = str(e)
            logger.warning("➡️  Fallback nedeni: KOTA AŞIMI — %s", fallback_detail)
        except LLMUnavailable as e:
            fallback_reason = "unavailable"
            fallback_detail = str(e)
            logger.info("➡️  Fallback nedeni: LLM kullanılamıyor — %s", fallback_detail)
        except LLMResponseError as e:
            fallback_reason = "response_error"
            fallback_detail = str(e)
            logger.warning("➡️  Fallback nedeni: LLM yanıt hatası — %s", fallback_detail)
    else:
        fallback_reason = "not_configured"
        fallback_detail = "GEMINI_API_KEY tanımlı değil"
        logger.info("➡️  Fallback nedeni: API key tanımlı değil")

    payload = await _fallback_pipeline(
        text=text,
        source_lang=source_lang,
        target_lang=target_lang,
        politeness_level=politeness_level,
        emotion=emotion,
        history=history,
    )
    payload.update({
        "mode": "fallback",
        "source_lang": source_lang,
        "target_lang": target_lang,
        "emotion": emotion,
        "fallback_reason": fallback_reason,
        "fallback_detail": fallback_detail,
    })
    return payload


# ============================================================
# Gelen mesaj analizi (iki yönlü iletişim)
# ============================================================

# Kural tabanlı fallback için anahtar kelime tabanlı ton işaretleri
_TONE_KEYWORDS = {
    "aggressive": [
        "lan", "yürü", "kapa", "sus", "saçma", "aptal", "salak", "kahretsin",
        "shut up", "stupid", "idiot", "damn", "wtf", "fuck", "asshole",
    ],
    "cold": [
        "no thanks", "not interested", "leave me alone", "stop",
        "ilgilenmiyorum", "rahatsız etme", "bırak", "yeter",
    ],
    "warm": [
        "thank you", "thanks", "appreciate", "love", "great", "wonderful", "awesome",
        "teşekkür", "harika", "çok güzel", "minnettarım", "sağol", "canım",
    ],
    "formal": [
        "dear sir", "kindly", "regards", "sincerely", "would you", "could you",
        "sayın", "rica ederim", "saygılarımla", "müsaitseniz",
    ],
    "uncertain": [
        "maybe", "perhaps", "i think", "not sure", "probably",
        "belki", "sanırım", "emin değilim", "galiba",
    ],
}

_TONE_LABELS = {
    "warm":       {"tr": "Sıcak ve samimi",        "en": "Warm and friendly"},
    "formal":     {"tr": "Resmi",                  "en": "Formal"},
    "neutral":    {"tr": "Nötr",                   "en": "Neutral"},
    "cold":       {"tr": "Mesafeli / soğuk",       "en": "Cold / distant"},
    "aggressive": {"tr": "Sert / saldırgan",       "en": "Aggressive"},
    "uncertain":  {"tr": "Tereddütlü",             "en": "Hesitant"},
}


def _build_incoming_system_prompt(message_lang: str, reply_lang: str) -> str:
    msg_name = SUPPORTED_LANGUAGES.get(message_lang, message_lang)
    reply_name = SUPPORTED_LANGUAGES.get(reply_lang, reply_lang)
    return (
        "Sen 'LinguBridge AI'sın: kullanıcıya YABANCI BİR DİLDEN gelen bir mesajı "
        "anlamlandırma ve uygun yanıt üretme konusunda yardım eden bir iletişim asistanısın.\n\n"
        f"Gelen mesaj {msg_name} ({message_lang}) dilinde. Kullanıcının ana dili / yanıt yazacağı dil "
        f"{reply_name} ({reply_lang}).\n\n"
        "GÖREVLER:\n"
        "1) Mesajın gerçek niyetini ve ton/duygu durumunu sezinle (warm | formal | neutral | cold | aggressive | uncertain).\n"
        "2) Mesajın anlamını kullanıcının dilinde ({reply_lang}) kısaca özetle.\n"
        "3) Hedef kültüre özgü ipuçları sun: dolaylı reddetme, kibar formüller, statü farkı vb. (en fazla 3 madde).\n"
        "4) Kullanıcının yazabileceği 3 olası cevabı YALNIZCA kullanıcının dilinde (yanıt dili) üret. "
        "type alanı sırayla 'accept' (olumlu), 'neutral' (yumuşak/orta), 'decline' (reddet veya zaman kazan) olsun.\n\n"
        "KURALLAR:\n"
        f"- translated_meaning ALANI MUTLAKA {reply_name} dilinde olsun.\n"
        f"- reply_suggestions[*].text ALANI MUTLAKA {reply_name} dilinde olsun.\n"
        "- cultural_notes en fazla 3 madde, her biri kısa.\n"
        "- Sadece geçerli JSON döndür, markdown veya kod bloğu yazma.\n"
    ).format(reply_lang=reply_name)


def _build_incoming_user_prompt(text: str, message_lang: str, reply_lang: str) -> str:
    schema = (
        '{\n'
        '  "tone": "warm|formal|neutral|cold|aggressive|uncertain",\n'
        '  "translated_meaning": "string (yanıt dilinde, mesajın özeti)",\n'
        '  "cultural_notes": ["kısa madde", ...],\n'
        '  "reply_suggestions": [\n'
        '    {"text": "...", "type": "accept",  "label": "...", "icon": "✅"},\n'
        '    {"text": "...", "type": "neutral", "label": "...", "icon": "💬"},\n'
        '    {"text": "...", "type": "decline", "label": "...", "icon": "❌"}\n'
        '  ]\n'
        '}\n'
    )
    return (
        f"Hedef şema:\n{schema}\n"
        f"Gelen mesajın dili: {message_lang}\n"
        f"Yanıt dili (kullanıcının dili): {reply_lang}\n\n"
        "<incoming>\n"
        f"{text}\n"
        "</incoming>\n\n"
        "Yalnızca yukarıdaki şemada geçerli JSON döndür."
    )


def _rule_based_incoming_analysis(text: str, message_lang: str, reply_lang: str) -> dict:
    """LLM kullanılamadığında basit anahtar kelime tabanlı analiz."""
    lowered = text.lower()
    tone_scores: dict[str, int] = {k: 0 for k in _TONE_KEYWORDS}
    for tone, words in _TONE_KEYWORDS.items():
        for w in words:
            if w in lowered:
                tone_scores[tone] += 1

    tone = "neutral"
    if tone_scores:
        best_tone, best_score = max(tone_scores.items(), key=lambda kv: kv[1])
        if best_score > 0:
            tone = best_tone

    label_map = _TONE_LABELS.get(tone, _TONE_LABELS["neutral"])
    label = label_map.get(reply_lang, label_map["en"])

    # Çok kaba bir özet: ilk 120 karakter
    summary = text.strip().replace("\n", " ")[:140]

    # Yanıt dilinde basit jenerik öneriler
    if reply_lang == "tr":
        replies = [
            {"text": "Anladım, teşekkür ederim.",                 "type": "accept",  "label": "Olumlu", "icon": "✅"},
            {"text": "Biraz daha düşünüp size dönebilir miyim?",  "type": "neutral", "label": "Tarafsız", "icon": "💬"},
            {"text": "Şu an uygun değilim, anlayışınız için teşekkürler.", "type": "decline", "label": "Nazikçe reddet", "icon": "❌"},
        ]
    else:
        replies = [
            {"text": "Got it, thank you.",                              "type": "accept",  "label": "Accept",  "icon": "✅"},
            {"text": "Could I get back to you on this shortly?",        "type": "neutral", "label": "Neutral", "icon": "💬"},
            {"text": "Unfortunately I can't right now — thanks for understanding.", "type": "decline", "label": "Decline", "icon": "❌"},
        ]

    return {
        "tone": tone,
        "tone_label": label,
        "translated_meaning": summary,
        "cultural_notes": [],
        "reply_suggestions": replies,
    }


def _normalize_incoming_payload(raw: dict, reply_lang: str) -> dict:
    tone = (raw.get("tone") or "neutral").lower()
    if tone not in _TONE_LABELS:
        tone = "neutral"
    label_map = _TONE_LABELS[tone]
    label = label_map.get(reply_lang, label_map["en"])

    notes = raw.get("cultural_notes") or []
    if not isinstance(notes, list):
        notes = [str(notes)]
    notes = [str(n).strip() for n in notes if str(n).strip()][:3]

    raw_replies = raw.get("reply_suggestions") or []
    type_meta = {
        "accept":  {"label_tr": "Olumlu yanıt",   "label_en": "Accept",  "icon": "✅"},
        "neutral": {"label_tr": "Tarafsız yanıt", "label_en": "Neutral", "icon": "💬"},
        "decline": {"label_tr": "Nazikçe reddet", "label_en": "Decline", "icon": "❌"},
    }
    replies: list[dict] = []
    for s in raw_replies[:5]:
        if not isinstance(s, dict):
            continue
        s_text = (s.get("text") or "").strip()
        if not s_text:
            continue
        s_type = s.get("type") or "neutral"
        meta = type_meta.get(s_type, type_meta["neutral"])
        replies.append({
            "text": s_text,
            "type": s_type,
            "label": s.get("label") or (meta["label_tr"] if reply_lang == "tr" else meta["label_en"]),
            "icon": s.get("icon") or meta["icon"],
        })

    return {
        "tone": tone,
        "tone_label": label,
        "translated_meaning": (raw.get("translated_meaning") or "").strip(),
        "cultural_notes": notes,
        "reply_suggestions": replies,
    }


async def analyze_incoming_message(
    *,
    text: str,
    message_lang: str,
    reply_lang: str,
) -> dict:
    """
    Karşıdan gelen mesajı analiz eder: ton, kültürel ipuçları ve 3 yanıt önerisi.
    LLM birincil; başarısız olursa kural tabanlı fallback devreye girer.
    """
    if not text or not text.strip():
        return {
            "tone": "neutral",
            "tone_label": _TONE_LABELS["neutral"].get(reply_lang, "Neutral"),
            "translated_meaning": "",
            "cultural_notes": [],
            "reply_suggestions": [],
            "mode": "fallback",
            "fallback_reason": "empty_input",
            "message_lang": message_lang,
            "reply_lang": reply_lang,
        }

    fallback_reason = None
    fallback_detail = None
    if is_configured():
        try:
            system = _build_incoming_system_prompt(message_lang, reply_lang)
            user_prompt = _build_incoming_user_prompt(text, message_lang, reply_lang)
            raw = await call_llm_json(user_prompt, system=system)
            payload = _normalize_incoming_payload(raw, reply_lang)
            payload.update({
                "mode": "llm",
                "message_lang": message_lang,
                "reply_lang": reply_lang,
                "fallback_reason": None,
            })
            logger.info("✅ Gelen mesaj LLM analizi tamam (%s → %s)", message_lang, reply_lang)
            return payload
        except LLMRateLimited as e:
            fallback_reason, fallback_detail = "rate_limit", str(e)
            logger.warning("➡️  Gelen mesaj LLM kotası aşıldı, fallback'e geçiliyor.")
        except LLMUnavailable as e:
            fallback_reason, fallback_detail = "unavailable", str(e)
        except LLMResponseError as e:
            fallback_reason, fallback_detail = "response_error", str(e)
            logger.warning("➡️  Gelen mesaj LLM yanıt hatası: %s", fallback_detail)
    else:
        fallback_reason = "not_configured"
        fallback_detail = "GEMINI_API_KEY tanımlı değil"

    payload = _rule_based_incoming_analysis(text, message_lang, reply_lang)
    payload.update({
        "mode": "fallback",
        "message_lang": message_lang,
        "reply_lang": reply_lang,
        "fallback_reason": fallback_reason,
        "fallback_detail": fallback_detail,
    })
    return payload
