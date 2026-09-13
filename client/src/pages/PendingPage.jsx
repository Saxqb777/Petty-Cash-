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
      <div className="w-full max-w-md">
        {/* Waiting carries no ink. Outline only. */}
        <div className="plate">
          <div className="flex items-center gap-3 border-b-2 border-ink-900 px-5 py-3">
            <div className="w-7 h-7 border-2 border-ink-900 flex items-center justify-center flex-shrink-0">
              <Clock className="w-4 h-4 text-ink-900" strokeWidth={2.25} />
            </div>
            <span className="tag-wait">Pending</span>
          </div>

          <div className="p-6">
            <h1 className="display w-wider text-3xl text-ink-900 mb-3">Awaiting approval</h1>
            <p className="text-sm text-ink-500 leading-relaxed mb-4">
              Your request to join{' '}
              <span className="font-mono text-ink-900">{pending?.org_name || 'the organization'}</span>{' '}
              is with the admins. Access opens as soon as one of them approves it.
            </p>

            {/* The poll, made visible. */}
            <div className="border border-paper-400 bg-paper-50 px-3 py-2.5 mb-6">
              <p className="font-mono text-2xs uppercase text-ink-500 mb-2">Checking every 12 seconds</p>
              <div className="skeleton h-1.5 w-full" />
            </div>

            <button onClick={cancelRequest} className="btn-quiet w-full">
              <LogOut className="w-4 h-4" strokeWidth={2.25} />
              Cancel request and sign out
            </button>
          </div>
        </div>

        <p className="meta text-center mt-4">No need to refresh this page.</p>
      </div>
    </div>
  );
}
