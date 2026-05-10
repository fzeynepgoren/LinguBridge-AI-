/**
 * LinguBridge AI — EmotionDisplay Component
 * Tespit edilen duygu durumunu emoji, etiket ve güven yüzdesi ile gösterir.
 * Duygu değişimlerinde animasyon uygular.
 */

import { EMOTIONS } from '../utils/emotionClassifier';

const EMOTION_OPTIONS = ['happy', 'neutral', 'calm', 'stressed', 'sad', 'angry'];

export default function EmotionDisplay({
  emotion = 'neutral',
  detectedEmotion = 'neutral',
  emotionOverride = 'auto',
  onEmotionOverrideChange,
  confidence = 0,
  details = {},
  isUncertain = false,
}) {
  const emotionData = EMOTIONS[emotion] || EMOTIONS.neutral;

  return (
    <div className="emotion-display">
      <div className="emotion-header">
        <h3>🧠 Duygu Analizi</h3>
        <div className="emotion-badge" style={{ backgroundColor: emotionData.color + '20', borderColor: emotionData.color }}>
          <span className="emotion-emoji">{emotionData.emoji}</span>
          <span className="emotion-label">{emotionData.label}</span>
        </div>
      </div>

      <div className="emotion-confidence">
        {emotionOverride === 'auto' ? (
          isUncertain ? (
            <div className="confidence-uncertain" role="status">
              <span className="uncertain-badge">🤔 Belirsiz</span>
              <span className="uncertain-hint">
                Düşük güven (%{confidence}). Aşağıdan elle bir duygu seçebilirsin.
              </span>
            </div>
          ) : (
            <>
              <div className="confidence-bar-container">
                <div
                  className="confidence-bar"
                  style={{
                    width: `${confidence}%`,
                    backgroundColor: emotionData.color,
                    boxShadow: `0 0 12px ${emotionData.color}60`,
                  }}
                />
              </div>
              <span className="confidence-text">%{confidence} güven</span>
            </>
          )
        ) : (
          <span className="confidence-text" style={{ color: emotionData.color }}>
            ✋ Manuel seçim aktif — LLM bu duyguyu kullanacak
          </span>
        )}
      </div>

      <div className="emotion-details">
        <div className="detail-item">
          <span className="detail-icon">🎵</span>
          <span className="detail-label">Pitch</span>
          <span className="detail-value">{details.pitch || 0} Hz</span>
        </div>
        <div className="detail-item">
          <span className="detail-icon">⚡</span>
          <span className="detail-label">Enerji</span>
          <span className="detail-value">%{details.energy || 0}</span>
        </div>
        <div className="detail-item">
          <span className="detail-icon">🏃</span>
          <span className="detail-label">Tempo</span>
          <span className="detail-value">{details.normalizedTempo || 0}%</span>
        </div>
      </div>

      <p className="emotion-description">{emotionData.description}</p>

      <div className="emotion-override" aria-label="Duygu tonu seçimi">
        <button
          type="button"
          className={`emotion-option ${emotionOverride === 'auto' ? 'active' : ''}`}
          onClick={() => onEmotionOverrideChange?.('auto')}
          title={`Otomatik algı: ${EMOTIONS[detectedEmotion]?.label || 'Nötr'}`}
        >
          Otomatik
        </button>
        {EMOTION_OPTIONS.map((key) => {
          const item = EMOTIONS[key];
          return (
            <button
              type="button"
              key={key}
              className={`emotion-option ${emotionOverride === key ? 'active' : ''}`}
              onClick={() => onEmotionOverrideChange?.(key)}
              title={item.label}
              aria-label={`Duyguyu ${item.label} olarak ayarla`}
            >
              <span aria-hidden="true">{item.emoji}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
