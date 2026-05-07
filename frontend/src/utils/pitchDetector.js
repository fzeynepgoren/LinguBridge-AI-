/**
 * LinguBridge AI — Pitch Detector
 * Autocorrelation yöntemi ile gerçek zamanlı pitch (temel frekans) tespiti.
 * Web Audio API kullanır — tamamen tarayıcı-native, ücretsiz.
 */

/**
 * Autocorrelation ile pitch algılama.
 * @param {Float32Array} buffer - Ses verisi buffer'ı
 * @param {number} sampleRate - Örnekleme hızı (genellikle 44100 veya 48000)
 * @returns {number} - Tespit edilen frekans (Hz), tespit edilemezse -1
 */
export function detectPitch(buffer, sampleRate) {
  const SIZE = buffer.length;
  const MAX_SAMPLES = Math.floor(SIZE / 2);

  let bestOffset = -1;
  let bestCorrelation = 0;
  let foundGoodCorrelation = false;

  // RMS (Root Mean Square) hesapla — ses seviyesi kontrolü
  let rms = 0;
  for (let i = 0; i < SIZE; i++) {
    rms += buffer[i] * buffer[i];
  }
  rms = Math.sqrt(rms / SIZE);

  // Ses çok düşükse pitch tespiti yapma
  if (rms < 0.01) return -1;

  let lastCorrelation = 1;

  for (let offset = 0; offset < MAX_SAMPLES; offset++) {
    let correlation = 0;

    for (let i = 0; i < MAX_SAMPLES; i++) {
      correlation += Math.abs(buffer[i] - buffer[i + offset]);
    }

    correlation = 1 - correlation / MAX_SAMPLES;

    if (correlation > 0.9 && correlation > lastCorrelation) {
      foundGoodCorrelation = true;
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestOffset = offset;
      }
    } else if (foundGoodCorrelation) {
      break;
    }

    lastCorrelation = correlation;
  }

  if (bestCorrelation > 0.01 && bestOffset > 0) {
    return sampleRate / bestOffset;
  }

  return -1;
}

/**
 * Ses enerjisini hesaplar (RMS).
 * @param {Float32Array} buffer - Ses verisi
 * @returns {number} - Enerji seviyesi (0-1 arası)
 */
export function calculateEnergy(buffer) {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i] * buffer[i];
  }
  return Math.sqrt(sum / buffer.length);
}

/**
 * Konuşma hızını (tempo) tahmin eder.
 * Enerji değişimlerinden konuşma tempını hesaplar.
 * @param {Float32Array} buffer - Ses verisi
 * @param {number} sampleRate - Örnekleme hızı
 * @returns {number} - Tahmini hece/saniye oranı
 */
export function estimateTempo(buffer, sampleRate) {
  const frameSize = Math.floor(sampleRate * 0.02); // 20ms frame
  const frames = Math.floor(buffer.length / frameSize);

  if (frames < 2) return 0;

  const energies = [];
  for (let i = 0; i < frames; i++) {
    let energy = 0;
    for (let j = 0; j < frameSize; j++) {
      const idx = i * frameSize + j;
      if (idx < buffer.length) {
        energy += buffer[idx] * buffer[idx];
      }
    }
    energies.push(Math.sqrt(energy / frameSize));
  }

  // Enerji zirvelerini say (konuşma vuruşları)
  let peaks = 0;
  const threshold = Math.max(...energies) * 0.3;

  for (let i = 1; i < energies.length - 1; i++) {
    if (
      energies[i] > threshold &&
      energies[i] > energies[i - 1] &&
      energies[i] > energies[i + 1]
    ) {
      peaks++;
    }
  }

  // Hece/saniye olarak tempo
  const durationSeconds = buffer.length / sampleRate;
  return durationSeconds > 0 ? peaks / durationSeconds : 0;
}
