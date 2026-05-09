/**
 * LinguBridge AI — Ana Uygulama
 * Duygu ve Kültür Odaklı Akıllı İletişim Asistanı
 *
 * Tüm modülleri orkestre eder:
 * - Ses kaydı & konuşma tanıma (STT)
 * - Gerçek zamanlı duygu analizi (pitch/tempo/enerji)
 * - LLM destekli çeviri + nezaket adaptasyonu + öneri (tek endpoint)
 * - Adaptif arayüz (duyguya göre tema)
 * - Duygu aktarımlı TTS
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
import IncomingMessageAnalyzer from './components/IncomingMessageAnalyzer';
import { processMessage } from './utils/api';
import { EMOTIONS } from './utils/emotionClassifier';
import './App.css';

// STT dil kodları
const STT_LANG_MAP = {
  tr: 'tr-TR', en: 'en-US', de: 'de-DE', fr: 'fr-FR',
  es: 'es-ES', ja: 'ja-JP', ko: 'ko-KR', ar: 'ar-SA',
  zh: 'zh-CN', ru: 'ru-RU', it: 'it-IT', pt: 'pt-PT',
};

// Backend'den gelen fallback nedenleri — kısa Türkçe etiketler
const FALLBACK_REASON_LABEL = {
  rate_limit: 'Kota aşıldı',
  not_configured: 'API key yok',
  unavailable: 'LLM kapalı',
  response_error: 'Yanıt hatası',
  unknown: 'Bilinmiyor',
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
  const [backendStatus, setBackendStatus] = useState('checking'); // 'online' | 'offline' | 'checking'
  const [llmMode, setLlmMode] = useState('unknown'); // 'llm' | 'fallback' | 'unknown'
  const [fallbackReason, setFallbackReason] = useState(null);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [ttsHints, setTtsHints] = useState(null);
  const [emotionOverride, setEmotionOverride] = useState('auto');

  // === Hooks ===
  const audioAnalysis = useAudioAnalysis();
  const speechRecognition = useSpeechRecognition(STT_LANG_MAP[sourceLang] || 'tr-TR');

  // Duygu durumu — adaptif arka plan ve TTS için
  const detectedEmotion = audioAnalysis.audioData.emotion || 'neutral';
  const detectionConfidence = audioAnalysis.audioData.confidence || 0;
  // Düşük güvende otomatik mod 'neutral' sayılır ama UI 'belirsiz' rozeti gösterir
  const isAutoUncertain =
    emotionOverride === 'auto' && audioAnalysis.isRecording && detectionConfidence > 0 && detectionConfidence < 35;
  const effectiveAutoEmotion = isAutoUncertain ? 'neutral' : detectedEmotion;
  const currentEmotion = emotionOverride === 'auto' ? effectiveAutoEmotion : emotionOverride;
  const emotionData = EMOTIONS[currentEmotion] || EMOTIONS.neutral;

  // === Backend sağlık kontrolü ===
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/health');
        if (res.ok) {
          const data = await res.json();
          setBackendStatus('online');
          setLlmMode(data.llm === 'configured' ? 'llm' : 'fallback');
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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- STT sonucu textarea ile senkron tutulur.
      setSourceText(speechRecognition.transcript.trim());
    }
  }, [speechRecognition.transcript]);

  // === Çeviri akışı ===
  const handleTranslate = useCallback(async () => {
    if (!sourceText.trim() || isTranslating) return;

    setIsTranslating(true);

    try {
      const result = await processMessage({
        text: sourceText,
        sourceLang,
        targetLang,
        politenessLevel,
        emotion: currentEmotion,
        conversationHistory: conversationHistory.slice(-5),
      });

      setTranslatedText(result.translated_text || '');
      setAdaptedText(result.adapted_text || '');
      setChangesMade(result.changes_explained || []);
      setPolitenessLabel(result.politeness_label || '');
      setSuggestions(result.suggestions || []);
      setSuggestionsReasoning(result.reasoning || '');
      setTtsHints(result.tts_hints || null);
      if (result.mode) setLlmMode(result.mode);
      setFallbackReason(result.mode === 'fallback' ? (result.fallback_reason || 'unknown') : null);

      // Konuşma geçmişine ekle (yeni format: role, text, emotion)
      setConversationHistory((prev) => [
        ...prev.slice(-9),
        {
          role: 'user',
          text: sourceText,
          emotion: currentEmotion,
          timestamp: Date.now(),
        },
        {
          role: 'partner',
          text: result.adapted_text || '',
          emotion: 'neutral',
          timestamp: Date.now(),
        },
      ]);
    } catch (err) {
      console.error('Çeviri hatası:', err);
      setAdaptedText('[Çeviri hatası — backend çalıştığından emin olun]');
      setSuggestions([]);
    } finally {
      setIsTranslating(false);
    }
  }, [
    sourceText,
    sourceLang,
    targetLang,
    politenessLevel,
    currentEmotion,
    conversationHistory,
    isTranslating,
  ]);

  const handleSelectSuggestion = useCallback((text) => {
    setSourceText(text);
  }, []);

  // Slider değişince mevcut bir adapte metin varsa otomatik yeniden çevir (debounced)
  useEffect(() => {
    if (!adaptedText || !sourceText.trim()) return;
    if (isTranslating) return;
    const id = setTimeout(() => {
      handleTranslate();
    }, 700);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [politenessLevel]);

  const handleSourceLangChange = useCallback(
    (lang) => {
      setSourceLang(lang);
      speechRecognition.clearTranscript();
      // Dil değişince geçmiş yeni oturuma karışmasın
      setConversationHistory([]);
    },
    [speechRecognition],
  );

  const handleTargetLangChange = useCallback((lang) => {
    setTargetLang(lang);
    setConversationHistory([]);
    setSuggestions([]);
    setAdaptedText('');
    setTranslatedText('');
  }, []);

  // === Klavye kısayolları (a11y) ===
  useEffect(() => {
    const onKey = (e) => {
      // Cmd/Ctrl + Enter → çevir
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleTranslate();
        return;
      }
      // 1/2/3 → öneri seç (input içinde değilken)
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (['1', '2', '3'].includes(e.key)) {
        const idx = Number(e.key) - 1;
        const s = suggestions[idx];
        if (s) {
          e.preventDefault();
          handleSelectSuggestion(s.text);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleTranslate, handleSelectSuggestion, suggestions]);

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
        aria-hidden="true"
      />

      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <div className="logo">
            <span className="logo-icon" aria-hidden="true">🌉</span>
            <div>
              <h1>LinguBridge AI</h1>
              <p className="subtitle">Duygu ve Kültür Odaklı Akıllı İletişim Asistanı</p>
            </div>
          </div>
          <div className="header-status">
            {backendStatus === 'online' && (
              <span
                className={`mode-badge ${llmMode === 'llm' ? 'mode-llm' : 'mode-fallback'}`}
                title={
                  llmMode === 'llm'
                    ? 'LLM aktif'
                    : `Kural tabanlı yedek mod${fallbackReason ? ` — sebep: ${FALLBACK_REASON_LABEL[fallbackReason] || fallbackReason}` : ''}`
                }
              >
                {llmMode === 'llm'
                  ? '🤖 LLM'
                  : `⚡ Fallback${fallbackReason ? ` • ${FALLBACK_REASON_LABEL[fallbackReason] || fallbackReason}` : ''}`}
              </span>
            )}
            <span
              className={`backend-status ${backendStatus}`}
              role="status"
              aria-live="polite"
            >
              <span className="status-indicator" aria-hidden="true"></span>
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
        {backendStatus === 'offline' && (
          <div className="offline-banner" role="alert">
            <span aria-hidden="true">⚠️</span>
            <div>
              <strong>Backend sunucusu çalışmıyor.</strong>
              <p>
                Terminalde şu komutu çalıştırın:{' '}
                <code>cd backend && uvicorn main:app --reload</code>
              </p>
            </div>
          </div>
        )}

        <div className="panel-grid">
          {/* Sol Panel: Ses & Duygu */}
          <section className="panel voice-panel" aria-label="Ses ve duygu paneli">
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
              waveform={audioAnalysis.waveform}
              emotion={currentEmotion}
              isActive={audioAnalysis.isRecording}
            />

            {speechRecognition.isListening && speechRecognition.interimTranscript && (
              <div className="live-transcript" aria-live="polite">
                <span className="transcript-label">🎙️ Canlı:</span>
                <span className="transcript-text">{speechRecognition.interimTranscript}</span>
              </div>
            )}

            <EmotionDisplay
              emotion={currentEmotion}
              detectedEmotion={detectedEmotion}
              emotionOverride={emotionOverride}
              onEmotionOverrideChange={setEmotionOverride}
              confidence={audioAnalysis.audioData.confidence}
              details={audioAnalysis.audioData.details}
              isUncertain={isAutoUncertain}
            />
          </section>

          {/* Orta Panel: Çeviri & Nezaket */}
          <section className="panel translation-main-panel" aria-label="Çeviri paneli">
            <PolitenessSlider value={politenessLevel} onChange={setPolitenessLevel} />

            <TranslationPanel
              sourceText={sourceText}
              onSourceTextChange={setSourceText}
              translatedText={translatedText}
              adaptedText={adaptedText}
              sourceLang={sourceLang}
              targetLang={targetLang}
              onSourceLangChange={handleSourceLangChange}
              onTargetLangChange={handleTargetLangChange}
              onTranslate={handleTranslate}
              isTranslating={isTranslating}
              changesMade={changesMade}
              politenessLabel={politenessLabel}
              emotion={currentEmotion}
              ttsHints={ttsHints}
            />
          </section>

          {/* Sağ Panel: Öneriler & Geçmiş */}
          <section className="panel suggestions-panel" aria-label="Öneriler ve geçmiş">
            <SuggestionCards
              suggestions={suggestions}
              reasoning={suggestionsReasoning}
              onSelectSuggestion={handleSelectSuggestion}
              isLoading={isTranslating}
              sourceLang={sourceLang}
            />

            {conversationHistory.length > 0 && (
              <div className="conversation-history">
                <h3>📜 Konuşma Geçmişi</h3>
                <div className="history-list">
                  {conversationHistory
                    .slice()
                    .reverse()
                    .map((entry, i) => (
                      <div key={i} className={`history-item history-${entry.role}`}>
                        <div className="history-source">
                          <span className="history-emotion" aria-hidden="true">
                            {entry.role === 'user'
                              ? EMOTIONS[entry.emotion]?.emoji || '😐'
                              : '🌐'}
                          </span>
                          {entry.text}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </section>
        </div>

        <IncomingMessageAnalyzer
          messageLang={targetLang}
          replyLang={sourceLang}
          onUseReply={handleSelectSuggestion}
        />
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <p>
          LinguBridge AI — HCI Projesi | Duygu Analizi + Kültürel Adaptasyon + Akıllı İletişim
          {' · '}
          <kbd>⌘/Ctrl</kbd>+<kbd>Enter</kbd> ile çevir, <kbd>1/2/3</kbd> ile öneri seç
        </p>
      </footer>
    </div>
  );
}
