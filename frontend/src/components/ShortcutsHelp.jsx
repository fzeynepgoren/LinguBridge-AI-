/**
 * LinguBridge AI — Klavye Kısayolları Yardım Overlay
 * HCI: Recognition over recall + Help & documentation (Nielsen)
 * "?" tuşu ile açılır, ESC ile kapanır.
 */

import { useEffect } from 'react';

const SHORTCUTS = [
  { keys: ['⌘', 'Enter'], desc: 'Çevir & adapte et' },
  { keys: ['Ctrl', 'Enter'], desc: 'Çevir (Windows/Linux)' },
  { keys: ['1'], desc: 'İlk öneriyi seç' },
  { keys: ['2'], desc: 'İkinci öneriyi seç' },
  { keys: ['3'], desc: 'Üçüncü öneriyi seç' },
  { keys: ['?'], desc: 'Bu yardım panelini aç / kapat' },
  { keys: ['Esc'], desc: 'Açık paneli kapat' },
];

export default function ShortcutsHelp({ open, onClose }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="shortcuts-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
      onClick={onClose}
    >
      <div className="shortcuts-modal" onClick={(e) => e.stopPropagation()}>
        <div className="shortcuts-header">
          <h2 id="shortcuts-title">⌨️ Klavye Kısayolları</h2>
          <button
            type="button"
            className="shortcuts-close"
            onClick={onClose}
            aria-label="Yardımı kapat"
          >
            ×
          </button>
        </div>
        <p className="shortcuts-hint">
          Daha hızlı çalışmak için bu kısayolları kullanın. <kbd>?</kbd> tuşuyla bu pencereyi
          her an açabilirsiniz.
        </p>
        <ul className="shortcuts-list">
          {SHORTCUTS.map((s, i) => (
            <li key={i}>
              <span className="shortcuts-keys">
                {s.keys.map((k, j) => (
                  <kbd key={j}>{k}</kbd>
                ))}
              </span>
              <span className="shortcuts-desc">{s.desc}</span>
            </li>
          ))}
        </ul>
        <p className="shortcuts-footer">
          🛈 Konuşma için <strong>mikrofon butonuna</strong> tıklayın · Tonu değiştirmek için
          <strong> duygu butonlarını</strong> kullanın.
        </p>
      </div>
    </div>
  );
}
