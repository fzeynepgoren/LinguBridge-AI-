/**
 * LinguBridge AI — Toast Notification System
 * HCI: Visibility of system status + non-blocking feedback
 *
 * Kullanım:
 *   const { toasts, push, dismiss } = useToasts();
 *   push({ type: 'warning', title: 'Boş metin', message: 'Önce bir şey yazın.' });
 *   <ToastContainer toasts={toasts} onDismiss={dismiss} />
 */
/* eslint-disable react-refresh/only-export-components */

import { useCallback, useEffect, useRef, useState } from 'react';

const TOAST_ICONS = {
  info: 'ℹ️',
  success: '✅',
  warning: '⚠️',
  error: '⛔',
};

export function useToasts() {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    ({ type = 'info', title, message, duration = 3500 }) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, type, title, message }]);
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss],
  );

  return { toasts, push, dismiss };
}

export function ToastContainer({ toasts, onDismiss }) {
  return (
    <div className="toast-container" role="region" aria-label="Bildirimler" aria-live="polite">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }) {
  const [leaving, setLeaving] = useState(false);

  const handleClose = () => {
    setLeaving(true);
    setTimeout(onDismiss, 220);
  };

  // Otomatik leaving animasyonu için son 220 ms'de işaretle
  useEffect(() => {
    const t = setTimeout(() => setLeaving(true), 3500 - 220);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className={`toast toast-${toast.type} ${leaving ? 'toast-leaving' : ''}`}
      role={toast.type === 'error' || toast.type === 'warning' ? 'alert' : 'status'}
    >
      <span className="toast-icon" aria-hidden="true">{TOAST_ICONS[toast.type]}</span>
      <div className="toast-body">
        {toast.title && <strong className="toast-title">{toast.title}</strong>}
        {toast.message && <p className="toast-message">{toast.message}</p>}
      </div>
      <button
        type="button"
        className="toast-close"
        onClick={handleClose}
        aria-label="Bildirimi kapat"
      >
        ×
      </button>
    </div>
  );
}
