import { useEffect, useRef } from 'react';
import { Clock, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

export default function PendingPage() {
  const { user, logout, refreshUser } = useAuth();
  const { showToast } = useToast();
  const pollRef = useRef(null);

  const pending = user?.memberships?.find(m => m.status === 'pending');

  useEffect(() => {
    pollRef.current = setInterval(async () => {
      try { await refreshUser(); } catch (_) {}
    }, 12000);
    return () => clearInterval(pollRef.current);
  }, []);

  const cancelRequest = async () => {
    await fetch('/api/auth/cancel-request', { method: 'POST', credentials: 'include' });
    showToast('Request cancelled', 'info');
    clearInterval(pollRef.current);
    await logout();
  };

  return (
    <div className="min-h-screen bg-paper-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        {/* Icon */}
        <div className="relative w-16 h-16 mx-auto mb-5">
          <div className="absolute inset-0 bg-amber-50 border border-amber-200 rounded-full flex items-center justify-center">
            <Clock className="w-7 h-7 text-amber-500" />
          </div>
          <div className="absolute inset-0 rounded-full border-2 border-amber-300/50 animate-ping" style={{ animationDuration: '3s' }} />
        </div>

        <h1 className="text-ink-900 text-xl font-semibold mb-2">Awaiting approval</h1>
        <p className="text-ink-500 text-sm leading-relaxed mb-2">
          Your request to join{' '}
          <span className="text-ink-800 font-medium">{pending?.org_name || 'the organization'}</span>{' '}
          is pending. An admin will review and approve your access shortly.
        </p>
        <p className="text-ink-300 text-xs mb-6">This page checks automatically — no need to refresh.</p>

        <button
          onClick={cancelRequest}
          className="flex items-center gap-2 mx-auto text-ink-400 hover:text-ink-700 text-sm transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Cancel request & sign out
        </button>
      </div>
    </div>
  );
}
