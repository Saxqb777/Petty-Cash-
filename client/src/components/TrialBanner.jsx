import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

// The strip across the top once the free month is nearly over, or over (D080).
export default function TrialBanner() {
  const [state, setState] = useState(null);
  useEffect(() => {
    const load = () => fetch('/api/billing', { credentials: 'include' }).then((r) => (r.ok ? r.json() : null)).then(setState).catch(() => {});
    load();
    window.addEventListener('focus', load);
    return () => window.removeEventListener('focus', load);
  }, []);
  if (!state || state.demo) return null;
  const { plan, daysLeft, blocked, reason } = state;
  const soon = plan === 'trial' && typeof daysLeft === 'number' && daysLeft <= 7 && daysLeft > 0;
  if (!blocked && !soon && plan !== 'past_due') return null;
  const text = blocked || plan === 'past_due' ? reason : `${daysLeft} day${daysLeft === 1 ? '' : 's'} of the free month left. Add a card and nothing stops.`;
  return (
    <div className={`${blocked ? 'bg-red-700' : 'bg-ink-900'} text-paper-100 px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-1`}>
      <span className="tag-solid-flare">{blocked ? 'Paused' : 'Free month'}</span>
      <p className="text-sm flex-1 min-w-[12rem]">{text}</p>
      <Link to="/billing" className="btn-flare btn-sm">Billing</Link>
    </div>
  );
}
