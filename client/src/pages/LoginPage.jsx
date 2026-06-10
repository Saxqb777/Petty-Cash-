import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Leaf } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

export default function LoginPage() {
  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await login(form.email, form.password);
      if (data.membership?.status === 'pending') {
        navigate('/pending');
      } else {
        navigate('/');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 justify-center mb-8">
          <div className="relative w-11 h-11">
            <div className="absolute inset-0 bg-brand-500 rounded-full opacity-25 blur-md" />
            <div className="relative w-11 h-11 bg-gradient-to-br from-brand-400 to-brand-600 rounded-full flex items-center justify-center shadow-glow-sm ring-1 ring-white/10">
              <Leaf className="w-[22px] h-[22px] text-white" strokeWidth={2.2} />
            </div>
          </div>
          <div>
            <p className="text-white font-bold text-[19px] font-heading tracking-tight lowercase">agthia</p>
            <p className="text-brand-400 text-[10px] font-semibold tracking-[0.2em] uppercase">Petty Cash</p>
          </div>
        </div>

        <div className="bg-slate-800/60 border border-white/[0.06] rounded-2xl p-6">
          <h1 className="text-white text-lg font-semibold mb-5">Sign in</h1>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-white/50 text-xs font-medium block mb-1.5">Email</label>
              <input
                type="email" required
                value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full bg-slate-900/60 border border-white/[0.08] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="text-white/50 text-xs font-medium block mb-1.5">Password</label>
              <input
                type="password" required
                value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className="w-full bg-slate-900/60 border border-white/[0.08] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit" disabled={loading}
              className="w-full bg-brand-600 hover:bg-brand-500 text-white rounded-lg py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 mt-1"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-white/30 text-xs text-center mt-4">
          No account?{' '}
          <Link to="/signup" className="text-brand-400 hover:text-brand-300">Create one</Link>
        </p>
      </div>
    </div>
  );
}
