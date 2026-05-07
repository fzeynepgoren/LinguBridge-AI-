/**
 * LinguBridge AI — TranslationPanel Component
 * Çeviri giriş/çıkış paneli. Kaynak ve hedef dil seçimi,
 * metin girişi ve çeviri sonucunu gösterir.
 */

import { useState } from 'react';

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
}) {
  const [showChanges, setShowChanges] = useState(false);

  const handleSwapLanguages = () => {
    onSourceLangChange(targetLang);
    onTargetLangChange(sourceLang);
  };

  const handleSpeak = (text, lang) => {
    if ('speechSynthesis' in window && text) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang === 'tr' ? 'tr-TR' : lang === 'en' ? 'en-US' : lang;
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
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
              onClick={() => handleSpeak(sourceText, sourceLang)}
              title="Sesli oku"
              disabled={!sourceText}
            >
              🔊
            </button>
            <span className="char-count">{sourceText.length} karakter</span>
          </div>
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
          <div className="translation-output">
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
              onClick={() => handleSpeak(adaptedText || translatedText, targetLang)}
              title="Sesli oku"
              disabled={!adaptedText && !translatedText}
            >
              🔊
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
        </div>
      </div>

      {/* Çevir Butonu */}
      <button
        className="translate-btn"
        onClick={onTranslate}
        disabled={!sourceText.trim() || isTranslating}
        id="translate-btn"
      >
        {isTranslating ? '⏳ Çevriliyor...' : '🚀 Çevir & Adapte Et'}
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
