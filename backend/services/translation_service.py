"""
LinguBridge AI — Translation Service
Ücretsiz MyMemory Translation API kullanarak çeviri yapar.
API Key gerektirmez. Günlük 5000 karakter limiti vardır.
"""

import httpx
from typing import Optional


# Desteklenen diller
SUPPORTED_LANGUAGES = {
    "tr": "Türkçe",
    "en": "English",
    "de": "Deutsch",
    "fr": "Français",
    "es": "Español",
    "ja": "日本語",
    "ko": "한국어",
    "ar": "العربية",
    "zh": "中文",
    "ru": "Русский",
    "it": "Italiano",
    "pt": "Português",
}

MYMEMORY_API_URL = "https://api.mymemory.translated.net/get"


async def translate_text(
    text: str,
    source_lang: str,
    target_lang: str,
    email: Optional[str] = None
) -> dict:
    """
    MyMemory API ile ücretsiz çeviri yapar.
    
    Args:
        text: Çevrilecek metin
        source_lang: Kaynak dil kodu (ör. "en")
        target_lang: Hedef dil kodu (ör. "tr")
        email: Opsiyonel email (günlük limiti artırır)
    
    Returns:
        dict: {"translated_text": str, "match_quality": float}
    """
    if not text or not text.strip():
        return {"translated_text": "", "match_quality": 0}

    params = {
        "q": text,
        "langpair": f"{source_lang}|{target_lang}",
    }

    if email:
        params["de"] = email

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(MYMEMORY_API_URL, params=params)
            response.raise_for_status()
            data = response.json()

            if data.get("responseStatus") == 200:
                translated = data["responseData"]["translatedText"]
                match = data["responseData"].get("match", 0)
                return {
                    "translated_text": translated,
                    "match_quality": round(float(match), 2) if match else 0,
                }
            else:
                return {
                    "translated_text": f"[Çeviri hatası: {data.get('responseStatus')}]",
                    "match_quality": 0,
                }

    except httpx.TimeoutException:
        return {
            "translated_text": "[Çeviri zaman aşımı - lütfen tekrar deneyin]",
            "match_quality": 0,
        }
    except Exception as e:
        return {
            "translated_text": f"[Çeviri hatası: {str(e)}]",
            "match_quality": 0,
        }


def get_supported_languages() -> dict:
    """Desteklenen dillerin listesini döndürür."""
    return SUPPORTED_LANGUAGES
