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
    "it": "Italiano",
    "ja": "日本語",
    "ko": "한국어",
    "ar": "العربية",
    "zh": "中文",
    "ru": "Русский",
    "pt": "Português",
}

# MyMemory API için çeviri öncesi slang normalizasyonu
# MyMemory crowd-sourced olduğu için bazı kısa kelimelere yanlış/garip cevaplar verebiliyor.
SLANG_NORMALIZATION = {
    "tr": {
        "naber": "ne haber",
        "napiyorsun": "ne yapıyorsun",
        "napıyorsun": "ne yapıyorsun",
        "nasılsın": "nasılsın",
        "nbr": "ne haber",
        "slm": "selam",
        "mrb": "merhaba",
        "eyvallah": "teşekkür ederim",
        "eyv": "teşekkür ederim",
    },
    "en": {
        "wanna": "want to",
        "gonna": "going to",
        "gotta": "have to",
        "lemme": "let me",
        "gimme": "give me",
        "brb": "be right back",
        "idk": "i don't know",
    }
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

    # Çeviri öncesi normalizasyon
    normalized_text = text.strip()
    if source_lang in SLANG_NORMALIZATION:
        normalized_lower = normalized_text.lower()
        if normalized_lower in SLANG_NORMALIZATION[source_lang]:
            normalized_text = SLANG_NORMALIZATION[source_lang][normalized_lower]
        else:
            # Sadece tam eşleşme değil, metin içindeki kelimeleri de normalize edebiliriz, 
            # ama tam eşleşme en güvenlisi.
            import re
            for slang, formal in SLANG_NORMALIZATION[source_lang].items():
                normalized_text = re.sub(r'\b' + re.escape(slang) + r'\b', formal, normalized_text, flags=re.IGNORECASE)

    params = {
        "q": normalized_text,
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
