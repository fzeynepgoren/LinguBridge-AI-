"""
LinguBridge AI — Politeness Engine
Kural tabanlı nezaket adaptasyonu motoru.
Metin girişini slider değerine (0-100) göre resmi veya samimi tona dönüştürür.
Dilbilimsel kurallar ve şablonlar kullanır — tamamen ücretsiz, API gereksiz.
"""

from typing import Optional

# ============================================================
# Türkçe Nezaket Dönüşüm Kuralları
# ============================================================

# Sen → Siz dönüşümleri ve fiil çekimleri
TR_INFORMAL_TO_FORMAL = {
    # Hitap
    "sen": "siz",
    "sana": "size",
    "seni": "sizi",
    "senin": "sizin",
    "sende": "sizde",
    "senden": "sizden",
    "seninle": "sizinle",
    # Yaygın fiil çekimleri
    "yapabilir misin": "yapabilir misiniz",
    "yapar mısın": "yapar mısınız",
    "eder misin": "eder misiniz",
    "eder msın": "eder misiniz",
    "gönderir misin": "gönderir misiniz",
    "bakar mısın": "bakar mısınız",
    "gelir misin": "gelir misiniz",
    "söyler misin": "söyler misiniz",
    "yardım eder misin": "yardım eder misiniz",
    "bilir misin": "bilir misiniz",
    "verir misin": "verir misiniz",
    "alır mısın": "alır mısınız",
    "kapatır mısın": "kapatır mısınız",
    "açar mısın": "açar mısınız",
    # Emir kipi → rica
    "yap": "yapınız",
    "gel": "geliniz",
    "gönder": "gönderiniz",
    "bak": "bakınız",
    "kapat": "kapatınız",
    "aç": "açınız",
    "söyle": "söyleyiniz",
    "ver": "veriniz",
    "al": "alınız",
    # Gayriresmi ifadeler
    "hadi": "lütfen",
    "yahu": "",
    "ya": "",
    "lan": "",
    "abi": "beyefendi",
    "kanka": "",
    "hocam": "sayın hocam",
    "tamam": "pekâlâ",
    "ok": "anlaşıldı",
}

TR_FORMAL_TO_INFORMAL = {v: k for k, v in TR_INFORMAL_TO_FORMAL.items() if v}

# Nezaket seviyesine göre ek ifadeler
TR_POLITENESS_PREFIXES = {
    "very_formal": [
        "Rica ederim, ",
        "Müsaade ederseniz, ",
        "İzninizle, ",
        "Saygılarımla belirtmek isterim ki, ",
    ],
    "formal": [
        "Lütfen, ",
        "Rica etsem, ",
    ],
    "neutral": [],
    "informal": [],
    "very_informal": [
        "Hadi, ",
        "Bak, ",
    ],
}

TR_POLITENESS_SUFFIXES = {
    "very_formal": [
        ", mümkün müdür?",
        ", lütfen.",
        ", rica ederim.",
    ],
    "formal": [
        ", lütfen.",
        ".",
    ],
    "neutral": [".", ""],
    "informal": [".", "!"],
    "very_informal": ["!", " ya!", " be!"],
}

# ============================================================
# İngilizce Nezaket Dönüşüm Kuralları
# ============================================================

EN_INFORMAL_TO_FORMAL = {
    "can you": "could you kindly",
    "i want": "I would like",
    "i wanna": "I would like to",
    "gonna": "going to",
    "gotta": "have to",
    "wanna": "would like to",
    "gimme": "please give me",
    "yeah": "yes",
    "yep": "yes",
    "nope": "no",
    "hey": "hello",
    "hi": "hello",
    "sup": "hello",
    "thanks": "thank you",
    "thx": "thank you",
    "ok": "understood",
    "sure": "certainly",
    "cool": "understood",
    "awesome": "excellent",
    "dude": "sir",
    "bro": "sir",
    "mate": "colleague",
    "guys": "everyone",
    "stuff": "items",
    "kind of": "somewhat",
    "sort of": "somewhat",
    "a lot": "considerably",
    "really": "quite",
    "pretty much": "largely",
    "btw": "additionally",
    "asap": "at your earliest convenience",
    "fyi": "for your information",
}

EN_FORMAL_TO_INFORMAL = {v.lower(): k for k, v in EN_INFORMAL_TO_FORMAL.items() if v}

EN_POLITENESS_PREFIXES = {
    "very_formal": [
        "I respectfully request that ",
        "If it would not be too much trouble, ",
        "I would be most grateful if ",
    ],
    "formal": [
        "Please ",
        "Would you mind ",
        "Could you please ",
    ],
    "neutral": [],
    "informal": [],
    "very_informal": [
        "Hey, ",
        "Yo, ",
    ],
}


def get_politeness_level(slider_value: int) -> str:
    """
    Slider değerini (0-100) nezaket seviyesine çevirir.
    
    0-33:   informal (samimi)
    34-66:  neutral (nötr)
    67-100: formal (resmi)
    """
    if slider_value <= 33:
        return "informal"
    elif slider_value <= 66:
        return "neutral"
    else:
        return "formal"


def rewrite_politeness(
    text: str,
    politeness_level: int,
    language: str = "tr",
    emotion: Optional[str] = None
) -> dict:
    """
    Metni nezaket seviyesine göre yeniden yazar.
    
    Args:
        text: Orijinal metin
        politeness_level: 0 (çok samimi) → 100 (çok resmi)
        language: Dil kodu ("tr" veya "en")
        emotion: Tespit edilen duygu (opsiyonel)
    
    Returns:
        dict: {
            "rewritten_text": str,
            "politeness_label": str,
            "changes_made": list[str]
        }
    """
    if not text or not text.strip():
        return {
            "rewritten_text": text,
            "politeness_label": "neutral",
            "changes_made": [],
        }

    level = get_politeness_level(politeness_level)
    changes = []

    if language == "tr":
        result = _rewrite_turkish(text, level, changes)
    elif language == "en":
        result = _rewrite_english(text, level, changes)
    else:
        result = text

    # Duygu durumuna göre ek ayarlama
    if emotion and emotion in ("angry", "stressed"):
        if level in ("formal", "very_formal"):
            changes.append("Stresli ton tespit edildi — sakinleştirici ifade eklendi")
            if language == "tr":
                result = "Anlıyorum, " + result[0].lower() + result[1:]
            else:
                result = "I understand, " + result[0].lower() + result[1:]

    return {
        "rewritten_text": result,
        "politeness_label": level,
        "changes_made": changes,
    }


def _rewrite_turkish(text: str, level: str, changes: list) -> str:
    """Türkçe metin için nezaket dönüşümü uygular."""
    result = text

    if level in ("formal", "very_formal"):
        # Samimi → resmi dönüşüm
        import re
        for informal, formal in TR_INFORMAL_TO_FORMAL.items():
            # Word boundary kullanarak sadece tam kelimeleri/öbekleri eşleştir
            pattern = re.compile(r'\b' + re.escape(informal) + r'\b', re.IGNORECASE | re.UNICODE)
            if pattern.search(result):
                if formal:
                    result, count = pattern.subn(formal, result)
                    if count > 0:
                        changes.append(f'"{informal}" → "{formal}"')
                else:
                    result, count = pattern.subn("", result)
                    if count > 0:
                        changes.append(f'"{informal}" kaldırıldı')


    elif level in ("informal", "very_informal"):
        # Resmi → samimi dönüşüm
        import re
        for formal, informal in TR_FORMAL_TO_INFORMAL.items():
            pattern = re.compile(r'\b' + re.escape(formal) + r'\b', re.IGNORECASE | re.UNICODE)
            if pattern.search(result):
                result, count = pattern.subn(informal, result)
                if count > 0:
                    changes.append(f'"{formal}" → "{informal}"')

    # Fazla boşlukları temizle
    import re
    result = re.sub(r'\s+', ' ', result).strip()

    return result


def _rewrite_english(text: str, level: str, changes: list) -> str:
    """İngilizce metin için nezaket dönüşümü uygular."""
    result = text

    if level in ("formal", "very_formal"):
        import re
        for informal, formal in EN_INFORMAL_TO_FORMAL.items():
            pattern = re.compile(r'\b' + re.escape(informal) + r'\b', re.IGNORECASE | re.UNICODE)
            if pattern.search(result):
                result, count = pattern.subn(formal, result)
                if count > 0:
                    changes.append(f'"{informal}" → "{formal}"')


    elif level in ("informal", "very_informal"):
        import re
        for formal, informal in EN_FORMAL_TO_INFORMAL.items():
            pattern = re.compile(r'\b' + re.escape(formal) + r'\b', re.IGNORECASE | re.UNICODE)
            if pattern.search(result):
                result, count = pattern.subn(informal, result)
                if count > 0:
                    changes.append(f'"{formal}" → "{informal}"')

    import re
    result = re.sub(r'\s+', ' ', result).strip()

    return result


# Demo amaçlı sabit örnekler
DEMO_EXAMPLES = {
    "tr": {
        "Kapıyı kapat.": {
            "very_informal": "Kanka kapıyı kapatsana!",
            "informal": "Kapıyı kapatır mısın?",
            "neutral": "Kapıyı kapatabilir misin?",
            "formal": "Kapıyı kapatmanız mümkün mü?",
            "very_formal": "Rica ederim, kapıyı kapatmanızı istirham ederim.",
        },
        "Dosyayı gönder.": {
            "very_informal": "Dosyayı atsana hadi!",
            "informal": "Dosyayı gönderir misin?",
            "neutral": "Dosyayı gönderebilir misin?",
            "formal": "Dosyayı göndermeniz mümkün müdür?",
            "very_formal": "Rica ederim, ilgili dosyayı tarafıma iletmenizi rica ederim.",
        },
    },
    "en": {
        "Close the door.": {
            "very_informal": "Hey, shut the door!",
            "informal": "Can you close the door?",
            "neutral": "Could you close the door?",
            "formal": "Would you mind closing the door, please?",
            "very_formal": "I would be most grateful if you could kindly close the door.",
        },
    },
}
