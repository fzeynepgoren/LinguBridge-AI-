/**
 * LinguBridge AI — TTS Engine
 * Duygu durumuna göre Web Speech Synthesis API'sine pitch/rate/volume aktarır.
 * LLM `tts_hints` döndüyse onları öncelikli kullanır.
 */

// Duygu → varsayılan TTS parametreleri
const EMOTION_DEFAULTS = {
  happy:    { rate: 1.10, pitch: 1.15, volume: 1.0 },
  sad:      { rate: 0.85, pitch: 0.85, volume: 0.85 },
  angry:    { rate: 1.15, pitch: 1.10, volume: 1.0 },
  stressed: { rate: 1.05, pitch: 1.05, volume: 0.9 },
  calm:     { rate: 0.90, pitch: 0.95, volume: 1.0 },
  neutral:  { rate: 1.00, pitch: 1.00, volume: 1.0 },
};

// Dil kodu → BCP47 (Web Speech API uyumlu)
const LANG_BCP47 = {
  tr: 'tr-TR', en: 'en-US', de: 'de-DE', fr: 'fr-FR',
  es: 'es-ES', it: 'it-IT', ja: 'ja-JP', ko: 'ko-KR',
  ar: 'ar-SA', zh: 'zh-CN', ru: 'ru-RU', pt: 'pt-PT',
};

// macOS'ta en kaliteli sesler bunlar — öncelik sırasıyla denenir
const PREFERRED_VOICE_NAMES = {
  tr: ['Yelda'],
  en: ['Samantha', 'Daniel', 'Moira', 'Karen', 'Reed', 'Eddy', 'Flo', 'Sandy', 'Shelley', 'Rocko', 'Rishi'],
  de: ['Anna', 'Markus', 'Petra', 'Yannick'],
  fr: ['Amélie', 'Thomas', 'Marie'],
  es: ['Monica', 'Jorge', 'Paulina'],
  it: ['Alice', 'Luca'],
  ja: ['Kyoko', 'Otoya'],
  ko: ['Yuna'],
  zh: ['Tingting', 'Meijia'],
  ru: ['Milena', 'Yuri'],
};

// Robotik / komedi sesler — hiçbir zaman seçilmemeli
const BLOCKED_VOICE_NAMES = new Set([
  'Albert', 'Bahh', 'Bells', 'Boing', 'Bubbles', 'Cellos', 'Jester',
  'Junior', 'Kathy', 'Org', 'Ralph', 'Superstar', 'Trinoids', 'Whisper',
  'Wobble', 'Zarvox', 'Fred', 'İyi Haber', 'Kötü Haber', 'Good News', 'Bad News',
]);

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v)));

let _cachedVoices = null;

function getVoicesSync() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  if (_cachedVoices && _cachedVoices.length) return _cachedVoices;
  const v = window.speechSynthesis.getVoices();
  if (v && v.length) _cachedVoices = v;
  return v || [];
}

// Bazı tarayıcılar voiceschanged event'i ile geç yüklüyor
if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.addEventListener?.('voiceschanged', () => {
    _cachedVoices = window.speechSynthesis.getVoices();
  });
}

function pickVoice(langCode) {
  const target = LANG_BCP47[langCode] || langCode || 'en-US';
  const voices = getVoicesSync().filter((v) => !BLOCKED_VOICE_NAMES.has(v.name));
  if (!voices.length) return null;

  // 1. Tercih listesindeki adlara göre ara (kalite sırası)
  const preferred = PREFERRED_VOICE_NAMES[langCode] || [];
  for (const name of preferred) {
    const match = voices.find((v) =>
      v.name.toLowerCase().includes(name.toLowerCase()) &&
      v.lang.toLowerCase().startsWith(target.split('-')[0].toLowerCase())
    );
    if (match) return match;
  }

  // 2. "Enhanced" veya "Premium" kalite etiketli ses varsa onu seç
  const enhanced = voices.find(
    (v) =>
      v.lang.toLowerCase().startsWith(target.split('-')[0].toLowerCase()) &&
      /(enhanced|premium|high quality)/i.test(v.name)
  );
  if (enhanced) return enhanced;

  // 3. Tam BCP47 eşleşmesi
  const exact = voices.find((v) => v.lang === target);
  if (exact) return exact;

  // 4. Dil kısa kodu ile eşleş
  const short = target.split('-')[0];
  return voices.find((v) => v.lang?.toLowerCase().startsWith(short.toLowerCase())) || null;
}

// Uzun metni cümlelere böler — Chrome 15 sn. kesme bug'ını önler
function splitSentences(text) {
  // Nokta/soru/ünlem sonrası böl, kısa parçaları birleştir
  const raw = text.match(/[^.!?]+[.!?]*/g) || [text];
  const chunks = [];
  let current = '';
  for (const s of raw) {
    if ((current + s).length > 180) {
      if (current) chunks.push(current.trim());
      current = s;
    } else {
      current += s;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length ? chunks : [text];
}

/**
 * Duygulu sesli okuma.
 * - Kaliteli ses seçimi (Enhanced/Premium öncelikli)
 * - Uzun metni cümlelere bölerek Chrome 15-sn bug'ını önler
 * - cancel() sonrası kısa gecikme ile yarış durumunu önler
 *
 * @param {string} text
 * @param {string} langCode - 'tr', 'en', vb.
 * @param {string} emotion  - 'happy' | 'sad' | 'angry' | 'stressed' | 'calm' | 'neutral'
 * @param {{rate?:number, pitch?:number, volume?:number}} [hints] - LLM tts_hints
 * @returns {{cancel: () => void, params: object}}
 */
export function speakWithEmotion(text, langCode, emotion = 'neutral', hints = null) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text?.trim()) {
    return { cancel: () => {}, params: {} };
  }

  const defaults = EMOTION_DEFAULTS[emotion] || EMOTION_DEFAULTS.neutral;
  const params = {
    rate:   clamp(hints?.rate   ?? defaults.rate,   0.75, 1.3),
    pitch:  clamp(hints?.pitch  ?? defaults.pitch,  0.8,  1.2),
    volume: clamp(hints?.volume ?? defaults.volume, 0.8,  1.0),
  };

  const bcp47 = LANG_BCP47[langCode] || langCode || 'en-US';
  const voice = pickVoice(langCode);
  const sentences = splitSentences(text.trim());

  let cancelled = false;
  let currentIdx = 0;

  window.speechSynthesis.cancel();

  // cancel() bazen async — 80ms bekle sonra başla
  const timer = setTimeout(() => {
    if (cancelled) return;
    speakNext();
  }, 80);

  function speakNext() {
    if (cancelled || currentIdx >= sentences.length) return;

    const chunk = sentences[currentIdx++];
    const u = new SpeechSynthesisUtterance(chunk);
    u.lang = bcp47;
    u.rate = params.rate;
    u.pitch = params.pitch;
    u.volume = params.volume;
    if (voice) u.voice = voice;

    u.onend = () => {
      if (!cancelled) speakNext();
    };
    u.onerror = (e) => {
      // "interrupted" hataları beklenen — sessizce geç
      if (e.error !== 'interrupted' && !cancelled) speakNext();
    };

    window.speechSynthesis.speak(u);
  }

  return {
    cancel: () => {
      cancelled = true;
      clearTimeout(timer);
      window.speechSynthesis.cancel();
    },
    params,
    voice: voice?.name || 'sistem varsayılanı',
  };
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

export { EMOTION_DEFAULTS, LANG_BCP47 };
