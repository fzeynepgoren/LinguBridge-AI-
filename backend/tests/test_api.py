"""
Backend API tests — LinguBridge AI
Pytest + httpx.AsyncClient ile FastAPI uygulamasını test eder.
LLM çağrıları monkeypatch ile fallback'a zorlanır.
"""

import pytest
from httpx import AsyncClient, ASGITransport

import sys
from pathlib import Path

# backend dizinini import path'e ekle
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from main import app
from services import llm_client, orchestrator


@pytest.fixture
def force_fallback(monkeypatch):
    """LLM'i her zaman 'configured değil' olarak göster — fallback path test edilir."""
    monkeypatch.setattr(llm_client, "is_configured", lambda: False)
    monkeypatch.setattr(orchestrator, "is_configured", lambda: False)
    yield


@pytest.fixture
def force_llm_success(monkeypatch):
    """LLM çağrısını sahte JSON ile yanıtla."""
    monkeypatch.setattr(llm_client, "is_configured", lambda: True)
    monkeypatch.setattr(orchestrator, "is_configured", lambda: True)

    async def fake_call(prompt, system=None):
        return {
            "translated_text": "Merhaba dünya.",
            "adapted_text": "Merhaba, dünya.",
            "politeness_label": "neutral",
            "changes_explained": ["test değişikliği"],
            "suggestions": [
                {"text": "Selam!", "label": "samimi", "reasoning": "kısa hâl"},
                {"text": "Merhaba.", "label": "nötr", "reasoning": "standart"},
                {"text": "İyi günler.", "label": "resmi", "reasoning": "kibar"},
            ],
            "tts_hints": {"rate": 1.0, "pitch": 1.0, "volume": 1.0},
            "reasoning": "test",
        }

    monkeypatch.setattr(llm_client, "call_llm_json", fake_call)
    monkeypatch.setattr(orchestrator, "call_llm_json", fake_call)
    yield


@pytest.mark.asyncio
async def test_health_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "healthy"
    assert "llm" in body


@pytest.mark.asyncio
async def test_languages_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/languages")
    assert res.status_code == 200
    langs = res.json()["languages"]
    # API dict döndürüyor: {code: name}
    assert isinstance(langs, dict)
    for c in ("tr", "en", "it", "de", "fr"):
        assert c in langs


@pytest.mark.asyncio
async def test_process_fallback(force_fallback):
    transport = ASGITransport(app=app)
    payload = {
        "text": "hi can you help me",
        "source_lang": "en",
        "target_lang": "tr",
        "politeness_level": 90,
        "emotion": "neutral",
        "conversation_history": [],
    }
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post("/api/process", json=payload)
    assert res.status_code == 200
    body = res.json()
    assert body["mode"] == "fallback"
    assert body["adapted_text"]
    assert isinstance(body["suggestions"], list)
    assert isinstance(body["tts_hints"], dict)
    assert {"rate", "pitch", "volume"} <= set(body["tts_hints"].keys())


@pytest.mark.asyncio
async def test_process_llm_success(force_llm_success):
    transport = ASGITransport(app=app)
    payload = {
        "text": "hello",
        "source_lang": "en",
        "target_lang": "tr",
        "politeness_level": 50,
        "emotion": "happy",
        "conversation_history": [
            {"role": "user", "text": "hi", "emotion": "happy"}
        ],
    }
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post("/api/process", json=payload)
    assert res.status_code == 200
    body = res.json()
    assert body["mode"] == "llm"
    assert body["adapted_text"] == "Merhaba, dünya."
    assert len(body["suggestions"]) == 3


@pytest.mark.asyncio
async def test_politeness_levels_5_tier():
    """Slider değerleri 5 nezaket seviyesine dağılmalı."""
    from services.politeness_engine import get_politeness_level

    assert get_politeness_level(0) == "very_informal"
    assert get_politeness_level(15) == "very_informal"
    assert get_politeness_level(30) == "informal"
    assert get_politeness_level(50) == "neutral"
    assert get_politeness_level(75) == "formal"
    assert get_politeness_level(95) == "very_formal"


@pytest.mark.asyncio
async def test_orchestrator_normalizes_tts_hints():
    """LLM hatalı tts_hints döndürse bile orchestrator clamp eder."""
    payload = {
        "translated_text": "x",
        "adapted_text": "x",
        "tts_hints": {"rate": 999, "pitch": -5, "volume": 2.5},
    }
    normalized = orchestrator._normalize_llm_payload(
        payload,
        fallback_translated="x",
        politeness_label="neutral",
        emotion="neutral",
        target_lang="tr",
    )
    h = normalized["tts_hints"]
    assert 0.5 <= h["rate"] <= 1.6
    assert 0.5 <= h["pitch"] <= 1.6
    assert 0.3 <= h["volume"] <= 1.0
