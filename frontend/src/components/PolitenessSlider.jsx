/**
 * LinguBridge AI — PolitenessSlider Component
 * Nezaket seviyesini kontrol eden interaktif slider.
 * 0 (çok samimi) → 100 (çok resmi) arası değer üretir.
 */

export default function PolitenessSlider({ value = 50, onChange }) {
  const levels = [
    { min: 0, max: 33, label: 'Samimi', emoji: '🤝', color: '#00CEC9' },
    { min: 34, max: 66, label: 'Nötr', emoji: '💬', color: '#6C5CE7' },
    { min: 67, max: 100, label: 'Resmi', emoji: '👔', color: '#0984E3' },
  ];

  const currentLevel = levels.find((l) => value >= l.min && value <= l.max) || levels[1];

  const handleChange = (e) => {
    onChange(parseInt(e.target.value, 10));
  };

  // Gradient arka plan hesapla
  const percentage = value;
  const gradientStyle = {
    background: `linear-gradient(to right, #00B894 0%, #6C5CE7 50%, #2D3436 100%)`,
  };

  return (
    <div className="politeness-slider">
      <div className="slider-header">
        <h3>🎚️ Nezaket Seviyesi</h3>
        <div
          className="slider-badge"
          style={{
            backgroundColor: currentLevel.color + '20',
            borderColor: currentLevel.color,
            color: currentLevel.color,
          }}
        >
          <span>{currentLevel.emoji}</span>
          <span>{currentLevel.label}</span>
        </div>
      </div>

      <div className="slider-container">
        <div className="slider-labels">
          <span className="slider-label-left">🤝 Samimi</span>
          <span className="slider-label-right">🎩 Resmi</span>
        </div>
        <div className="slider-track-wrapper">
          <div className="slider-track" style={gradientStyle} />
          <input
            type="range"
            min="0"
            max="100"
            value={value}
            onChange={handleChange}
            className="slider-input"
            id="politeness-slider"
          />
        </div>
        <div className="slider-value">{value}</div>
      </div>

      <div className="slider-steps">
        {levels.map((level) => (
          <button
            key={level.label}
            className={`slider-step ${value >= level.min && value <= level.max ? 'active' : ''}`}
            onClick={() => onChange(Math.round((level.min + level.max) / 2))}
            style={
              value >= level.min && value <= level.max
                ? { backgroundColor: level.color + '20', borderColor: level.color }
                : {}
            }
          >
            <span className="step-emoji">{level.emoji}</span>
            <span className="step-label">{level.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
