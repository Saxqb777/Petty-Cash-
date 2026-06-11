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
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none" style={{ maxWidth: 360 }}>
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-lg shadow-card-hover border text-sm font-medium animate-slide-up
              ${t.type === 'success' ? 'bg-white border-emerald-200 text-emerald-800' :
                t.type === 'error'   ? 'bg-white border-red-200 text-red-800' :
                                       'bg-white border-paper-400 text-ink-800'}`}
          >
            {t.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />}
            {t.type === 'error'   && <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />}
            {t.type === 'info'    && <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />}
            <span className="flex-1 leading-snug">{t.message}</span>
            <button onClick={() => remove(t.id)} className="text-ink-300 hover:text-ink-600 flex-shrink-0 transition-colors">
              <X className="w-3.5 h-3.5" />
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
