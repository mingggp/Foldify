import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

// the hook lives next to its provider on purpose
// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  return useContext(ToastContext);
}

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((message, type = 'success', duration = 4000) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type, exiting: false }]);
    
    // Start exit animation before removal
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    }, duration - 400);
    
    // Remove after animation
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 400);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast container: top centre, above everything */}
      <div className="fixed top-3 inset-x-0 z-[9999] flex flex-col items-center gap-2 pointer-events-none px-3" role="status" aria-live="polite">
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const ICONS = {
  success: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  error: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
  info: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  loading: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  ),
};

const TONE = {
  success: 'text-good',
  error: 'text-bad',
  info: 'text-brand-ink',
  loading: 'text-brand-ink',
};

function ToastItem({ toast, onDismiss }) {
  return (
    <button
      type="button"
      onClick={() => onDismiss(toast.id)}
      className="pointer-events-auto glass rounded-2xl pl-3.5 pr-4 py-3 max-w-[min(440px,100%)] flex items-start gap-2.5 text-left text-sm font-medium text-ink"
      style={{ animation: toast.exiting ? 'toast-out 0.3s ease-in forwards' : 'toast-in 0.35s cubic-bezier(0.2,0.8,0.2,1) both' }}
    >
      <span className={`${TONE[toast.type] || TONE.info} shrink-0 mt-px [&_svg]:w-[18px] [&_svg]:h-[18px]`}>{ICONS[toast.type] || ICONS.info}</span>
      <span className="leading-snug">{toast.message}</span>
    </button>
  );
}
