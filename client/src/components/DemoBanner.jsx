import { useEffect, useState } from 'react';
import { SITE_URL } from '../lib/site';

// The strip across the top of the demo: whose sample company this is, how many
// reads are left, and the way into a real account.
export default function DemoBanner() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    const load = () => fetch('/api/demo/status', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(setStatus)
      .catch(() => {});
    load();
    window.addEventListener('focus', load);
    return () => window.removeEventListener('focus', load);
  }, []);

  return (
    <div className="bg-ink-900 text-paper-100 px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-1">
      <span className="tag-solid-flare">Demo</span>
      <p className="text-sm flex-1 min-w-[12rem]">
        {status?.company ? `${status.company}: a sample company with made up paperwork.` : 'A sample company with made up paperwork.'}
        {typeof status?.readsLeft === 'number' ? ` Read ${status.readsLeft} more document${status.readsLeft === 1 ? '' : 's'} of your own on Upload.` : ''}
      </p>
      <a href={`${SITE_URL}/signup${status?.code ? `?for=${status.code}` : ''}`} className="btn-flare btn-sm">Start your free month</a>
    </div>
  );
}
