import { AlertTriangle } from 'lucide-react';

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Delete', onConfirm, onCancel, danger = true }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Flat scrim. No blur, no gradient. */}
      <div className="absolute inset-0 bg-ink-900/30" onClick={onCancel} />

      <div className="relative plate w-full max-w-sm animate-rise">
        <div className="p-6">
          <div
            className={`w-9 h-9 border-2 border-ink-900 flex items-center justify-center mb-4 ${
              danger ? 'bg-flare-500' : 'bg-white'
            }`}
          >
            <AlertTriangle className="w-5 h-5 text-ink-900" strokeWidth={2.25} />
          </div>

          <h3 className="text-lg font-extrabold w-wide text-ink-900 mb-1.5">{title}</h3>
          <p className="text-sm text-ink-500 leading-relaxed mb-6">{message}</p>

          <div className="flex gap-3">
            <button onClick={onCancel} className="btn-ghost flex-1">Cancel</button>
            <button onClick={onConfirm} className={danger ? 'btn-flare flex-1' : 'btn-primary flex-1'}>
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
