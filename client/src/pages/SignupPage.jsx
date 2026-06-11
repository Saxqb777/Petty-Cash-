import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useToast } from '../components/Toast';

export default function SignupPage() {
  const { showToast } = useToast();
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
      if (data.status === 'pending') navigate('/pending');
      else navigate('/');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="flex items-center gap-3 justify-center mb-8">
          <div className="w-10 h-10 bg-brand-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white text-base font-bold font-heading tracking-tight">DL</span>
          </div>
          <div>
            <p className="text-ink-900 font-heading font-bold text-xl leading-tight tracking-tight">Doc Ledger</p>
            <p className="text-ink-400 text-[10px] font-medium tracking-widest uppercase">Expense Management</p>
          </div>
        </div>

        <div className="bg-white border border-paper-400 rounded-lg shadow-card p-6">
          {/* Step bar */}
          <div className="flex gap-1.5 mb-5">
            {[1, 2].map(s => (
              <div key={s} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${step >= s ? 'bg-brand-500' : 'bg-paper-400'}`} />
            ))}
          </div>

          {step === 1 ? (
            <>
              <h1 className="text-ink-900 text-lg font-semibold mb-5">Create account</h1>
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
                  Continue →
                </button>
              </form>
            </>
          ) : (
            <>
              <h1 className="text-ink-900 text-lg font-semibold mb-1">Your organization</h1>
              <p className="text-ink-400 text-xs mb-5">Create a new one or join an existing organization</p>
              <form onSubmit={submit} className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  {[['create', 'Create new'], ['join', 'Join existing']].map(([val, label]) => (
                    <button key={val} type="button"
                      onClick={() => setForm(f => ({ ...f, action: val }))}
                      className={`py-2.5 rounded-lg text-[13px] font-medium border transition-all ${
                        form.action === val
                          ? 'bg-brand-50 border-brand-300 text-brand-700'
                          : 'bg-white border-paper-400 text-ink-500 hover:text-ink-800 hover:bg-paper-100'
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
                      className="input">
                      <option value="">Choose…</option>
                      {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                    <p className="text-ink-400 text-xs mt-1.5">Your request will need admin approval before you can access the app.</p>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => setStep(1)}
                    className="btn-secondary flex-1">
                    ← Back
                  </button>
                  <button type="submit" disabled={loading}
                    className="btn-primary flex-1 disabled:opacity-50">
                    {loading ? 'Creating…' : form.action === 'create' ? 'Create' : 'Send request'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>

        <p className="text-ink-400 text-xs text-center mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-brand-600 hover:text-brand-700 font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
