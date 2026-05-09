/**
 * LinguBridge AI — useAudioAnalysis Hook
 * Web Audio API ile gerçek zamanlı ses analizi.
 * Mikrofon erişimi, pitch/tempo/enerji tespiti ve dalga formu verisi sağlar.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { detectPitch, calculateEnergy, estimateTempo } from '../utils/pitchDetector';
import { classifyEmotion } from '../utils/emotionClassifier';

export default function useAudioAnalysis() {
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  // Duygu/meta verileri: 450ms throttle ile güncellenir (görsel titreme önleme)
  const [audioData, setAudioData] = useState({
    pitch: 0,
    tempo: 0,
    energy: 0,
    emotion: 'neutral',
    confidence: 0,
    details: {},
  });
  // Dalga formu: her frame güncellenir (WaveformVisualizer için)
  const [waveform, setWaveform] = useState(new Float32Array(0));
  const [error, setError] = useState(null);

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const streamRef = useRef(null);
  const animationRef = useRef(null);
  const analyzeRef = useRef(null);
  const bufferRef = useRef(null);
  // Throttle — emotion/meta saniyede ~2 kez güncellenir
  const lastMetaUpdateRef = useRef(0);

  // Pitch geçmişi — smoothing için
  const pitchHistoryRef = useRef([]);
  // 12 frame → ~200ms geçmişte dominant duygu seçilir
  const emotionHistoryRef = useRef([]);

  /**
   * Analiz döngüsü — her frame'de çalışır.
   */
  const analyze = useCallback(() => {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.fftSize;

    if (!bufferRef.current || bufferRef.current.length !== bufferLength) {
      bufferRef.current = new Float32Array(bufferLength);
    }

    analyser.getFloatTimeDomainData(bufferRef.current);
    const sampleRate = audioContextRef.current.sampleRate;

    // Pitch tespiti
    const rawPitch = detectPitch(bufferRef.current, sampleRate);
    const energy = calculateEnergy(bufferRef.current);
    const tempo = estimateTempo(bufferRef.current, sampleRate);

    // Pitch smoothing (son 5 değerin ortalaması)
    if (rawPitch > 0) {
      pitchHistoryRef.current.push(rawPitch);
      if (pitchHistoryRef.current.length > 5) {
        pitchHistoryRef.current.shift();
      }
    }

    const smoothedPitch =
      pitchHistoryRef.current.length > 0
        ? pitchHistoryRef.current.reduce((a, b) => a + b, 0) / pitchHistoryRef.current.length
        : 0;
    const pitchRange =
      pitchHistoryRef.current.length > 1
        ? Math.max(...pitchHistoryRef.current) - Math.min(...pitchHistoryRef.current)
        : 0;

    // Duygu sınıflandırması
    let emotionResult = { emotion: 'neutral', confidence: 0, details: {} };
    if (smoothedPitch > 0 && energy > 0.005) {
      emotionResult = classifyEmotion(smoothedPitch, tempo, energy, { pitchRange });

      // Emotion smoothing (son 12 frame'in modu — ~200ms pencere)
      emotionHistoryRef.current.push(emotionResult.emotion);
      if (emotionHistoryRef.current.length > 12) {
        emotionHistoryRef.current.shift();
      }

      // En sık görülen duyguyu bul
      const emotionCounts = {};
      emotionHistoryRef.current.forEach((e) => {
        emotionCounts[e] = (emotionCounts[e] || 0) + 1;
      });
      const dominantEmotion = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1])[0][0];
      emotionResult.emotion = dominantEmotion;
    }

    // Dalga formu verisi (görselleştirme için küçültülmüş)
    const waveformSize = 128;
    const waveform = new Float32Array(waveformSize);
    const step = Math.floor(bufferLength / waveformSize);
    for (let i = 0; i < waveformSize; i++) {
      waveform[i] = bufferRef.current[i * step] || 0;
    }

    // Dalga formu her frame güncellenir (görselleştirici için)
    setWaveform(waveform);

    // Duygu/meta: en fazla 450ms'de bir güncellenir → EmotionDisplay titremez
    const now = Date.now();
    if (now - lastMetaUpdateRef.current >= 450) {
      lastMetaUpdateRef.current = now;
      setAudioData({
        pitch: Math.round(smoothedPitch),
        tempo: Math.round(tempo * 10) / 10,
        energy: Math.round(energy * 1000) / 1000,
        emotion: emotionResult.emotion,
        confidence: emotionResult.confidence,
        details: emotionResult.details || {},
      });
    }

    animationRef.current = requestAnimationFrame(() => analyzeRef.current?.());
  }, []);

  useEffect(() => {
    analyzeRef.current = analyze;
  }, []);

  /**
   * Mikrofonu başlatır ve ses analizine başlar.
   */
  const startRecording = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      sourceRef.current = source;
      streamRef.current = stream;

      setIsRecording(true);
      setIsAnalyzing(true);

      // Analiz döngüsünü başlat
      pitchHistoryRef.current = [];
      emotionHistoryRef.current = [];
      animationRef.current = requestAnimationFrame(() => analyzeRef.current?.());
    } catch (err) {
      console.error('Mikrofon erişim hatası:', err);
      setError(
        err.name === 'NotAllowedError'
          ? 'Mikrofon erişimi reddedildi. Lütfen tarayıcı ayarlarından izin verin.'
          : 'Mikrofon erişiminde bir hata oluştu.'
      );
    }
  }, [analyze]);

  /**
   * Kaydı durdurur ve kaynakları serbest bırakır.
   */
  const stopRecording = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    setIsRecording(false);
    setIsAnalyzing(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, [stopRecording]);

  return {
    isRecording,
    isAnalyzing,
    audioData,
    waveform,
    error,
    startRecording,
    stopRecording,
  };
}
