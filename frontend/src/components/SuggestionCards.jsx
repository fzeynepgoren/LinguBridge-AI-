/**
 * LinguBridge AI — SuggestionCards Component
 * Bağlamsal yanıt önerileri kartları.
 * Duygu durumuna ve konuşma bağlamına göre öneri sunar.
 */

export default function SuggestionCards({
  suggestions = [],
  reasoning = '',
  onSelectSuggestion,
  isLoading = false,
}) {
  if (isLoading) {
    return (
      <div className="suggestion-cards">
        <div className="suggestion-header">
          <h3>💡 Yanıt Önerileri</h3>
        </div>
        <div className="suggestion-loading">
          <div className="loading-dots">
            <span></span><span></span><span></span>
          </div>
          <p>Öneriler hazırlanıyor...</p>
        </div>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="suggestion-cards">
        <div className="suggestion-header">
          <h3>💡 Yanıt Önerileri</h3>
        </div>
        <div className="suggestion-empty">
          <p>Çeviri yapıldığında burada bağlamsal yanıt önerileri görünecek.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="suggestion-cards">
      <div className="suggestion-header">
        <h3>💡 Yanıt Önerileri</h3>
        {reasoning && <span className="suggestion-reasoning">{reasoning}</span>}
      </div>

      <div className="suggestion-grid">
        {suggestions.map((suggestion, index) => (
          <button
            key={index}
            className={`suggestion-card suggestion-${suggestion.type}`}
            onClick={() => onSelectSuggestion(suggestion.text)}
            title={`Bu öneriyi kullan: ${suggestion.text}`}
          >
            <div className="card-icon">{suggestion.icon}</div>
            <div className="card-content">
              <span className="card-label">{suggestion.label}</span>
              <p className="card-text">{suggestion.text}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
