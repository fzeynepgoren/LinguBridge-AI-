"""
LinguBridge AI — Suggestion Engine
Konuşma bağlamına ve duygu durumuna göre bağlamsal yanıt önerileri üretir.
Şablon tabanlı — tamamen ücretsiz, API gereksiz.
"""

from typing import Optional, List


# ============================================================
# Bağlam Kategorileri ve Yanıt Şablonları
# ============================================================

# Duygu durumuna göre yanıt stratejileri
EMOTION_STRATEGIES = {
    "happy": {
        "tr": {
            "accept": "Bu harika bir fikir! 😊",
            "neutral": "Devam edelim, iyi gidiyor.",
            "decline": "Teşekkür ederim ama şimdilik olmaz.",
        },
        "en": {
            "accept": "That sounds great! 😊",
            "neutral": "Let's continue, going well.",
            "decline": "Thanks, but not right now.",
        },
    },
    "sad": {
        "tr": {
            "accept": "Elbette, yardımcı olabilirim.",
            "neutral": "Anlıyorum, devam edebiliriz.",
            "decline": "Maalesef şu an uygun değilim, üzgünüm.",
        },
        "en": {
            "accept": "Of course, I can help.",
            "neutral": "I understand, we can continue.",
            "decline": "I'm sorry, I'm not available right now.",
        },
    },
    "angry": {
        "tr": {
            "accept": "Haklısınız, hemen ilgilenelim.",
            "neutral": "Durumu birlikte değerlendirelim.",
            "decline": "Bu konuyu daha sonra ele alabiliriz.",
        },
        "en": {
            "accept": "You're right, let's address this now.",
            "neutral": "Let's evaluate this together.",
            "decline": "We can revisit this later.",
        },
    },
    "stressed": {
        "tr": {
            "accept": "Tabii, bu konuda destek olabilirim.",
            "neutral": "Adım adım ilerleyelim.",
            "decline": "Şu an biraz zamana ihtiyacım var.",
        },
        "en": {
            "accept": "Sure, I can support you on this.",
            "neutral": "Let's take it step by step.",
            "decline": "I need a moment right now.",
        },
    },
    "neutral": {
        "tr": {
            "accept": "Tamam, yapalım.",
            "neutral": "Anlaşıldı.",
            "decline": "Maalesef uygun değilim.",
        },
        "en": {
            "accept": "Okay, let's do it.",
            "neutral": "Understood.",
            "decline": "I'm not available, sorry.",
        },
    },
}

# Konuşma bağlamına göre ek öneriler
CONTEXT_PATTERNS = {
    "greeting": {
        "keywords_tr": ["merhaba", "selam", "günaydın", "iyi günler", "nasılsın"],
        "keywords_en": ["hello", "hi", "good morning", "how are you", "hey"],
        "suggestions_tr": [
            "Merhaba! Nasıl yardımcı olabilirim?",
            "İyi günler, hoş geldiniz.",
            "Selam! Her şey yolunda mı?",
        ],
        "suggestions_en": [
            "Hello! How can I help you?",
            "Good day, welcome.",
            "Hi! Is everything alright?",
        ],
    },
    "request": {
        "keywords_tr": ["yapabilir misin", "mümkün mü", "rica", "lütfen", "istiyorum", "lazım"],
        "keywords_en": ["can you", "could you", "please", "would you", "need", "want"],
        "suggestions_tr": [
            "Elbette, hemen ilgileniyorum.",
            "Bunu yapabilirim, biraz zaman alabilir.",
            "Maalesef bu konuda yardımcı olamıyorum.",
        ],
        "suggestions_en": [
            "Of course, I'll get right on it.",
            "I can do that, it might take a moment.",
            "Unfortunately, I can't help with that.",
        ],
    },
    "question": {
        "keywords_tr": ["ne", "nasıl", "neden", "nerede", "ne zaman", "kim", "mi", "mı"],
        "keywords_en": ["what", "how", "why", "where", "when", "who", "?"],
        "suggestions_tr": [
            "Bu konuda bilgi verebilirim.",
            "Bunu araştırmam gerekiyor.",
            "Maalesef bu konuda bilgim yok.",
        ],
        "suggestions_en": [
            "I can provide information on that.",
            "I need to look into that.",
            "I'm not sure about that, sorry.",
        ],
    },
    "farewell": {
        "keywords_tr": ["görüşürüz", "hoşça kal", "iyi günler", "bye", "güle güle"],
        "keywords_en": ["goodbye", "bye", "see you", "take care", "farewell"],
        "suggestions_tr": [
            "Görüşmek üzere! İyi günler.",
            "Hoşça kalın, iyi akşamlar.",
            "Teşekkürler, görüşürüz!",
        ],
        "suggestions_en": [
            "See you! Have a great day.",
            "Goodbye, have a nice evening.",
            "Thanks, see you later!",
        ],
    },
    "agreement": {
        "keywords_tr": ["tamam", "evet", "olur", "kabul", "anladım", "peki"],
        "keywords_en": ["okay", "yes", "sure", "agree", "understood", "alright"],
        "suggestions_tr": [
            "Harika, devam edelim!",
            "Anlaştık, ben de başlıyorum.",
            "Tamam, bir sonraki adıma geçebiliriz.",
        ],
        "suggestions_en": [
            "Great, let's continue!",
            "Agreed, I'll get started.",
            "Okay, we can move to the next step.",
        ],
    },
    "disagreement": {
        "keywords_tr": ["hayır", "katılmıyorum", "olmaz", "istemiyorum", "farklı düşünüyorum"],
        "keywords_en": ["no", "disagree", "don't", "won't", "can't", "refuse"],
        "suggestions_tr": [
            "Anlıyorum, farklı bir yaklaşım deneyelim.",
            "Saygı duyuyorum, alternatiflerimiz neler?",
            "Peki, bu konuyu tekrar değerlendirelim.",
        ],
        "suggestions_en": [
            "I understand, let's try a different approach.",
            "I respect that, what are our alternatives?",
            "Okay, let's reconsider this topic.",
        ],
    },
}


def detect_context(text: str, language: str = "tr") -> str:
    """Metnin bağlamını tespit eder."""
    text_lower = text.lower()
    key_suffix = f"keywords_{language}"

    best_match = "neutral"
    best_score = 0

    for context_name, context_data in CONTEXT_PATTERNS.items():
        keywords = context_data.get(key_suffix, [])
        score = sum(1 for kw in keywords if kw in text_lower)
        if score > best_score:
            best_score = score
            best_match = context_name

    return best_match if best_score > 0 else "neutral"


def generate_suggestions(
    text: str,
    language: str = "tr",
    emotion: str = "neutral",
    politeness_level: int = 50,
    conversation_history: Optional[List] = None,
) -> dict:
    """
    Bağlamsal yanıt önerileri üretir.
    
    Args:
        text: Son konuşma metni
        language: Dil kodu
        emotion: Tespit edilen duygu
        politeness_level: Nezaket seviyesi (0-100)
        conversation_history: Geçmiş konuşma listesi
    
    Returns:
        dict: {
            "suggestions": list[dict],
            "detected_context": str,
            "reasoning": str
        }
    """
    # Bağlam tespiti
    context = detect_context(text, language)

    # Duygu bazlı temel öneriler
    emotion_data = EMOTION_STRATEGIES.get(emotion, EMOTION_STRATEGIES["neutral"])
    lang_data = emotion_data.get(language, emotion_data.get("en", {}))

    suggestions = []

    # Duygu bazlı 3 temel öneri
    for response_type, response_text in lang_data.items():
        icon = {"accept": "✅", "neutral": "💬", "decline": "❌"}.get(response_type, "💬")
        label = {
            "accept": "Kabul" if language == "tr" else "Accept",
            "neutral": "Nötr" if language == "tr" else "Neutral",
            "decline": "Reddet" if language == "tr" else "Decline",
        }.get(response_type, response_type)

        suggestions.append({
            "text": response_text,
            "type": response_type,
            "label": label,
            "icon": icon,
        })

    # Bağlam bazlı ek öneriler
    if context != "neutral" and context in CONTEXT_PATTERNS:
        ctx_suggestions = CONTEXT_PATTERNS[context].get(f"suggestions_{language}", [])
        for i, sugg_text in enumerate(ctx_suggestions[:2]):  # En fazla 2 ek öneri
            suggestions.append({
                "text": sugg_text,
                "type": "contextual",
                "label": f"Bağlamsal {i+1}" if language == "tr" else f"Contextual {i+1}",
                "icon": "🎯",
            })

    # Açıklama metni
    context_labels = {
        "greeting": "Selamlaşma" if language == "tr" else "Greeting",
        "request": "İstek/Rica" if language == "tr" else "Request",
        "question": "Soru" if language == "tr" else "Question",
        "farewell": "Vedalaşma" if language == "tr" else "Farewell",
        "agreement": "Onay" if language == "tr" else "Agreement",
        "disagreement": "İtiraz" if language == "tr" else "Disagreement",
        "neutral": "Genel" if language == "tr" else "General",
    }

    reasoning_tr = f"Duygu: {emotion} | Bağlam: {context_labels.get(context, context)} | Nezaket: {politeness_level}/100"
    reasoning_en = f"Emotion: {emotion} | Context: {context_labels.get(context, context)} | Politeness: {politeness_level}/100"

    return {
        "suggestions": suggestions,
        "detected_context": context,
        "reasoning": reasoning_tr if language == "tr" else reasoning_en,
    }
