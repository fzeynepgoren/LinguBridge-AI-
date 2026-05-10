/**
 * LinguBridge AI — IncomingMessageAnalyzer
 *
 * Karşıdan gelen mesajı analiz eder; tonunu ve kültürel ipuçlarını gösterir,
 * kullanıcının dilinde 3 cevap önerisi sunar. Önerilerden birine tıklamak
 * üst paneldeki kaynak metin alanına yapıştırır.
 */

import { useState } from 'react';
import { analyzeIncomingMessage } from '../utils/api';

const TONE_STYLES = {
  warm:       { color: '#00B894', emoji: '🤗', glow: 'rgba(0,184,148,0.25)' },
  formal:     { color: '#6C5CE7', emoji: '🎩', glow: 'rgba(108,92,231,0.25)' },
  neutral:    { color: '#B2BEC3', emoji: '😐', glow: 'rgba(178,190,195,0.25)' },
  cold:       { color: '#74B9FF', emoji: '🧊', glow: 'rgba(116,185,255,0.25)' },
  aggressive: { color: '#FF6B6B', emoji: '💥', glow: 'rgba(255,107,107,0.25)' },
  uncertain:  { color: '#FDCB6E', emoji: '🤔', glow: 'rgba(253,203,110,0.25)' },
};

export default function IncomingMessageAnalyzer({
  messageLang = 'en',
  replyLang = 'tr',
  onUseReply,
}) {
  const [incomingText, setIncomingText] = useState('');
  const [result, setResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [collapsed, setCollapsed] = useState(true);

  const handleAnalyze = async () => {
    if (!incomingText.trim() || isAnalyzing) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const payload = await analyzeIncomingMessage({
        text: incomingText,
        messageLang,
        replyLang,
      });
      setResult(payload);
    } catch (err) {
      console.error('Gelen mesaj analizi hatası:', err);
      setError('Analiz sırasında bir hata oluştu. Backend çalışıyor mu?');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleClear = () => {
    setIncomingText('');
    setResult(null);
    setError(null);
  };

  const toneKey = result?.tone || 'neutral';
  const toneStyle = TONE_STYLES[toneKey] || TONE_STYLES.neutral;

  return (
    <section className="incoming-analyzer panel" aria-label="Gelen mesaj analizi">
      <button
        type="button"
        className="incoming-toggle"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
      >
        <span className="incoming-icon" aria-hidden="true">📨</span>
        <span className="incoming-title">Karşıdan Gelen Mesajı Anla</span>
        <span className="incoming-hint">
          {collapsed ? 'Aç' : 'Kapat'} — karşı tarafın mesajını yapıştır, anlamını ve uygun cevabı gör
        </span>
        <span className="incoming-caret" aria-hidden="true">{collapsed ? '▸' : '▾'}</span>
      </button>

      {!collapsed && (
        <div className="incoming-body">
          <div className="incoming-input-row">
            <textarea
              className="incoming-textarea"
              placeholder={`Karşı tarafın ${messageLang.toUpperCase()} dilinde yazdığı mesajı buraya yapıştır...`}
              value={incomingText}
              onChange={(e) => setIncomingText(e.target.value)}
              rows={3}
            />
            <div className="incoming-actions">
              <button
                type="button"
                className="incoming-btn-primary"
                onClick={handleAnalyze}
                disabled={!incomingText.trim() || isAnalyzing}
              >
                {isAnalyzing ? '⏳ Analiz ediliyor...' : '🔍 Analiz Et'}
              </button>
              {(result || incomingText) && (
                <button
                  type="button"
                  className="incoming-btn-secondary"
                  onClick={handleClear}
                  disabled={isAnalyzing}
                >
                  Temizle
                </button>
              )}
            </div>
          </div>

          {error && <p className="incoming-error" role="alert">{error}</p>}

          {result && !error && (
            <div className="incoming-result">
              <div className="incoming-meta">
                <span
                  className="incoming-tone-badge"
                  style={{
                    color: toneStyle.color,
                    borderColor: toneStyle.color,
                    boxShadow: `0 0 14px ${toneStyle.glow}`,
                  }}
                  title={`Mesajın tonu: ${result.tone_label || result.tone}`}
                >
                  <span aria-hidden="true">{toneStyle.emoji}</span>
                  <span>{result.tone_label || result.tone}</span>
                </span>
                {result.mode === 'fallback' && (
                  <span className="incoming-mode-badge" title="LLM kullanılamadı, kural tabanlı analiz">
                    ⚡ Fallback
                  </span>
                )}
              </div>

              {result.translated_meaning && (
                <p className="incoming-meaning">
                  <strong>Anlamı:</strong> {result.translated_meaning}
                </p>
              )}

              {result.cultural_notes?.length > 0 && (
                <ul className="incoming-notes">
                  {result.cultural_notes.map((note, i) => (
                    <li key={i}>💡 {note}</li>
                  ))}
                </ul>
              )}

              {result.reply_suggestions?.length > 0 && (
                <div className="incoming-replies">
                  <h4>Olası cevapların ({replyLang.toUpperCase()}):</h4>
                  <div className="incoming-reply-grid">
                    {result.reply_suggestions.map((reply, i) => (
                      <button
                        key={i}
                        type="button"
                        className={`incoming-reply-card incoming-reply-${reply.type}`}
                        onClick={() => onUseReply?.(reply.text)}
                        title="Bu cevabı giriş kutusuna yapıştır"
                      >
                        <span className="incoming-reply-icon" aria-hidden="true">
                          {reply.icon}
                        </span>
                        <div className="incoming-reply-content">
                          <span className="incoming-reply-label">{reply.label}</span>
                          <p className="incoming-reply-text">{reply.text}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
