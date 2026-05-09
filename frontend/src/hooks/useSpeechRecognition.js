/**
 * LinguBridge AI — useSpeechRecognition Hook
 * Web Speech API ile gerçek zamanlı konuşma tanıma (STT).
 * Tamamen ücretsiz, tarayıcı-native.
 *
 * Closure stale-state sorununu önlemek için isListening yerine ref kullanılır.
 */

import { useState, useRef, useCallback, useEffect } from 'react';

export default function useSpeechRecognition(language = 'tr-TR') {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState(null);
  const isSupported = Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  const recognitionRef = useRef(null);
  // Auto-restart kararı için canlı ref (closure'dan kaçınır)
  const shouldListenRef = useRef(false);
  const languageRef = useRef(language);
  const createRecognitionRef = useRef(null);

  // Dil değişimini her zaman güncel tut
  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  const clearTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  /**
   * Yeni bir SpeechRecognition instance kurar.
   * Auto-restart için her seferinde yeni instance üretmek bazı tarayıcılarda
   * "InvalidStateError" sorununu önler.
   */
  const createRecognition = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    const recognition = new SpeechRecognition();
    recognition.lang = languageRef.current;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event) => {
      let newFinalText = '';
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) newFinalText += result[0].transcript + ' ';
        else interimText += result[0].transcript;
      }
      if (newFinalText) setTranscript((prev) => prev + newFinalText);
      setInterimTranscript(interimText);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setError('Mikrofon erişimi reddedildi.');
        shouldListenRef.current = false;
      } else if (event.error === 'no-speech' || event.error === 'aborted') {
        // sessizlik / manuel durdurma — yutulur
      } else {
        setError(`Konuşma tanıma hatası: ${event.error}`);
      }
    };

    recognition.onend = () => {
      if (shouldListenRef.current) {
        try {
          const next = createRecognitionRef.current?.();
          if (next) {
            recognitionRef.current = next;
            next.start();
            return;
          }
        } catch (err) {
          console.warn('STT auto-restart başarısız:', err);
        }
      }
      setIsListening(false);
      setInterimTranscript('');
    };

    return recognition;
  }, []);

  useEffect(() => {
    createRecognitionRef.current = createRecognition;
  }, [createRecognition]);

  const startListening = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Bu tarayıcı konuşma tanımayı desteklemiyor. Chrome kullanmanızı öneriyoruz.');
      return;
    }
    if (shouldListenRef.current) return;

    clearTranscript();
    shouldListenRef.current = true;

    const recognition = createRecognition();
    if (!recognition) return;
    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (err) {
      setError('Konuşma tanıma başlatılamadı.');
      shouldListenRef.current = false;
      console.error(err);
    }
  }, [clearTranscript, createRecognition]);

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    const rec = recognitionRef.current;
    if (rec) {
      try { rec.stop(); } catch { /* ignore */ }
    }
    recognitionRef.current = null;
    setIsListening(false);
    setInterimTranscript('');
  }, []);

  useEffect(() => {
    return () => {
      shouldListenRef.current = false;
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch { /* ignore */ }
      }
    };
  }, []);

  return {
    isListening,
    isSupported,
    transcript,
    interimTranscript,
    error,
    startListening,
    stopListening,
    clearTranscript,
    setTranscript,
  };
}
