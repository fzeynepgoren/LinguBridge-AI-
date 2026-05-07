/**
 * LinguBridge AI — Ana Uygulama
 * Duygu ve Kültür Odaklı Akıllı İletişim Asistanı
 * 
 * Tüm modülleri orkestre eder:
 * - Ses kaydı & konuşma tanıma (STT)
 * - Gerçek zamanlı duygu analizi (pitch/tempo/enerji)
 * - Akıllı çeviri + nezaket adaptasyonu
 * - Bağlamsal yanıt önerileri
 * - Adaptif arayüz (duyguya göre tema)
 */

import { useState, useCallback, useEffect } from 'react';
import useAudioAnalysis from './hooks/useAudioAnalysis';
import useSpeechRecognition from './hooks/useSpeechRecognition';
import AudioRecorder from './components/AudioRecorder';
import WaveformVisualizer from './components/WaveformVisualizer';
import EmotionDisplay from './components/EmotionDisplay';
import TranslationPanel from './components/TranslationPanel';
import PolitenessSlider from './components/PolitenessSlider';
import SuggestionCards from './components/SuggestionCards';
import { translateText, getSuggestions } from './utils/api';
import { EMOTIONS } from './utils/emotionClassifier';
import './App.css';

// STT dil kodları
const STT_LANG_MAP = {
  tr: 'tr-TR',
  en: 'en-US',
  de: 'de-DE',
  fr: 'fr-FR',
  es: 'es-ES',
  ja: 'ja-JP',
  ko: 'ko-KR',
  ar: 'ar-SA',
  zh: 'zh-CN',
  ru: 'ru-RU',
  it: 'it-IT',
  pt: 'pt-PT',
};

export default function App() {
  // === State ===
  const [sourceLang, setSourceLang] = useState('en');
  const [targetLang, setTargetLang] = useState('tr');
  const [sourceText, setSourceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [adaptedText, setAdaptedText] = useState('');
  const [politenessLevel, setPolitenessLevel] = useState(50);
  const [isTranslating, setIsTranslating] = useState(false);
  const [changesMade, setChangesMade] = useState([]);
  const [politenessLabel, setPolitenessLabel] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsReasoning, setSuggestionsReasoning] = useState('');
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false);
  const [backendStatus, setBackendStatus] = useState('checking'); // 'online', 'offline', 'checking'
  const [conversationHistory, setConversationHistory] = useState([]);

  // === Hooks ===
  const audioAnalysis = useAudioAnalysis();
  const speechRecognition = useSpeechRecognition(STT_LANG_MAP[sourceLang] || 'tr-TR');

  // Duygu durumuna göre adaptif arka plan
  const currentEmotion = audioAnalysis.audioData.emotion || 'neutral';
  const emotionData = EMOTIONS[currentEmotion] || EMOTIONS.neutral;

  // === Backend sağlık kontrolü ===
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/health');
        if (res.ok) {
          setBackendStatus('online');
        } else {
          setBackendStatus('offline');
        }
      } catch {
        setBackendStatus('offline');
      }
    };
    checkBackend();
    const interval = setInterval(checkBackend, 10000);
    return () => clearInterval(interval);
  }, []);

  // STT transkriptini kaynak metne aktar
  useEffect(() => {
    if (speechRecognition.transcript) {
      setSourceText(speechRecognition.transcript.trim());
    }
  }, [speechRecognition.transcript]);

  // === Handlers ===

  const handleTranslate = useCallback(async () => {
    if (!sourceText.trim()) return;

    setIsTranslating(true);
    setIsSuggestionsLoading(true);

    try {
      // Çeviri + nezaket adaptasyonu
      const result = await translateText(
        sourceText,
        sourceLang,
        targetLang,
        politenessLevel,
        currentEmotion
      );

      setTranslatedText(result.translated_text);
      setAdaptedText(result.adapted_text);
      setChangesMade(result.changes_made || []);
      setPolitenessLabel(result.politeness_label || '');

      // Konuşma geçmişine ekle
      const newEntry = {
        source: sourceText,
        translated: result.adapted_text,
        emotion: currentEmotion,
        timestamp: Date.now(),
      };
      setConversationHistory((prev) => [...prev.slice(-9), newEntry]);

      // Bağlamsal öneriler
      try {
        const sugResult = await getSuggestions(
          sourceText,
          targetLang,
          currentEmotion,
          politenessLevel,
          conversationHistory.map((h) => h.source)
        );
        setSuggestions(sugResult.suggestions || []);
        setSuggestionsReasoning(sugResult.reasoning || '');
      } catch {
        setSuggestions([]);
      }
    } catch (err) {
      console.error('Çeviri hatası:', err);
      setAdaptedText('[Çeviri hatası — backend çalıştığından emin olun]');
    } finally {
      setIsTranslating(false);
      setIsSuggestionsLoading(false);
    }
  }, [sourceText, sourceLang, targetLang, politenessLevel, currentEmotion, conversationHistory]);

  const handleSelectSuggestion = useCallback((text) => {
    setSourceText(text);
  }, []);

  const handleSourceLangChange = useCallback((lang) => {
    setSourceLang(lang);
    speechRecognition.clearTranscript();
  }, [speechRecognition]);

  return (
    <div
      className="app"
      style={{
        '--emotion-color': emotionData.color,
        '--emotion-bg': emotionData.bgGradient,
      }}
    >
      {/* Adaptif arka plan */}
      <div
        className="adaptive-background"
        style={{ background: emotionData.bgGradient }}
      />

      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <div className="logo">
            <span className="logo-icon">🌉</span>
            <div>
              <h1>LinguBridge AI</h1>
              <p className="subtitle">Duygu ve Kültür Odaklı Akıllı İletişim Asistanı</p>
            </div>
          </div>
          <div className="header-status">
            <span className={`backend-status ${backendStatus}`}>
              <span className="status-indicator"></span>
              {backendStatus === 'online'
                ? 'Backend Aktif'
                : backendStatus === 'offline'
                ? 'Backend Kapalı'
                : 'Kontrol ediliyor...'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="app-main">
        {/* Offline uyarısı */}
        {backendStatus === 'offline' && (
          <div className="offline-banner">
            <span>⚠️</span>
            <div>
              <strong>Backend sunucusu çalışmıyor.</strong>
              <p>
                Terminalde şu komutu çalıştırın:{' '}
                <code>cd backend && pip install -r requirements.txt && uvicorn main:app --reload</code>
              </p>
            </div>
          </div>
        )}

        {/* Sol Panel: Ses & Duygu */}
        <div className="panel-grid">
          <section className="panel voice-panel">
            <AudioRecorder
              isRecording={audioAnalysis.isRecording}
              isListening={speechRecognition.isListening}
              onStartRecording={audioAnalysis.startRecording}
              onStopRecording={audioAnalysis.stopRecording}
              onStartListening={speechRecognition.startListening}
              onStopListening={speechRecognition.stopListening}
              error={audioAnalysis.error || speechRecognition.error}
            />

            <WaveformVisualizer
              waveform={audioAnalysis.audioData.waveform}
              emotion={currentEmotion}
              isActive={audioAnalysis.isRecording}
            />

            {/* Canlı transkript */}
            {speechRecognition.isListening && speechRecognition.interimTranscript && (
              <div className="live-transcript">
                <span className="transcript-label">🎙️ Canlı:</span>
                <span className="transcript-text">{speechRecognition.interimTranscript}</span>
              </div>
            )}

            <EmotionDisplay
              emotion={currentEmotion}
              confidence={audioAnalysis.audioData.confidence}
              details={audioAnalysis.audioData.details}
            />
          </section>

          {/* Orta Panel: Çeviri & Nezaket */}
          <section className="panel translation-main-panel">
            <PolitenessSlider
              value={politenessLevel}
              onChange={setPolitenessLevel}
            />

            <TranslationPanel
              sourceText={sourceText}
              onSourceTextChange={setSourceText}
              translatedText={translatedText}
              adaptedText={adaptedText}
              sourceLang={sourceLang}
              targetLang={targetLang}
              onSourceLangChange={handleSourceLangChange}
              onTargetLangChange={setTargetLang}
              onTranslate={handleTranslate}
              isTranslating={isTranslating}
              changesMade={changesMade}
              politenessLabel={politenessLabel}
            />
          </section>

          {/* Sağ Panel: Öneriler & Geçmiş */}
          <section className="panel suggestions-panel">
            <SuggestionCards
              suggestions={suggestions}
              reasoning={suggestionsReasoning}
              onSelectSuggestion={handleSelectSuggestion}
              isLoading={isSuggestionsLoading}
            />

            {/* Konuşma Geçmişi */}
            {conversationHistory.length > 0 && (
              <div className="conversation-history">
                <h3>📜 Konuşma Geçmişi</h3>
                <div className="history-list">
                  {conversationHistory
                    .slice()
                    .reverse()
                    .map((entry, i) => (
                      <div key={i} className="history-item">
                        <div className="history-source">
                          <span className="history-emotion">
                            {EMOTIONS[entry.emotion]?.emoji || '😐'}
                          </span>
                          {entry.source}
                        </div>
                        <div className="history-translated">→ {entry.translated}</div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <p>
          LinguBridge AI — HCI Projesi | Duygu Analizi + Kültürel Adaptasyon + Akıllı İletişim
        </p>
      </footer>
    </div>
  );
}
