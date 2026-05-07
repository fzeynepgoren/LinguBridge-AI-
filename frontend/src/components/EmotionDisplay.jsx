/**
 * LinguBridge AI — EmotionDisplay Component
 * Tespit edilen duygu durumunu emoji, etiket ve güven yüzdesi ile gösterir.
 * Duygu değişimlerinde animasyon uygular.
 */

import { useState, useEffect } from 'react';
import { EMOTIONS } from '../utils/emotionClassifier';

export default function EmotionDisplay({ emotion = 'neutral', confidence = 0, details = {} }) {
  const [displayedEmotion, setDisplayedEmotion] = useState(emotion);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const emotionData = EMOTIONS[displayedEmotion] || EMOTIONS.neutral;

  useEffect(() => {
    if (emotion !== displayedEmotion) {
      setIsTransitioning(true);
      const timer = setTimeout(() => {
        setDisplayedEmotion(emotion);
        setIsTransitioning(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [emotion, displayedEmotion]);

  return (
    <div className={`emotion-display ${isTransitioning ? 'transitioning' : ''}`}>
      <div className="emotion-header">
        <h3>🧠 Duygu Analizi</h3>
        <div className="emotion-badge" style={{ backgroundColor: emotionData.color + '20', borderColor: emotionData.color }}>
          <span className="emotion-emoji">{emotionData.emoji}</span>
          <span className="emotion-label">{emotionData.label}</span>
        </div>
      </div>

      <div className="emotion-confidence">
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
    </div>
  );
}
