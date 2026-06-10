import { useEffect, useRef } from 'react';
import { Clock, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

export default function PendingPage() {
  const { user, logout, refreshUser } = useAuth();
  const { showToast } = useToast();
  const pollRef = useRef(null);

  const pending = user?.memberships?.find(m => m.status === 'pending');

  // Poll every 12s — when admin approves the request, refreshUser() updates
  // the auth state and AppShell automatically navigates away from /pending
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
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <div className="relative w-16 h-16 mx-auto mb-5">
          <div className="absolute inset-0 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center">
            <Clock className="w-7 h-7 text-amber-400" />
          </div>
          <div className="absolute inset-0 rounded-full border-2 border-amber-500/20 animate-ping" style={{ animationDuration: '3s' }} />
        </div>
        <h1 className="text-white text-xl font-semibold mb-2">Awaiting approval</h1>
        <p className="text-white/40 text-sm leading-relaxed mb-2">
          Your request to join{' '}
          <span className="text-white/70 font-medium">{pending?.org_name || 'the organization'}</span>{' '}
          is pending. An admin will review and approve your access shortly.
        </p>
        <p className="text-white/25 text-xs mb-6">This page checks automatically — no need to refresh.</p>
        <button
          onClick={cancelRequest}
          className="flex items-center gap-2 mx-auto text-white/40 hover:text-white/70 text-sm transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Cancel request & sign out
        </button>
      </div>
    </div>
  );
}
