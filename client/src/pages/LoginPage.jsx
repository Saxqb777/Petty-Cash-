import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
    <div className="min-h-screen bg-paper-100 lg:grid lg:grid-cols-2">
      {/* ── The blue plate ─────────────────────────────────────────────── */}
      <section className="relative bg-blue-600 border-b-2 border-ink-900 lg:border-b-0 lg:border-r-2 px-5 py-6 sm:px-8 lg:px-12 lg:py-12 flex flex-col justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-flare-500 flex items-center justify-center flex-shrink-0">
            <span className="text-ink-900 text-base font-extrabold w-wide">DL</span>
          </div>
          <div>
            <p className="text-white font-extrabold text-xl w-wide leading-none">Doc Ledger</p>
            <p className="font-mono text-2xs uppercase text-blue-200 mt-1">Expense Management</p>
          </div>
        </div>

        {/* Two plates, one overprint. */}
        <div className="hidden lg:block relative h-60 w-full max-w-xs my-10" aria-hidden="true">
          <div className="absolute left-0 top-0 w-44 h-40 bg-white border-2 border-ink-900 p-3">
            <p className="font-mono text-2xs uppercase text-ink-500">Receipt 0417</p>
            <div className="mt-3 space-y-2">
              <div className="h-1.5 w-full bg-paper-300" />
              <div className="h-1.5 w-3/4 bg-paper-300" />
              <div className="h-1.5 w-1/2 bg-paper-300" />
            </div>
            <p className="mt-4 font-mono text-sm text-ink-900">AED 1,240.00</p>
          </div>
          <div className="overprint absolute left-24 top-16 w-44 h-40 bg-flare-500 border-2 border-ink-900 p-3">
            <p className="font-mono text-2xs uppercase text-ink-900">Filed</p>
          </div>
          <div className="overprint absolute left-6 top-52 w-32 h-2 bg-green-500" />
        </div>

        <div>
          <p className="text-white text-lg leading-snug max-w-sm">
            Photograph a receipt. Every field files itself, and the month closes on time.
          </p>
          <p className="font-mono text-2xs uppercase text-blue-200 mt-4">
            Capture / Extract / Reconcile / Export
          </p>
        </div>
      </section>

      {/* ── The form on paper ──────────────────────────────────────────── */}
      <section className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <p className="label">Account access</p>
          <h1 className="display w-wider text-3xl text-ink-900 mb-6">Sign in</h1>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                type="email" required
                value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="input"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                type="password" required
                value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className="input"
                placeholder="••••••••"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full mt-1">
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="border-t border-paper-400 mt-8 pt-4">
            <p className="text-sm text-ink-500">
              No account?{' '}
              <Link to="/signup" className="text-blue-600 font-bold underline underline-offset-2 hover:text-blue-700">
                Create one
              </Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
