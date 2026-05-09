/**
 * LinguBridge AI — Emotion Classifier
 * Pitch, tempo ve enerji parametrelerinden kural tabanlı duygu sınıflandırması.
 * Akademik araştırmalara dayalı eşik değerleri kullanır.
 */

// Duygu tanımları
export const EMOTIONS = {
  happy: {
    label: 'Mutlu',
    labelEn: 'Happy',
    emoji: '😊',
    color: '#FFD93D',
    bgGradient: 'linear-gradient(135deg, #FFD93D22, #FF8C0022)',
    description: 'Konuşmacı mutlu ve enerjik görünüyor',
  },
  sad: {
    label: 'Üzgün',
    labelEn: 'Sad',
    emoji: '😢',
    color: '#74B9FF',
    bgGradient: 'linear-gradient(135deg, #74B9FF22, #A29BFE22)',
    description: 'Konuşmacı üzgün veya melankolik görünüyor',
  },
  angry: {
    label: 'Kızgın',
    labelEn: 'Angry',
    emoji: '😠',
    color: '#FF6B6B',
    bgGradient: 'linear-gradient(135deg, #FF6B6B22, #EE5A2422)',
    description: 'Konuşmacı sinirli veya kızgın görünüyor',
  },
  stressed: {
    label: 'Stresli',
    labelEn: 'Stressed',
    emoji: '😰',
    color: '#FDCB6E',
    bgGradient: 'linear-gradient(135deg, #FDCB6E22, #E1780622)',
    description: 'Konuşmacı stresli veya endişeli görünüyor',
  },
  calm: {
    label: 'Sakin',
    labelEn: 'Calm',
    emoji: '😌',
    color: '#00B894',
    bgGradient: 'linear-gradient(135deg, #00B89422, #00CEC922)',
    description: 'Konuşmacı sakin ve huzurlu görünüyor',
  },
  neutral: {
    label: 'Nötr',
    labelEn: 'Neutral',
    emoji: '😐',
    color: '#B2BEC3',
    bgGradient: 'linear-gradient(135deg, #B2BEC322, #DFE6E922)',
    description: 'Belirgin bir duygu tespit edilemedi',
  },
};

/**
 * Kural tabanlı duygu sınıflandırması.
 *
 * Referans değerler (konuşma sesi için):
 * - Pitch: Erkek ~85-180Hz, Kadın ~165-255Hz. Ortalama ~150Hz.
 * - Tempo: Normal konuşma ~3-5 hece/sn
 * - Enerji: 0-1 arası normalize edilmiş RMS
 *
 * @param {number} pitch - Temel frekans (Hz)
 * @param {number} tempo - Konuşma hızı (hece/sn)
 * @param {number} energy - Enerji seviyesi (0-1)
 * @returns {{ emotion: string, confidence: number, details: object }}
 */
export function classifyEmotion(pitch, tempo, energy, dynamics = {}) {
  // Pitch, tempo ve enerjiyi normalize et (0-1 arası)
  const normalizedPitch = Math.min(Math.max((pitch - 80) / (300 - 80), 0), 1);
  const normalizedTempo = Math.min(Math.max(tempo / 8, 0), 1);
  // Mikrofon seviyesi genelde düşük — 0.05 RMS = %100 sayılır (eskiden 0.1 idi)
  const normalizedEnergy = Math.min(Math.max(energy / 0.05, 0), 1);

  // Her duygu için skor hesapla
  const scores = {
    happy: calculateEmotionScore(normalizedPitch, normalizedTempo, normalizedEnergy, {
      pitchTarget: 0.65,
      tempoTarget: 0.6,
      energyTarget: 0.5,
    }),
    sad: calculateEmotionScore(normalizedPitch, normalizedTempo, normalizedEnergy, {
      pitchTarget: 0.2,
      tempoTarget: 0.2,
      energyTarget: 0.2,
    }),
    angry: calculateEmotionScore(normalizedPitch, normalizedTempo, normalizedEnergy, {
      pitchTarget: 0.8,
      tempoTarget: 0.8,
      energyTarget: 0.85,
    }),
    stressed: calculateEmotionScore(normalizedPitch, normalizedTempo, normalizedEnergy, {
      pitchTarget: 0.7,
      tempoTarget: 0.75,
      energyTarget: 0.4,
    }),
    calm: calculateEmotionScore(normalizedPitch, normalizedTempo, normalizedEnergy, {
      pitchTarget: 0.35,
      tempoTarget: 0.35,
      energyTarget: 0.3,
    }),
    neutral: calculateEmotionScore(normalizedPitch, normalizedTempo, normalizedEnergy, {
      pitchTarget: 0.5,
      tempoTarget: 0.5,
      energyTarget: 0.4,
    }),
  };

  const pitchRange = dynamics.pitchRange || 0;
  const isExpressive = pitchRange >= 35 || (normalizedPitch >= 0.5 && normalizedEnergy >= 0.35);
  const hasFastTempo = normalizedTempo >= 0.45;

  if (isExpressive) {
    scores.happy *= 1.28;
  }

  if (!hasFastTempo) {
    scores.stressed *= 0.72;
    scores.angry *= 0.78;
  }

  if (normalizedEnergy >= 0.45 && normalizedPitch >= 0.45) {
    scores.happy *= 1.18;
    scores.neutral *= 0.85;
  }

  // Nötr bias düşük tutulur; aksi halde kısa ve neşeli konuşmalar nötre düşer.
  scores.neutral *= 0.95;

  // En yüksek skorlu duyguyu bul
  let bestEmotion = 'neutral';
  let bestScore = 0;

  for (const [emotion, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestEmotion = emotion;
    }
  }

  // Güven yüzdesi hesapla
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const confidence = totalScore > 0 ? Math.round((bestScore / totalScore) * 100) : 0;

  return {
    emotion: bestEmotion,
    confidence: Math.min(confidence, 95), // Max %95 güven
    scores,
    details: {
      pitch: Math.round(pitch),
      tempo: Math.round(tempo * 10) / 10,
      energy: Math.round(normalizedEnergy * 100),
      normalizedPitch: Math.round(normalizedPitch * 100),
      normalizedTempo: Math.round(normalizedTempo * 100),
      pitchRange: Math.round(pitchRange),
    },
  };
}

/**
 * Gaussian mesafe tabanlı duygu skoru hesaplama.
 */
function calculateEmotionScore(pitch, tempo, energy, targets) {
  const pitchDist = Math.abs(pitch - targets.pitchTarget);
  const tempoDist = Math.abs(tempo - targets.tempoTarget);
  const energyDist = Math.abs(energy - targets.energyTarget);

  // Gaussian benzeri skor (sigma = 0.3)
  const sigma = 0.3;
  const pitchScore = Math.exp(-(pitchDist * pitchDist) / (2 * sigma * sigma));
  const energyScore = Math.exp(-(energyDist * energyDist) / (2 * sigma * sigma));

  // Ağırlıklı ortalama (pitch en önemli)
  // Eğer tempo geçerli tespit edilemediyse (0 ise), değerlendirmeye katma
  if (tempo > 0) {
    const tempoScore = Math.exp(-(tempoDist * tempoDist) / (2 * sigma * sigma));
    return pitchScore * 0.5 + tempoScore * 0.2 + energyScore * 0.3;
  }
  
  return pitchScore * 0.6 + energyScore * 0.4;
}

/**
 * Duygu geçiş animasyonu için geçiş süresini belirler.
 * Duygu değişimleri keskin olmamalı — smooth transition.
 */
export function getTransitionDuration(fromEmotion, toEmotion) {
  if (fromEmotion === toEmotion) return 0;

  // Benzer duygular arası geçiş daha hızlı
  const similarPairs = [
    ['happy', 'calm'],
    ['angry', 'stressed'],
    ['sad', 'calm'],
  ];

  const isSimilar = similarPairs.some(
    ([a, b]) =>
      (fromEmotion === a && toEmotion === b) ||
      (fromEmotion === b && toEmotion === a)
  );

  return isSimilar ? 500 : 1000; // ms
}
