/**
 * LinguBridge AI — API Client
 * Backend FastAPI ile iletişim.
 */

const API_BASE = 'http://localhost:8000/api';

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
