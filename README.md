# 🌉 LinguBridge AI

**Duygu ve Kültür Odaklı Akıllı İletişim Asistanı**

HCI (İnsan-Bilgisayar Etkileşimi) dersi projesi. Geleneksel çeviri araçlarını HCI prensipleriyle birleştiren akıllı bir iletişim köprüsü.

## ✨ Özellikler

| Modül | Açıklama | Teknoloji |
|-------|----------|-----------|
| 🎤 Speech-to-Text | Sesli giriş → metin | Web Speech API |
| 🧠 Duygu Analizi | Pitch, tempo, enerji → duygu | Web Audio API + Kural Tabanlı |
| 🌍 Çeviri | 12 dil arası çeviri | MyMemory API (ücretsiz) |
| 🎚️ Nezaket Slider | Samimi ↔ Resmi ton dönüşümü | Kural Tabanlı Motor |
| 💡 Yanıt Önerileri | Bağlamsal akıllı öneriler | Şablon Tabanlı |
| 🎨 Adaptif UI | Duyguya göre tema değişimi | CSS Dinamik Değişkenler |
| 🔊 TTS | Çeviriyi sesli okuma | Web Speech Synthesis |

## 🚀 Kurulum & Çalıştırma

### Gereksinimler
- **Node.js** 18+
- **Python** 3.10+ (3.12 önerilir)

### Backend
```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Tarayıcıda **http://localhost:5173** adresini açın.

## 🏗️ Proje Yapısı

```
LinguBridge-AI/
├── backend/                    # Python FastAPI
│   ├── main.py                 # API endpoint'leri
│   └── services/
│       ├── translation_service.py   # MyMemory çeviri
│       ├── politeness_engine.py     # Nezaket dönüşüm
│       └── suggestion_engine.py     # Bağlamsal öneriler
├── frontend/                   # React + Vite
│   └── src/
│       ├── App.jsx             # Ana orkestrasyon
│       ├── components/         # UI bileşenleri
│       ├── hooks/              # Ses analizi, STT
│       └── utils/              # Pitch, duygu, API
```

## 💰 Maliyet

**$0** — Tüm servisler tamamen ücretsizdir.

## 📚 Akademik Alanlar

- Human-Computer Interaction (HCI)
- Natural Language Processing (NLP)
- Affective Computing
- Speech Processing
