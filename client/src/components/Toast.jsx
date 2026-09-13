import { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

let _toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const add = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++_toastId;
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), duration);
  }, []);

  const remove = useCallback((id) => setToasts(t => t.filter(x => x.id !== id)), []);

  const toast = {
    success:   (msg, dur) => add(msg, 'success', dur),
    error:     (msg, dur) => add(msg, 'error',   dur || 6000),
    info:      (msg, dur) => add(msg, 'info',    dur),
    showToast: (msg, type = 'info', dur) => add(msg, type, type === 'error' ? (dur || 6000) : dur),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-[360px] z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 px-4 py-3 border-2 border-ink-900 text-sm font-bold animate-rise
              ${t.type === 'success' ? 'bg-green-500 text-ink-900' :
                t.type === 'error'   ? 'bg-flare-500 text-ink-900' :
                                       'bg-blue-600 text-white'}`}
          >
            {t.type === 'success' && <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={2.25} />}
            {t.type === 'error'   && <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={2.25} />}
            {t.type === 'info'    && <Info className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={2.25} />}
            <span className="flex-1 leading-snug">{t.message}</span>
            <button
              onClick={() => remove(t.id)}
              aria-label="Dismiss"
              className={`flex-shrink-0 -mr-1 p-0.5 transition-colors duration-[120ms] ${
                t.type === 'info' ? 'text-white/70 hover:text-white' : 'text-ink-900/60 hover:text-ink-900'
              }`}
            >
              <X className="w-4 h-4" strokeWidth={2.25} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
