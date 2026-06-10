import { useNavigate } from 'react-router-dom';
import { Clock, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

export default function PendingPage() {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const pending = user?.memberships?.find(m => m.status === 'pending');

  const cancelRequest = async () => {
    await fetch('/api/auth/cancel-request', { method: 'POST', credentials: 'include' });
    showToast('Request cancelled', 'info');
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-5">
          <Clock className="w-7 h-7 text-amber-400" />
        </div>
        <h1 className="text-white text-xl font-semibold mb-2">Awaiting approval</h1>
        <p className="text-white/40 text-sm leading-relaxed mb-6">
          Your request to join <span className="text-white/70 font-medium">{pending?.org_name || 'the organization'}</span> is pending.
          An admin will review and approve your access shortly.
        </p>
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
