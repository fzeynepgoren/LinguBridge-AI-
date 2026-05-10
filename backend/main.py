"""
LinguBridge AI — Backend API
FastAPI tabanlı REST API. Tüm AI servislerini orkestrasyonla sunar.

Endpoints:
  POST /api/process            → Çeviri + nezaket + öneri + TTS hint (LLM birincil)
  POST /api/translate          → Çeviri + nezaket adaptasyonu (geri uyumluluk)
  POST /api/suggestions        → Bağlamsal yanıt önerileri (geri uyumluluk)
  POST /api/politeness         → Nezaket dönüşümü (tek başına)
  GET  /api/languages          → Desteklenen diller
  GET  /api/health             → Sağlık kontrolü
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# .env dosyasını backend/ klasöründen yükle (varsa)
_BACKEND_DIR = Path(__file__).resolve().parent
load_dotenv(_BACKEND_DIR / ".env")

from services.llm_client import is_configured as llm_is_configured  # noqa: E402
from services.orchestrator import analyze_incoming_message, process_message  # noqa: E402
from services.politeness_engine import rewrite_politeness  # noqa: E402
from services.suggestion_engine import generate_suggestions  # noqa: E402
from services.translation_service import get_supported_languages  # noqa: E402

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("lingubridge")


# ============================================================
# FastAPI App
# ============================================================

app = FastAPI(
    title="LinguBridge AI API",
    description="Duygu ve Kültür Odaklı Akıllı İletişim Asistanı",
    version="1.1.0",
)

_allow_origins_env = os.getenv(
    "ALLOW_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
)
_allow_origins = [o.strip() for o in _allow_origins_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allow_origins or ["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


# ============================================================
# Request/Response Modelleri
# ============================================================

class HistoryTurn(BaseModel):
    role: str = Field(default="user", description="user veya partner")
    text: str = Field(default="")
    emotion: Optional[str] = Field(default="neutral")


class ProcessRequest(BaseModel):
    text: str = Field(..., description="İşlenecek metin")
    source_lang: str = Field(default="en")
    target_lang: str = Field(default="tr")
    politeness_level: int = Field(default=50, ge=0, le=100)
    emotion: Optional[str] = Field(default="neutral")
    conversation_history: Optional[list[HistoryTurn]] = Field(default=None)


class TranslateRequest(BaseModel):
    text: str = Field(..., description="Çevrilecek metin")
    source_lang: str = Field(default="en")
    target_lang: str = Field(default="tr")
    politeness_level: int = Field(default=50, ge=0, le=100)
    emotion: Optional[str] = Field(default="neutral")


class PolitenessRequest(BaseModel):
    text: str = Field(..., description="Dönüştürülecek metin")
    politeness_level: int = Field(default=50, ge=0, le=100)
    language: str = Field(default="tr")
    emotion: Optional[str] = Field(default=None)


class SuggestionRequest(BaseModel):
    text: str = Field(..., description="Son konuşma metni")
    language: str = Field(default="tr")
    emotion: str = Field(default="neutral")
    politeness_level: int = Field(default=50, ge=0, le=100)
    conversation_history: Optional[list] = Field(default=None)


class AnalyzeIncomingRequest(BaseModel):
    text: str = Field(..., description="Karşıdan gelen mesaj")
    message_lang: str = Field(default="en", description="Gelen mesajın dili")
    reply_lang: str = Field(default="tr", description="Kullanıcının yanıt yazacağı dil")


# ============================================================
# Endpoints
# ============================================================

@app.get("/api/health")
async def health_check():
    """Sistem sağlık kontrolü."""
    return {
        "status": "healthy",
        "service": "LinguBridge AI",
        "version": "1.1.0",
        "llm": "configured" if llm_is_configured() else "fallback",
    }


@app.get("/api/languages")
async def list_languages():
    return {"languages": get_supported_languages()}


@app.post("/api/process")
async def process(request: ProcessRequest):
    """
    Tek istekte çeviri + nezaket + öneri + TTS ipuçları döndürür.
    LLM birincil; başarısız olursa kural tabanlı fallback devreye girer.
    """
    history = [t.model_dump() for t in (request.conversation_history or [])]
    result = await process_message(
        text=request.text,
        source_lang=request.source_lang,
        target_lang=request.target_lang,
        politeness_level=request.politeness_level,
        emotion=request.emotion or "neutral",
        conversation_history=history,
    )
    return result


@app.post("/api/translate")
async def translate(request: TranslateRequest):
    """
    Geri uyumluluk: orchestrator çıktısını eski şemaya yakın bir şekle çevirir.
    """
    result = await process_message(
        text=request.text,
        source_lang=request.source_lang,
        target_lang=request.target_lang,
        politeness_level=request.politeness_level,
        emotion=request.emotion or "neutral",
        conversation_history=[],
    )
    return {
        "original_text": request.text,
        "translated_text": result.get("translated_text", ""),
        "adapted_text": result.get("adapted_text", ""),
        "politeness_label": result.get("politeness_label", "neutral"),
        "changes_made": result.get("changes_explained", []),
        "match_quality": result.get("match_quality", 0),
        "tts_hints": result.get("tts_hints", {}),
        "mode": result.get("mode", "fallback"),
        "emotion": result.get("emotion", request.emotion),
        "source_lang": request.source_lang,
        "target_lang": request.target_lang,
    }


@app.post("/api/politeness")
async def adapt_politeness(request: PolitenessRequest):
    """Metni nezaket seviyesine göre dönüştürür (çeviri olmadan, kural tabanlı)."""
    return rewrite_politeness(
        text=request.text,
        politeness_level=request.politeness_level,
        language=request.language,
        emotion=request.emotion,
    )


@app.post("/api/suggestions")
async def get_suggestions(request: SuggestionRequest):
    """Bağlamsal yanıt önerileri üretir (kural tabanlı)."""
    return generate_suggestions(
        text=request.text,
        language=request.language,
        emotion=request.emotion,
        politeness_level=request.politeness_level,
        conversation_history=request.conversation_history,
    )


@app.post("/api/analyze-incoming")
async def analyze_incoming(request: AnalyzeIncomingRequest):
    """
    Karşıdan gelen bir mesajı analiz eder: ton, kültürel notlar ve
    kullanıcının yanıt dilinde 3 cevap önerisi döner.
    LLM birincil; başarısız olursa kural tabanlı fallback devreye girer.
    """
    return await analyze_incoming_message(
        text=request.text,
        message_lang=request.message_lang,
        reply_lang=request.reply_lang,
    )


# ============================================================
# Çalıştırma
# ============================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
