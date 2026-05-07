/**
 * LinguBridge AI — useSpeechRecognition Hook
 * Web Speech API ile gerçek zamanlı konuşma tanıma (STT).
 * Tamamen ücretsiz, tarayıcı-native.
 */

import { useState, useRef, useCallback, useEffect } from 'react';

export default function useSpeechRecognition(language = 'tr-TR') {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState(null);
  const [isSupported, setIsSupported] = useState(false);

  const recognitionRef = useRef(null);

  // Tarayıcı desteğini kontrol et
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);
  }, []);

  /**
   * Konuşma tanımayı başlatır.
   */
  const startListening = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError('Bu tarayıcı konuşma tanımayı desteklemiyor. Chrome kullanmanızı öneriyoruz.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = language;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
      clearTranscript();
    };

    recognition.onresult = (event) => {
      let newFinalText = '';
      let interimText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          newFinalText += result[0].transcript + ' ';
        } else {
          interimText += result[0].transcript;
        }
      }

      if (newFinalText) {
        setTranscript((prev) => prev + newFinalText);
      }
      setInterimTranscript(interimText);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        setError('Mikrofon erişimi reddedildi.');
      } else if (event.error === 'no-speech') {
        // Konuşma algılanmadı — normal durum, hata gösterme
      } else {
        setError(`Konuşma tanıma hatası: ${event.error}`);
      }
    };

    recognition.onend = () => {
      // Continuous mode'da otomatik yeniden başlat
      if (recognitionRef.current && isListening) {
        try {
          recognition.start();
        } catch {
          setIsListening(false);
        }
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (err) {
      setError('Konuşma tanıma başlatılamadı.');
      console.error(err);
    }
  }, [language, isListening]);

  /**
   * Konuşma tanımayı durdurur.
   */
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null; // Auto-restart'ı engelle
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setInterimTranscript('');
  }, []);

  /**
   * Transkripti temizler.
   */
  const clearTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
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
