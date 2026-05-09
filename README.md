# LinguBridge AI

**Duygu ve Kültür Odaklı Akıllı İletişim Asistanı**

HCI (İnsan-Bilgisayar Etkileşimi) dersi için geliştirilen prototip. Geleneksel çeviri akışını **ses bazlı duygu analizi**, **5 seviyeli nezaket adaptasyonu**, **iki yönlü kültürel anlamlandırma** ve **duygulu TTS** ile genişletir. LLM (Gemini) birincil; hata/kota/timeout durumunda kural tabanlı motorlar fallback olarak devreye girer.

---

## İçindekiler

- [Mimari](#mimari)
- [Özellikler](#özellikler)
- [Hızlı Başlangıç](#hızlı-başlangıç)
  - [Docker ile (önerilen)](#docker-ile-önerilen)
  - [Yerel kurulum](#yerel-kurulum)
- [API Uçları](#api-uçları)
- [Çevre Değişkenleri](#çevre-değişkenleri)
- [Test & CI](#test--ci)
- [Proje Yapısı](#proje-yapısı)
- [Klavye Kısayolları](#klavye-kısayolları)
- [Güvenlik & Gizlilik](#güvenlik--gizlilik)

---

## Mimari

```
[Mikrofon] ─► STT (Web Speech API)
            ├► Audio Analysis (pitch / tempo / energy) ─► Emotion + confidence
            └► Source text ──┐
                             ▼
                  /api/process  (FastAPI + Gemini)
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
   LLM (Gemini 2.5)     Fallback engine     Konuşma geçmişi
   JSON mode +          (rate_limit /         (son 5 tur)
   safety settings      not_configured /
                        unavailable /
                        response_error)
        │                    │
        ▼                    ▼
 {translation, adapted_text, suggestions[3], tts_hints,
  mode: "llm" | "fallback", fallback_reason}
                             │
                             ▼
                 [UI: çeviri + öneriler + A/B TTS]

Aşağı tarafta ikinci kanal:
[Karşı tarafın mesajı] ──► /api/analyze-incoming
   → tone, tone_label, translated_meaning, cultural_notes,
     reply_suggestions[3] (kullanıcının dilinde)
```

- **LLM birincil**, kural tabanlı motorlar **fallback**. UI'da `🤖 LLM` veya `⚡ Fallback (sebep)` rozeti gösterilir.
- Tek `/api/process` çağrısı: çeviri + nezaket adaptasyonu + 3 sonraki cevap önerisi + TTS ipuçları aynı yanıtta.
- `/api/analyze-incoming` yeni: gelen yabancı mesajın tonunu ve kültürel ipuçlarını çıkarır, kullanıcının dilinde 3 cevap üretir.

---

## Özellikler

| Modül | Açıklama | Teknoloji |
|-------|----------|-----------|
| Sesli giriş (STT) | Mikrofon → metin | Web Speech API |
| Ses bazlı duygu | Pitch / tempo / enerji → 6 duygu + güven skoru | Web Audio API + kural tabanlı |
| LLM çeviri + adaptasyon | Tek istekte çeviri + nezaket + 3 öneri + TTS hint | Google Gemini 2.5 Flash (JSON mode) |
| Fallback motoru | LLM yok / quota / timeout / safety durumlarında devreye girer; sebep UI'da görünür | MyMemory + kural motoru |
| Nezaket sliderı | 5 seviye (çok samimi → çok resmi) + 700 ms debounce ile otomatik yeniden çeviri | TR/EN sözlükler + LLM |
| **A/B duygu TTS** | Aynı çeviriyi 😊 sıcak / 😐 nötr / 😔 yumuşak tonda dinleme | Web Speech Synthesis + LLM `tts_hints` |
| **Belirsiz duygu rozeti** | Mikrofon güveni < %35 ise "🤔 Belirsiz" uyarısı, manuel duygu seçimine yönlendirme | EmotionDisplay |
| **Gelen mesaj analizcisi** | Karşı tarafın yazdığı mesajı anla → ton, anlam, kültürel notlar, 3 cevap kartı | `/api/analyze-incoming` |
| Adaptif UI | Algılanan duyguya göre tema (renk, glow) | CSS değişkenleri |
| A11y | ARIA, klavye kısayolları, `prefers-reduced-motion` | — |

---

## Hızlı Başlangıç

### Docker ile (önerilen)

```bash
# 1. API anahtarını ayarla (boş bırakılırsa fallback modunda çalışır)
cp backend/.env.example backend/.env
# backend/.env içine GEMINI_API_KEY=... ekle

# 2. Build + ayağa kaldır
docker compose up -d --build

# 3. Durumu kontrol et
docker compose ps
```

| Servis | URL |
|--------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| Health | http://localhost:8000/api/health |

```bash
# Logları izle
docker compose logs -f backend
docker compose logs -f frontend

# Durdur
docker compose down
```

### Yerel kurulum

**Gereksinimler:** Node.js 18+, Python 3.10+

#### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# backend/.env içine GEMINI_API_KEY ekle (opsiyonel)
uvicorn main:app --reload --port 8000
```

#### Frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

---

## API Uçları

### `GET /api/health`
Servis sağlık kontrolü.

### `POST /api/process`
Tek seferde çeviri + nezaket adaptasyonu + öneriler + TTS hint.

```json
{
  "text": "your text is wrong, fix it",
  "source_lang": "en",
  "target_lang": "tr",
  "politeness_level": 4,
  "emotion": "neutral",
  "history": []
}
```

Yanıt:
```json
{
  "mode": "llm",
  "fallback_reason": null,
  "translated_text": "...",
  "adapted_text": "...",
  "changes_made": ["..."],
  "suggestions": [{"label": "...", "text": "...", "type": "...", "icon": "..."}],
  "tts_hints": {"rate": 1.0, "pitch": 1.0, "volume": 1.0},
  "detected_emotion": "neutral"
}
```

### `POST /api/analyze-incoming`
Karşıdan gelen yabancı dildeki mesajı analiz eder; kullanıcının dilinde 3 cevap önerir.

```json
{
  "text": "hey whats up man, you free tonight?",
  "message_lang": "en",
  "reply_lang": "tr"
}
```

Yanıt:
```json
{
  "tone": "warm",
  "tone_label": "Sıcak ve samimi",
  "translated_meaning": "Selam, naber dostum? Bu gece boş musun?",
  "cultural_notes": ["..."],
  "reply_suggestions": [
    {"label": "Olumlu", "text": "...", "type": "accept", "icon": "✅"},
    {"label": "Nötr", "text": "...", "type": "neutral", "icon": "💬"},
    {"label": "Reddetme", "text": "...", "type": "decline", "icon": "🙏"}
  ],
  "mode": "llm",
  "fallback_reason": null
}
```

### `POST /api/translate`, `POST /api/adapt-politeness`, `POST /api/suggestions`
Eski uyumluluk uçları (kural tabanlı tek modül çağrıları).

---

## Çevre Değişkenleri

`backend/.env`:

| Değişken | Varsayılan | Açıklama |
|----------|-----------|----------|
| `GEMINI_API_KEY` | — | Boşsa LLM devre dışı, fallback aktif (`fallback_reason: not_configured`) |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Gemini model adı |
| `LLM_TIMEOUT_SECONDS` | `20` | LLM çağrısı zaman aşımı |
| `ALLOW_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | CORS izinli kökenler |
| `MYMEMORY_EMAIL` | — | Fallback çevirisi için opsiyonel email (günlük limit artar) |

**Fallback sebepleri** (UI'da rozette görünür): `rate_limit`, `not_configured`, `unavailable`, `response_error`, `unknown`.

---

## Test & CI

```bash
# Backend
cd backend
source .venv/bin/activate
pip install -r requirements-dev.txt
pytest -q                    # 6 test

# Frontend
cd frontend
npm run lint
npm run build
```

CI: `.github/workflows/ci.yml` — push'larda backend pytest + frontend lint+build çalışır.

---

## Proje Yapısı

```
LinguBridge-AI/
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── main.py                       # /api/process, /api/analyze-incoming, ...
│   ├── pytest.ini
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   ├── .env.example
│   ├── services/
│   │   ├── llm_client.py             # Gemini sarıcısı (JSON mode + safety + timeout)
│   │   ├── orchestrator.py           # LLM-primary + fallback akışı
│   │   │                             #   process_message + analyze_incoming_message
│   │   ├── translation_service.py    # MyMemory çeviri (fallback)
│   │   ├── politeness_engine.py      # 5 seviyeli kural motoru
│   │   └── suggestion_engine.py
│   └── tests/
│       └── test_api.py
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx                   # Orkestrasyon, slider debounce, kısayollar
│       ├── App.css
│       ├── components/
│       │   ├── AudioRecorder.jsx
│       │   ├── EmotionDisplay.jsx           # + "Belirsiz" rozeti
│       │   ├── PolitenessSlider.jsx
│       │   ├── TranslationPanel.jsx         # + A/B duygu TTS önizleme
│       │   ├── SuggestionCards.jsx          # Sonraki cevap önerileri
│       │   ├── IncomingMessageAnalyzer.jsx  # Yeni: gelen mesaj kanalı
│       │   └── WaveformVisualizer.jsx
│       ├── hooks/
│       │   ├── useAudioAnalysis.js
│       │   └── useSpeechRecognition.js
│       └── utils/
│           ├── api.js                       # processMessage, analyzeIncomingMessage, ...
│           ├── ttsEngine.js                 # speakWithEmotion + EMOTION_DEFAULTS
│           ├── pitchDetector.js
│           └── emotionClassifier.js
├── demo/
│   └── scenarios.md                  # Sunum demo senaryoları
└── .github/workflows/ci.yml
```

---

## Klavye Kısayolları

- `Space` — mikrofon aç/kapat (buton odaktayken)
- `Cmd/Ctrl + Enter` — Çevir & Adapte Et
- `1` / `2` / `3` — N. öneriyi seç

---

## Güvenlik & Gizlilik

- `.env` git-ignore'da; API anahtarı asla repoya girmez.
- CORS yalnızca yapılandırılmış kökenlerden izin verir.
- LLM'e yalnızca son 5 tur konuşma geçmişi gönderilir (token + gizlilik dengesi).
- LLM yanıtı şemaya zorla normalize edilir; serbest metin doğrudan UI'a ulaşmaz.
- Gemini güvenlik filtreleri `BLOCK_ONLY_HIGH` ile yapılandırılmış; safety bloklarında otomatik fallback.

---

## Akademik Alanlar

Human-Computer Interaction (HCI) · Affective Computing · NLP + LLM Orchestration · Speech Processing

## Maliyet

Gemini 2.5 Flash ücretsiz katmanı + ücretsiz fallback servisleri. Geliştirme ve demo için **$0**.
