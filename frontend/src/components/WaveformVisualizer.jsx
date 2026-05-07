/**
 * LinguBridge AI — WaveformVisualizer Component
 * Canvas tabanlı gerçek zamanlı ses dalga formu görselleştirmesi.
 * Duygu durumuna göre renk değiştirir.
 */

import { useRef, useEffect } from 'react';
import { EMOTIONS } from '../utils/emotionClassifier';

export default function WaveformVisualizer({ waveform, emotion = 'neutral', isActive = false }) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    // Canvas boyutunu ayarla
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const color = EMOTIONS[emotion]?.color || '#B2BEC3';

    // Temizle
    ctx.clearRect(0, 0, width, height);

    if (!isActive || !waveform || waveform.length === 0) {
      // Boşta animasyonu — hafif dalga
      drawIdleWave(ctx, width, height, color);
      return;
    }

    // Dalga formu çiz
    const sliceWidth = width / waveform.length;
    const centerY = height / 2;

    // Gradient arka plan
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, color + '00');
    gradient.addColorStop(0.2, color + '40');
    gradient.addColorStop(0.5, color + '80');
    gradient.addColorStop(0.8, color + '40');
    gradient.addColorStop(1, color + '00');

    // Dolgulu dalga
    ctx.beginPath();
    ctx.moveTo(0, centerY);

    for (let i = 0; i < waveform.length; i++) {
      const x = i * sliceWidth;
      const y = centerY + waveform[i] * centerY * 2;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        // Smooth curve
        const prevX = (i - 1) * sliceWidth;
        const prevY = centerY + waveform[i - 1] * centerY * 2;
        const cpX = (prevX + x) / 2;
        ctx.quadraticCurveTo(prevX, prevY, cpX, (prevY + y) / 2);
      }
    }

    // Alt kısmı kapat
    ctx.lineTo(width, centerY);
    ctx.lineTo(0, centerY);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Çizgi dalga (üst)
    ctx.beginPath();
    for (let i = 0; i < waveform.length; i++) {
      const x = i * sliceWidth;
      const y = centerY + waveform[i] * centerY * 2;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        const prevX = (i - 1) * sliceWidth;
        const prevY = centerY + waveform[i - 1] * centerY * 2;
        const cpX = (prevX + x) / 2;
        ctx.quadraticCurveTo(prevX, prevY, cpX, (prevY + y) / 2);
      }
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Orta çizgi
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.strokeStyle = color + '30';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }, [waveform, emotion, isActive]);

  return (
    <div className="waveform-container">
      <canvas
        ref={canvasRef}
        className="waveform-canvas"
        style={{ width: '100%', height: '80px' }}
      />
      {!isActive && (
        <div className="waveform-idle-text">
          Ses analizi için kayıt başlatın
        </div>
      )}
    </div>
  );
}

/**
 * Boşta durumda yumuşak dalga animasyonu çizer.
 */
function drawIdleWave(ctx, width, height, color) {
  const centerY = height / 2;
  const time = Date.now() / 1000;

  ctx.beginPath();
  for (let x = 0; x < width; x++) {
    const y =
      centerY +
      Math.sin(x * 0.02 + time * 2) * 5 +
      Math.sin(x * 0.01 + time * 1.5) * 3;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = color + '40';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}
