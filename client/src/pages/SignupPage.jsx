import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Leaf } from 'lucide-react';
import { useToast } from '../components/Toast';

export default function SignupPage() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1 = account info, 2 = org choice
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

  const field = (label, type, key, placeholder) => (
    <div>
      <label className="text-white/50 text-xs font-medium block mb-1.5">{label}</label>
      <input
        type={type} required value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        className="w-full bg-slate-900/60 border border-white/[0.08] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20"
        placeholder={placeholder}
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 justify-center mb-8">
          <div className="relative w-11 h-11">
            <div className="absolute inset-0 bg-brand-500 rounded-full opacity-25 blur-md" />
            <div className="relative w-11 h-11 bg-gradient-to-br from-brand-400 to-brand-600 rounded-full flex items-center justify-center">
              <Leaf className="w-[22px] h-[22px] text-white" strokeWidth={2.2} />
            </div>
          </div>
          <div>
            <p className="text-white font-bold text-[19px] font-heading lowercase">agthia</p>
            <p className="text-brand-400 text-[10px] font-semibold tracking-[0.2em] uppercase">Petty Cash</p>
          </div>
        </div>

        <div className="bg-slate-800/60 border border-white/[0.06] rounded-2xl p-6">
          {/* Step indicator */}
          <div className="flex gap-2 mb-5">
            {[1,2].map(s => (
              <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${step >= s ? 'bg-brand-500' : 'bg-white/10'}`} />
            ))}
          </div>

          {step === 1 ? (
            <>
              <h1 className="text-white text-lg font-semibold mb-5">Create account</h1>
              <form onSubmit={nextStep} className="space-y-4">
                {field('Full name', 'text', 'full_name', 'Your name')}
                {field('Email', 'email', 'email', 'you@example.com')}
                {field('Password', 'password', 'password', '8+ characters')}
                <button type="submit" className="w-full bg-brand-600 hover:bg-brand-500 text-white rounded-lg py-2.5 text-sm font-semibold transition-colors mt-1">
                  Continue →
                </button>
              </form>
            </>
          ) : (
            <>
              <h1 className="text-white text-lg font-semibold mb-1">Your organization</h1>
              <p className="text-white/40 text-xs mb-5">Create a new one or join an existing organization</p>
              <form onSubmit={submit} className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  {[['create','Create new'],['join','Join existing']].map(([val, label]) => (
                    <button key={val} type="button"
                      onClick={() => setForm(f => ({ ...f, action: val }))}
                      className={`py-2.5 rounded-lg text-sm font-medium border transition-all ${form.action === val ? 'bg-brand-600/20 border-brand-500/50 text-brand-300' : 'bg-slate-900/40 border-white/[0.06] text-white/40 hover:text-white/70'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {form.action === 'create' ? (
                  <div>
                    <label className="text-white/50 text-xs font-medium block mb-1.5">Organization name</label>
                    <input type="text" required value={form.org_name}
                      onChange={e => setForm(f => ({ ...f, org_name: e.target.value }))}
                      className="w-full bg-slate-900/60 border border-white/[0.08] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-brand-500/50"
                      placeholder="Agthia Group"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="text-white/50 text-xs font-medium block mb-1.5">Select organization</label>
                    <select value={form.org_id} onChange={e => setForm(f => ({ ...f, org_id: e.target.value }))}
                      className="w-full bg-slate-900/60 border border-white/[0.08] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-brand-500/50">
                      <option value="">Choose…</option>
                      {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                    <p className="text-white/30 text-xs mt-1.5">Your request will need admin approval before you can access the app.</p>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => setStep(1)}
                    className="flex-1 bg-slate-700/50 hover:bg-slate-700 text-white/60 rounded-lg py-2.5 text-sm font-medium transition-colors">
                    ← Back
                  </button>
                  <button type="submit" disabled={loading}
                    className="flex-1 bg-brand-600 hover:bg-brand-500 text-white rounded-lg py-2.5 text-sm font-semibold transition-colors disabled:opacity-50">
                    {loading ? 'Creating…' : form.action === 'create' ? 'Create' : 'Send request'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>

        <p className="text-white/30 text-xs text-center mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-brand-400 hover:text-brand-300">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
