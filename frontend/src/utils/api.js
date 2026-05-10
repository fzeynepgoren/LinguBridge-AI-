/**
 * LinguBridge AI — API Client
 * Backend FastAPI ile iletişim.
 */

const API_BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000') + '/api';

/**
 * Backend API'ye istek gönderir.
 */
async function apiRequest(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, options);
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`API request failed: ${endpoint}`, error);
    throw error;
  }
}

/**
 * Tek istekte: çeviri + nezaket + öneri + TTS hint.
 * Backend LLM birincil, fallback otomatik.
 *
 * @param {{
 *   text: string,
 *   sourceLang: string,
 *   targetLang: string,
 *   politenessLevel: number,
 *   emotion: string,
 *   conversationHistory?: Array<{role: string, text: string, emotion?: string}>
 * }} payload
 */
export async function processMessage({
  text,
  sourceLang,
  targetLang,
  politenessLevel,
  emotion,
  conversationHistory = [],
}) {
  return apiRequest('/process', 'POST', {
    text,
    source_lang: sourceLang,
    target_lang: targetLang,
    politeness_level: politenessLevel,
    emotion,
    conversation_history: conversationHistory,
  });
}

/**
 * Metni çevirir ve nezaket adaptasyonu uygular.
 */
export async function translateText(text, sourceLang, targetLang, politenessLevel, emotion) {
  return apiRequest('/translate', 'POST', {
    text,
    source_lang: sourceLang,
    target_lang: targetLang,
    politeness_level: politenessLevel,
    emotion,
  });
}

/**
 * Bağlamsal yanıt önerileri üretir.
 */
export async function getSuggestions(text, language, emotion, politenessLevel, conversationHistory) {
  return apiRequest('/suggestions', 'POST', {
    text,
    language,
    emotion,
    politeness_level: politenessLevel,
    conversation_history: conversationHistory,
  });
}

/**
 * Nezaket dönüşümü (çeviri olmadan).
 */
export async function adaptPoliteness(text, politenessLevel, language, emotion) {
  return apiRequest('/politeness', 'POST', {
    text,
    politeness_level: politenessLevel,
    language,
    emotion,
  });
}

/**
 * Desteklenen dilleri getirir.
 */
export async function getLanguages() {
  return apiRequest('/languages');
}

/**
 * Sağlık kontrolü.
 */
export async function healthCheck() {
  return apiRequest('/health');
}

/**
 * Karşıdan gelen mesajı analiz eder: ton, kültürel notlar ve 3 yanıt önerisi.
 * @param {{ text: string, messageLang: string, replyLang: string }} payload
 */
export async function analyzeIncomingMessage({ text, messageLang, replyLang }) {
  return apiRequest('/analyze-incoming', 'POST', {
    text,
    message_lang: messageLang,
    reply_lang: replyLang,
  });
}
