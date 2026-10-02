import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CreditCard, CalendarCheck, ShieldCheck, Mail } from 'lucide-react';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { CONTACT_EMAIL } from '../lib/site';

// Billing (D080): the free month, then one card through Paddle. Paddle is the merchant of record, so the
// invoice, VAT and the card itself are theirs. Nothing about a card ever touches this app.
const PADDLE_JS = 'https://cdn.paddle.com/paddle/v2/paddle.js';

function loadPaddle() {
  return new Promise((resolve, reject) => {
    if (window.Paddle) return resolve(window.Paddle);
    const s = document.createElement('script');
    s.src = PADDLE_JS;
    s.async = true;
    s.onload = () => resolve(window.Paddle);
    s.onerror = () => reject(new Error('The payment page could not load. Check the connection and try again.'));
    document.head.appendChild(s);
  });
}

const PLAN_WORDS = {
  free: 'Free account',
  trial: 'Free month',
  active: 'Paying customer',
  past_due: 'Payment did not go through',
  cancelled: 'Cancelled',
  demo: 'Demo',
};

export default function BillingPage() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const [opening, setOpening] = useState(false);
  const [email, setEmail] = useState('');

  const load = () =>
    fetch('/api/billing', { credentials: 'include' })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Could not read the plan');
        setState(d);
        setEmail((e) => e || d.billingEmail || user?.email || '');
      })
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openCheckout() {
    if (!state?.checkout?.enabled) return;
    setOpening(true);
    try {
      const Paddle = await loadPaddle();
      if (!window.__paddleReady) {
        Paddle.Environment.set(state.checkout.env);
        Paddle.Initialize({
          token: state.checkout.clientToken,
          eventCallback: (ev) => {
            if (ev?.name === 'checkout.completed') {
              showToast('Thank you. The card is on file; the plan updates within a minute.', 'success');
              setTimeout(load, 4000);
            }
          },
        });
        window.__paddleReady = true;
      }
      Paddle.Checkout.open({
        items: [{ priceId: state.checkout.priceId, quantity: 1 }],
        customer: { email: email || state.checkout.email },
        customData: { org_id: state.checkout.orgId },
        settings: { displayMode: 'overlay', theme: 'light', successUrl: `${window.location.origin}/billing?paid=1` },
      });
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setOpening(false);
    }
  }

  async function saveEmail(e) {
    e.preventDefault();
    const r = await fetch('/api/billing/email', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
    const d = await r.json();
    if (!r.ok) return showToast(d.error || 'Could not save', 'error');
    showToast('Invoices go to that address.', 'success');
  }

  if (error) return <div className="p-6 text-red-700">{error}</div>;
  if (!state) return <div className="p-6 text-ink-500">Reading the plan</div>;

  const plan = state.plan;
  const days = state.daysLeft;
  const trialLine =
    plan === 'trial'
      ? days > 0
        ? `${days} day${days === 1 ? '' : 's'} of the free month left.`
        : 'The free month has ended.'
      : null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink-900">Billing</h1>
        <p className="text-ink-500 mt-1">One plan, one price, cancel any month. {state.company ? `For ${state.company}.` : ''}</p>
      </header>

      <section className="bg-white border-2 border-ink-900 p-5 space-y-3">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-blue-600" />
          <div>
            <div className="text-xs uppercase tracking-wide text-ink-500">Plan</div>
            <div className="text-lg font-semibold text-ink-900">{PLAN_WORDS[plan] || plan}</div>
          </div>
        </div>
        {trialLine ? <p className="text-ink-700">{trialLine}</p> : null}
        {state.reason ? <p className="text-red-700">{state.reason}</p> : null}
        {plan === 'free' ? <p className="text-ink-700">This account was made before billing existed. Nothing changes for you.</p> : null}
        {plan === 'active' ? <p className="text-ink-700">Thank you. Invoices arrive by email from Paddle after each payment.</p> : null}
      </section>

      {state.checkout?.enabled && state.canManage ? (
        <section className="bg-white border-2 border-ink-900 p-5 space-y-4">
          <div className="flex items-center gap-3">
            <CreditCard className="w-6 h-6 text-flare-500" />
            <div>
              <div className="text-xs uppercase tracking-wide text-ink-500">Continue after the free month</div>
              <div className="text-lg font-semibold text-ink-900">Add a card</div>
            </div>
          </div>
          <p className="text-ink-700">The price was agreed with Saaqib for your company. The card is taken by Paddle, our payment partner; the first charge comes when the free month ends, then monthly. Cancel any time from the invoice email.</p>
          <button type="button" onClick={openCheckout} disabled={opening} className="btn-flare">
            {opening ? 'Opening' : 'Continue with a card'}
          </button>
        </section>
      ) : null}

      {!state.checkout?.enabled && plan !== 'free' && plan !== 'active' && plan !== 'demo' ? (
        <section className="bg-white border-2 border-ink-900 p-5 space-y-2">
          <div className="flex items-center gap-3">
            <CalendarCheck className="w-6 h-6 text-blue-600" />
            <div className="text-lg font-semibold text-ink-900">Card payments open soon</div>
          </div>
          <p className="text-ink-700">
            Until then, write to <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and Saaqib sets the plan up with you.
          </p>
        </section>
      ) : null}

      {state.canManage && plan !== 'demo' ? (
        <section className="bg-white border-2 border-ink-900 p-5 space-y-3">
          <div className="flex items-center gap-3">
            <Mail className="w-6 h-6 text-blue-600" />
            <div className="text-lg font-semibold text-ink-900">Invoices go to</div>
          </div>
          <form onSubmit={saveEmail} className="flex flex-col sm:flex-row gap-2">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input flex-1" placeholder="accounts@yourcompany.com" />
            <button type="submit" className="btn">Save</button>
          </form>
        </section>
      ) : null}
    </motion.div>
  );
}
