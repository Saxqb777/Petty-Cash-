import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { SITE_URL } from '../lib/site';

// demo.docledger.site: a visitor lands, a sample company is opened for them in
// the demo database, and they are signed straight in. ?for=<code> comes from a
// Doc Ledger email and names the company after the reader.
export default function DemoBoot() {
  const { refreshUser } = useAuth();
  const [error, setError] = useState('');
  const started = useRef(false);
  const code = new URLSearchParams(window.location.search).get('for') || '';

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    fetch('/api/demo/start', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ for: code }),
    })
      .then(async r => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || 'The demo could not open.');
        window.history.replaceState(null, '', '/');
        await refreshUser();
      })
      .catch(err => setError(err.message));
  }, [code, refreshUser]);

  return (
    <div className="min-h-screen bg-paper-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 bg-flare-500 flex items-center justify-center flex-shrink-0">
            <span className="text-ink-900 text-base font-extrabold w-wide">DL</span>
          </div>
          <p className="text-ink-900 font-extrabold text-xl w-wide leading-none">Doc Ledger</p>
        </div>
        {error ? (
          <div className="plate px-4 py-4">
            <p className="text-sm text-ink-900 mb-3">{error}</p>
            <a href={SITE_URL} className="btn-primary w-full">Back to docledger.site</a>
          </div>
        ) : (
          <div className="plate px-4 py-4">
            <p className="label">Demo</p>
            <p className="text-lg text-ink-900 font-bold w-wide">Setting up your sample company</p>
            <p className="text-sm text-ink-500 mt-1">Three months of shipping bills, fuel and petty cash, already read.</p>
            <div className="mt-4 h-1.5 w-full bg-paper-300 overflow-hidden">
              <div className="h-full w-1/3 bg-blue-600 animate-pulse" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
