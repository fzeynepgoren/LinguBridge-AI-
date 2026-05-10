/**
 * LinguBridge AI — TranslationPanel Component
 * Çeviri giriş/çıkış paneli. Kaynak ve hedef dil seçimi,
 * metin girişi ve çeviri sonucunu gösterir.
 */

import { useState } from 'react';
import { speakWithEmotion } from '../utils/ttsEngine';

const LANGUAGES = {
  tr: { name: 'Türkçe', flag: '🇹🇷' },
  en: { name: 'English', flag: '🇬🇧' },
  de: { name: 'Deutsch', flag: '🇩🇪' },
  fr: { name: 'Français', flag: '🇫🇷' },
  es: { name: 'Español', flag: '🇪🇸' },
  ja: { name: '日本語', flag: '🇯🇵' },
  ko: { name: '한국어', flag: '🇰🇷' },
  ar: { name: 'العربية', flag: '🇸🇦' },
  zh: { name: '中文', flag: '🇨🇳' },
  ru: { name: 'Русский', flag: '🇷🇺' },
  it: { name: 'Italiano', flag: '🇮🇹' },
  pt: { name: 'Português', flag: '🇵🇹' },
};

export default function TranslationPanel({
  sourceText = '',
  onSourceTextChange,
  translatedText = '',
  adaptedText = '',
  sourceLang = 'en',
  targetLang = 'tr',
  onSourceLangChange,
  onTargetLangChange,
  onTranslate,
  isTranslating = false,
  changesMade = [],
  politenessLabel = '',
  emotion = 'neutral',
  ttsHints = null,
  translateSuccess = false,
}) {
  const [showChanges, setShowChanges] = useState(false);
  const MAX_CHARS = 500;
  const charCount = sourceText.length;
  const sameLang = sourceLang === targetLang;
  const charClass = charCount > MAX_CHARS
    ? 'char-count over-limit'
    : charCount > MAX_CHARS * 0.85
    ? 'char-count near-limit'
    : 'char-count';

  const handleSwapLanguages = () => {
    onSourceLangChange(targetLang);
    onTargetLangChange(sourceLang);
  };

  // Kaynak metni okurken duygu ham ses analizinden geliyor.
  // Hedef metni okurken duyguyu nötrleştirip LLM tts_hints'i kullanıyoruz.
  const handleSpeakSource = (text, lang) => {
    if (!text) return;
    const result = speakWithEmotion(text, lang, emotion, null);
    console.debug('[TTS] kaynak →', lang, '| ses:', result.voice, '| params:', result.params);
  };
  const handleSpeakTarget = (text, lang) => {
    if (!text) return;
    const result = speakWithEmotion(text, lang, emotion, ttsHints);
    console.debug('[TTS] hedef →', lang, '| ses:', result.voice, '| params:', result.params);
  };

  return (
    <div className="translation-panel">
      <div className="translation-header">
        <h3>🌍 Çeviri</h3>
      </div>

      <div className="translation-body">
        {/* Kaynak Dil */}
        <div className="translation-side source-side">
          <div className="lang-selector">
            <select
              value={sourceLang}
              onChange={(e) => onSourceLangChange(e.target.value)}
              className="lang-select"
              id="source-lang-select"
            >
              {Object.entries(LANGUAGES).map(([code, { name, flag }]) => (
                <option key={code} value={code}>
                  {flag} {name}
                </option>
              ))}
            </select>
          </div>
          <textarea
            className="translation-textarea"
            placeholder="Metin girin veya mikrofonu kullanın..."
            value={sourceText}
            onChange={(e) => onSourceTextChange(e.target.value)}
            rows={5}
            id="source-text-input"
          />
          <div className="translation-actions">
            <button
              className="btn-icon"
              onClick={() => handleSpeakSource(sourceText, sourceLang)}
              title="Sesli oku (duygulu)"
              aria-label="Kaynak metni duygulu sesli oku"
              disabled={!sourceText}
            >
              🔊
            </button>
            <span className={charClass} aria-live="polite">
              {charCount} / {MAX_CHARS}
            </span>
          </div>
          {sameLang && (
            <p className="inline-warning" role="alert">
              ⚠️ Kaynak ve hedef dil aynı — farklı bir dil seçin.
            </p>
          )}
        </div>

        {/* Swap Butonu */}
        <div className="translation-swap">
          <button className="swap-btn" onClick={handleSwapLanguages} title="Dilleri değiştir">
            ⇄
          </button>
        </div>

        {/* Hedef Dil */}
        <div className="translation-side target-side">
          <div className="lang-selector">
            <select
              value={targetLang}
              onChange={(e) => onTargetLangChange(e.target.value)}
              className="lang-select"
              id="target-lang-select"
            >
              {Object.entries(LANGUAGES).map(([code, { name, flag }]) => (
                <option key={code} value={code}>
                  {flag} {name}
                </option>
              ))}
            </select>
          </div>
          <div className="translation-output" aria-live="polite" aria-busy={isTranslating}>
            {isTranslating ? (
              <div className="translation-loading">
                <div className="loading-dots">
                  <span></span><span></span><span></span>
                </div>
                <p>Çevriliyor...</p>
              </div>
            ) : adaptedText ? (
              <>
                <p className="adapted-text">{adaptedText}</p>
                {translatedText && translatedText !== adaptedText && (
                  <p className="original-translation">
                    <small>Orijinal çeviri: {translatedText}</small>
                  </p>
                )}
              </>
            ) : (
              <p className="placeholder-text">Çeviri burada görünecek...</p>
            )}
          </div>
          <div className="translation-actions">
            <button
              className="btn-icon"
              onClick={() => handleSpeakTarget(adaptedText || translatedText, targetLang)}
              title="Duygulu sesli oku"
              aria-label="Çeviriyi duygulu sesli oku"
              disabled={!adaptedText && !translatedText}
            >
              🎭
            </button>
            {changesMade.length > 0 && (
              <button
                className="btn-changes"
                onClick={() => setShowChanges(!showChanges)}
              >
                📝 {changesMade.length} değişiklik
              </button>
            )}
          </div>
          {(adaptedText || translatedText) && (
            <div className="tts-preview" role="group" aria-label="Aynı cümleyi farklı duygu tonlarında dinle">
              <span className="tts-preview-label">Tonu deneyin:</span>
              <button
                type="button"
                className="tts-preview-btn"
                onClick={() => speakWithEmotion(adaptedText || translatedText, targetLang, 'happy', { rate: 1.08, pitch: 1.18, volume: 1.0 })}
                title="Sıcak / mutlu tonda oku"
              >
                😊 Sıcak
              </button>
              <button
                type="button"
                className="tts-preview-btn"
                onClick={() => speakWithEmotion(adaptedText || translatedText, targetLang, 'neutral', { rate: 1.0, pitch: 1.0, volume: 1.0 })}
                title="Nötr tonda oku"
              >
                😐 Nötr
              </button>
              <button
                type="button"
                className="tts-preview-btn"
                onClick={() => speakWithEmotion(adaptedText || translatedText, targetLang, 'sad', { rate: 0.88, pitch: 0.88, volume: 0.9 })}
                title="Yumuşak / üzgün tonda oku"
              >
                😔 Yumuşak
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Çevir Butonu — disabled değil; boş olunca App.jsx toast gösterir */}
      <button
        className={`translate-btn${isTranslating ? ' loading' : ''}${translateSuccess ? ' success' : ''}`}
        onClick={onTranslate}
        id="translate-btn"
        aria-busy={isTranslating}
      >
        {isTranslating
          ? '⏳ Çevriliyor...'
          : translateSuccess
          ? '✓ Çevrildi'
          : '🚀 Çevir & Adapte Et'}
      </button>

      {/* Nezaket değişiklikleri */}
      {showChanges && changesMade.length > 0 && (
        <div className="changes-panel">
          <h4>📝 Nezaket Adaptasyonu Değişiklikleri</h4>
          <ul>
            {changesMade.map((change, i) => (
              <li key={i}>{change}</li>
            ))}
          </ul>
          {politenessLabel && (
            <p className="politeness-note">Nezaket seviyesi: <strong>{politenessLabel}</strong></p>
          )}
        </div>
      )}
    </div>
  );
}
