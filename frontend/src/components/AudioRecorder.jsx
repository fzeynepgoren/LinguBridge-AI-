/**
 * LinguBridge AI — AudioRecorder Component
 * Mikrofon kontrol bileşeni. Kayıt başlatma/durdurma ve durum gösterimi.
 */

export default function AudioRecorder({
  isRecording,
  isListening,
  onStartRecording,
  onStopRecording,
  onStartListening,
  onStopListening,
  error,
}) {
  const handleToggle = () => {
    if (isRecording) {
      onStopRecording();
      onStopListening();
    } else {
      onStartRecording();
      onStartListening();
    }
  };

  return (
    <div className="audio-recorder">
      <button
        className={`record-btn ${isRecording ? 'recording' : ''}`}
        onClick={handleToggle}
        id="record-btn"
        title={isRecording ? 'Kaydı durdur (Space)' : 'Kayıt başlat (Space)'}
        aria-label={isRecording ? 'Kaydı durdur' : 'Mikrofonu başlat'}
        aria-pressed={isRecording}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.code === 'Space') {
            e.preventDefault();
            handleToggle();
          }
        }}
      >
        <div className="record-btn-inner">
          {isRecording ? (
            <div className="record-stop-icon">⏹</div>
          ) : (
            <div className="record-mic-icon">🎤</div>
          )}
        </div>
        {isRecording && (
          <>
            <div className="record-pulse pulse-1"></div>
            <div className="record-pulse pulse-2"></div>
            <div className="record-pulse pulse-3"></div>
          </>
        )}
      </button>

      <div className="record-status">
        {isRecording ? (
          <span className="status-recording">
            <span className="status-dot"></span>
            {isListening ? 'Dinleniyor & Analiz ediliyor...' : 'Ses analiz ediliyor...'}
          </span>
        ) : (
          <span className="status-idle">Mikrofonu başlatmak için tıklayın</span>
        )}
      </div>

      {error && <div className="record-error">{error}</div>}
    </div>
  );
}
