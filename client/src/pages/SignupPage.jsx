import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';

export default function SignupPage() {
  const { showToast } = useToast();
  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [orgs, setOrgs] = useState([]);
  const [form, setForm] = useState({ full_name: '', email: '', password: '', action: 'create', org_name: '', org_id: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/auth/orgs').then(r => r.json()).then(setOrgs).catch(() => {});
  }, []);

  const nextStep = (e) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.email.trim() || form.password.length < 8) {
      showToast('Please fill all fields. Password must be at least 8 characters.', 'error');
      return;
    }
    setStep(2);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (form.action === 'create' && !form.org_name.trim()) {
      showToast('Please enter an organization name', 'error'); return;
    }
    if (form.action === 'join' && !form.org_id) {
      showToast('Please select an organization to join', 'error'); return;
    }
    setLoading(true);
    try {
      const r = await fetch('/api/auth/signup', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: form.full_name, email: form.email, password: form.password,
          action: form.action,
          org_name: form.action === 'create' ? form.org_name : undefined,
          org_id: form.action === 'join' ? parseInt(form.org_id) : undefined,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      await refreshUser();
      if (data.status === 'pending') navigate('/pending');
      else navigate('/');
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
            <p className="font-mono text-2xs uppercase text-ink-500">Org 001</p>
            <div className="mt-3 space-y-2">
              <div className="h-1.5 w-full bg-paper-300" />
              <div className="h-1.5 w-3/4 bg-paper-300" />
              <div className="h-1.5 w-2/3 bg-paper-300" />
            </div>
            <p className="mt-4 font-mono text-sm text-ink-900">4 members</p>
          </div>
          <div className="overprint absolute left-24 top-16 w-44 h-40 bg-flare-500 border-2 border-ink-900 p-3">
            <p className="font-mono text-2xs uppercase text-ink-900">You</p>
          </div>
          <div className="overprint absolute left-6 top-52 w-32 h-2 bg-green-500" />
        </div>

        <div>
          <p className="text-white text-lg leading-snug max-w-sm">
            One ledger for the whole team. Start an organization, or ask to join the one you belong to.
          </p>
          <p className="font-mono text-2xs uppercase text-blue-200 mt-4">
            Capture / Extract / Reconcile / Export
          </p>
        </div>
      </section>

      {/* ── The form on paper ──────────────────────────────────────────── */}
      <section className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          {/* Step bar: two rectangles, no pill */}
          <div className="flex gap-1.5 mb-6">
            {[1, 2].map(s => (
              <div key={s} className={`h-1.5 flex-1 transition-colors duration-[120ms] ${step >= s ? 'bg-blue-600' : 'bg-paper-400'}`} />
            ))}
          </div>

          {step === 1 ? (
            <>
              <p className="label">Step 01 of 02</p>
              <h1 className="display w-wider text-3xl text-ink-900 mb-6">Create account</h1>
              <form onSubmit={nextStep} className="space-y-4">
                <div>
                  <label className="label">Full name</label>
                  <input type="text" required value={form.full_name}
                    onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                    className="input" placeholder="Your name" />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input type="email" required value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="input" placeholder="you@example.com" />
                </div>
                <div>
                  <label className="label">Password</label>
                  <input type="password" required value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    className="input" placeholder="8+ characters" />
                </div>
                <button type="submit" className="btn-primary w-full mt-1">
                  Continue
                </button>
              </form>
            </>
          ) : (
            <>
              <p className="label">Step 02 of 02</p>
              <h1 className="display w-wider text-3xl text-ink-900 mb-2">Your organization</h1>
              <p className="text-sm text-ink-500 mb-6">Create a new one or join an existing organization.</p>
              <form onSubmit={submit} className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  {[['create', 'Create new'], ['join', 'Join existing']].map(([val, label]) => (
                    <button key={val} type="button"
                      onClick={() => setForm(f => ({ ...f, action: val }))}
                      aria-pressed={form.action === val}
                      className={`py-2.5 text-sm font-bold border-2 transition-colors duration-[120ms] ${
                        form.action === val
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-white border-paper-400 text-ink-600 hover:border-ink-900 hover:text-ink-900'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {form.action === 'create' ? (
                  <div>
                    <label className="label">Organization name</label>
                    <input type="text" required value={form.org_name}
                      onChange={e => setForm(f => ({ ...f, org_name: e.target.value }))}
                      className="input" placeholder="Acme Corp" />
                  </div>
                ) : (
                  <div>
                    <label className="label">Select organization</label>
                    <select value={form.org_id}
                      onChange={e => setForm(f => ({ ...f, org_id: e.target.value }))}
                      className="select">
                      <option value="">Choose…</option>
                      {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                    <p className="text-sm text-ink-500 mt-2">
                      Your request needs admin approval before you can access the app.
                    </p>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => setStep(1)} className="btn-ghost flex-1">
                    Back
                  </button>
                  <button type="submit" disabled={loading} className="btn-primary flex-1">
                    {loading ? 'Creating…' : form.action === 'create' ? 'Create' : 'Send request'}
                  </button>
                </div>
              </form>
            </>
          )}

          <div className="border-t border-paper-400 mt-8 pt-4">
            <p className="text-sm text-ink-500">
              Already have an account?{' '}
              <Link to="/login" className="text-blue-600 font-bold underline underline-offset-2 hover:text-blue-700">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
