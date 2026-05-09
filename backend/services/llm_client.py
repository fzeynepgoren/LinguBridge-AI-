"""
LinguBridge AI — LLM Client (Google Gemini)
Asenkron, JSON-mode çıktısı garantili LLM çağrı sarmalayıcı.

API key yoksa modül yüklenir ama çağrılar `LLMUnavailable` fırlatır;
orchestrator kural tabanlı fallback'e döner.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Optional

logger = logging.getLogger("lingubridge.llm")


class LLMUnavailable(Exception):
    """LLM çağrılamıyor (key yok, paket yok, kota dolu vb.)."""


class LLMRateLimited(LLMUnavailable):
    """Gemini kota/rate-limit aşıldı (HTTP 429)."""


class LLMResponseError(Exception):
    """LLM yanıtı parse edilemedi veya şemaya uymuyor."""


_GENAI = None  # google.generativeai modülü (lazy import)
_MODEL_CACHE: dict[str, Any] = {}


def _ensure_genai():
    global _GENAI
    if _GENAI is not None:
        return _GENAI

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise LLMUnavailable("GEMINI_API_KEY tanımlı değil")

    try:
        import google.generativeai as genai  # type: ignore
    except ImportError as e:
        raise LLMUnavailable(f"google-generativeai paketi kurulu değil: {e}") from e

    genai.configure(api_key=api_key)
    _GENAI = genai
    return genai


def _get_model(model_name: str):
    if model_name in _MODEL_CACHE:
        return _MODEL_CACHE[model_name]
    genai = _ensure_genai()
    # gemini-2.5-flash thinking tokenları çıktı bütçesini tüketir → 4096 tut.
    # Çeviri/adaptasyon aracı olduğumuz için Gemini'nin agresif güvenlik
    # filtrelerini gevşetiyoruz — kullanıcı küfürlü/argo metni de adapte
    # edebilmek için göndermek zorunda kalabilir.
    safety_settings = [
        {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_ONLY_HIGH"},
        {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_ONLY_HIGH"},
        {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_ONLY_HIGH"},
        {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_ONLY_HIGH"},
    ]
    model = genai.GenerativeModel(
        model_name=model_name,
        generation_config={
            "response_mime_type": "application/json",
            "temperature": 0.4,
            "top_p": 0.9,
            "max_output_tokens": 4096,
        },
        safety_settings=safety_settings,
    )
    _MODEL_CACHE[model_name] = model
    return model


def is_configured() -> bool:
    """API key tanımlı mı? (Hızlı kontrol; paketi yüklemez.)"""
    return bool(os.getenv("GEMINI_API_KEY", "").strip())


async def call_llm_json(prompt: str, *, system: Optional[str] = None) -> dict:
    """
    LLM'i çağırır ve JSON sözlük döndürür.

    Raises:
        LLMUnavailable: API key/paket yok.
        LLMResponseError: Yanıt JSON değil veya boş.
    """
    import asyncio

    timeout = float(os.getenv("LLM_TIMEOUT_SECONDS", "8"))
    model_name = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
    model = _get_model(model_name)

    full_prompt = f"{system}\n\n{prompt}" if system else prompt

    def _sync_call() -> str:
        # google-generativeai async API yok — thread'de çalıştır
        response = model.generate_content(full_prompt)
        return getattr(response, "text", "") or ""

    try:
        text = await asyncio.wait_for(asyncio.to_thread(_sync_call), timeout=timeout)
    except asyncio.TimeoutError as e:
        logger.warning("⏱️  LLM timeout (%.1fs) — fallback'e geçiliyor", timeout)
        raise LLMResponseError(f"LLM timeout ({timeout}s)") from e
    except Exception as e:  # noqa: BLE001
        msg = str(e)
        msg_lower = msg.lower()
        # Rate limit / kota aşımı
        if "429" in msg or "quota" in msg_lower or "rate limit" in msg_lower or "resource_exhausted" in msg_lower:
            logger.error("🚫 Gemini KOTA AŞIMI (429) — fallback'e geçiliyor. Detay: %s", msg[:200])
            raise LLMRateLimited(f"Gemini kotası aşıldı: {msg[:120]}") from e
        # Yetkilendirme
        if "api key" in msg_lower or "permission" in msg_lower or "unauthorized" in msg_lower or "403" in msg:
            logger.error("🔑 Gemini YETKİLENDİRME hatası — fallback'e geçiliyor. Detay: %s", msg[:200])
            raise LLMUnavailable(f"Yetkilendirme hatası: {msg[:120]}") from e
        # Safety filter
        if "safety" in msg_lower or "blocked" in msg_lower or "finish_reason" in msg_lower:
            logger.warning("🛡️  Gemini güvenlik filtresi engelledi — fallback'e geçiliyor. Detay: %s", msg[:200])
            raise LLMResponseError(f"Güvenlik filtresi engelledi: {msg[:120]}") from e
        # Network / diğer
        logger.warning("⚠️  LLM çağrı hatası — fallback'e geçiliyor. Detay: %s", msg[:200])
        raise LLMResponseError(f"LLM çağrı hatası: {msg[:120]}") from e

    text = text.strip()
    if not text:
        raise LLMResponseError("LLM boş yanıt döndürdü")

    # JSON-mode olsa bile bazen markdown wrapping olabilir
    if text.startswith("```"):
        # ```json\n...\n``` veya ```\n...\n```
        lines = [ln for ln in text.splitlines() if not ln.strip().startswith("```")]
        text = "\n".join(lines).strip()

    try:
        data = json.loads(text)
    except json.JSONDecodeError as e:
        logger.warning("LLM JSON parse hatası, ham yanıt: %r", text[:200])
        raise LLMResponseError(f"JSON parse edilemedi: {e}") from e

    if not isinstance(data, dict):
        raise LLMResponseError(f"Beklenmeyen JSON tipi: {type(data).__name__}")

    return data
