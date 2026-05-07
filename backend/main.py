"""
LinguBridge AI — Backend API
FastAPI tabanlı REST API. Tüm AI servislerini orkestrasyonla sunar.

Endpoints:
  POST /api/translate          → Çeviri + nezaket adaptasyonu
  POST /api/suggestions        → Bağlamsal yanıt önerileri
  POST /api/politeness         → Nezaket dönüşümü (tek başına)
  GET  /api/languages          → Desteklenen diller
  GET  /api/health             → Sağlık kontrolü
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional

from services.translation_service import translate_text, get_supported_languages
from services.politeness_engine import rewrite_politeness
from services.suggestion_engine import generate_suggestions


# ============================================================
# FastAPI App
# ============================================================

app = FastAPI(
    title="LinguBridge AI API",
    description="Duygu ve Kültür Odaklı Akıllı İletişim Asistanı",
    version="1.0.0",
)

# CORS — frontend'den erişim için
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Geliştirme için açık
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# Request/Response Modelleri
# ============================================================

class TranslateRequest(BaseModel):
    text: str = Field(..., description="Çevrilecek metin")
    source_lang: str = Field(default="en", description="Kaynak dil kodu")
    target_lang: str = Field(default="tr", description="Hedef dil kodu")
    politeness_level: int = Field(default=50, ge=0, le=100, description="Nezaket seviyesi (0-100)")
    emotion: Optional[str] = Field(default="neutral", description="Tespit edilen duygu durumu")


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


# ============================================================
# Endpoints
# ============================================================

@app.get("/api/health")
async def health_check():
    """Sistem sağlık kontrolü."""
    return {
        "status": "healthy",
        "service": "LinguBridge AI",
        "version": "1.0.0",
    }


@app.get("/api/languages")
async def list_languages():
    """Desteklenen dillerin listesini döndürür."""
    return {
        "languages": get_supported_languages(),
    }


@app.post("/api/translate")
async def translate(request: TranslateRequest):
    """
    Metni çevirir ve nezaket seviyesine göre adapte eder.
    
    İşlem akışı:
    1. Kaynak metni hedef dile çevir (MyMemory API)
    2. Çevrilmiş metni nezaket seviyesine göre yeniden yaz
    3. Duygu durumuna göre ince ayar yap
    """
    # Adım 1: Çeviri
    translation_result = await translate_text(
        text=request.text,
        source_lang=request.source_lang,
        target_lang=request.target_lang,
    )

    translated_text = translation_result["translated_text"]

    # Adım 2: Nezaket adaptasyonu
    politeness_result = rewrite_politeness(
        text=translated_text,
        politeness_level=request.politeness_level,
        language=request.target_lang,
        emotion=request.emotion,
    )

    return {
        "original_text": request.text,
        "translated_text": translated_text,
        "adapted_text": politeness_result["rewritten_text"],
        "politeness_label": politeness_result["politeness_label"],
        "changes_made": politeness_result["changes_made"],
        "match_quality": translation_result["match_quality"],
        "emotion": request.emotion,
        "source_lang": request.source_lang,
        "target_lang": request.target_lang,
    }


@app.post("/api/politeness")
async def adapt_politeness(request: PolitenessRequest):
    """Metni nezaket seviyesine göre dönüştürür (çeviri olmadan)."""
    result = rewrite_politeness(
        text=request.text,
        politeness_level=request.politeness_level,
        language=request.language,
        emotion=request.emotion,
    )
    return result


@app.post("/api/suggestions")
async def get_suggestions(request: SuggestionRequest):
    """Bağlamsal yanıt önerileri üretir."""
    result = generate_suggestions(
        text=request.text,
        language=request.language,
        emotion=request.emotion,
        politeness_level=request.politeness_level,
        conversation_history=request.conversation_history,
    )
    return result


# ============================================================
# Çalıştırma
# ============================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
