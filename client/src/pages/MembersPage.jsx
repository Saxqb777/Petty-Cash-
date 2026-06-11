import { useState, useEffect } from 'react';
import { UserX, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';

export default function MembersPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(null);

  const load = () => {
    fetch('/api/members', { credentials: 'include' })
      .then(r => r.json())
      .then(data => { setMembers(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(load, []);

  const apiFetch = (path, method, body) =>
    fetch(path, { method, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });

  const approve = async (id, role = 'member') => {
    const r = await apiFetch(`/api/members/${id}/approve`, 'PUT', { role });
    if (r.ok) { showToast('Member approved', 'success'); load(); }
    else showToast((await r.json()).error, 'error');
  };

  const reject = async (id) => {
    const r = await apiFetch(`/api/members/${id}/reject`, 'PUT');
    if (r.ok) { showToast('Request rejected', 'success'); load(); }
    else showToast((await r.json()).error, 'error');
  };

  const changeRole = async (id, role) => {
    const r = await apiFetch(`/api/members/${id}/role`, 'PUT', { role });
    if (r.ok) { showToast('Role updated', 'success'); load(); }
    else showToast((await r.json()).error, 'error');
  };

  const remove = async (id) => {
    const r = await apiFetch(`/api/members/${id}`, 'DELETE');
    if (r.ok) { showToast('Member removed', 'success'); load(); }
    else showToast((await r.json()).error, 'error');
  };

  const pending = members.filter(m => m.status === 'pending');
  const active  = members.filter(m => m.status === 'active');

  if (loading) return (
    <div className="p-8 flex items-center gap-2 text-ink-400 text-sm">
      <div className="w-4 h-4 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      Loading…
    </div>
  );

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-ink-900 tracking-tight">Members</h1>
        <p className="text-sm text-ink-400 mt-0.5 font-medium">{user?.org_name}</p>
      </div>

      {/* Pending requests */}
      {pending.length > 0 && (
        <section>
          <p className="text-[11px] font-bold text-ink-400 uppercase tracking-widest mb-3">
            Pending requests ({pending.length})
          </p>
          <div className="space-y-2">
            {pending.map(m => (
              <div key={m.id} className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700 text-xs font-bold flex-shrink-0">
                  {m.full_name?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-ink-800 text-sm font-semibold truncate">{m.full_name}</p>
                  <p className="text-ink-400 text-xs truncate">{m.email}</p>
                </div>
                <select
                  defaultValue="member"
                  onChange={e => approve(m.id, e.target.value)}
                  className="input text-xs py-1.5 w-auto cursor-pointer"
                >
                  <option value="member">Approve as Member</option>
                  <option value="finance">Approve as Finance</option>
                  <option value="admin">Approve as Admin</option>
                </select>
                <button onClick={() => reject(m.id)} className="text-ink-300 hover:text-red-500 transition-colors p-1">
                  <UserX className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Active members */}
      <section>
        <p className="text-[11px] font-bold text-ink-400 uppercase tracking-widest mb-3">
          Active members ({active.length})
        </p>
        <div className="card overflow-hidden divide-y divide-paper-300">
          {active.map(m => (
            <div key={m.id} className="px-4 py-3 flex items-center gap-3 hover:bg-paper-100 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center text-brand-700 text-xs font-bold flex-shrink-0">
                {m.full_name?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-ink-800 text-sm font-semibold truncate">
                  {m.full_name}
                  {m.user_id === user?.id && <span className="text-ink-400 text-xs font-normal ml-2">(you)</span>}
                </p>
                <p className="text-ink-400 text-xs truncate">{m.email}</p>
              </div>
              {m.role === 'owner' ? (
                <span className="text-brand-700 text-xs font-semibold px-2 py-1 bg-brand-100 rounded">Owner</span>
              ) : (
                <select
                  value={m.role}
                  onChange={e => changeRole(m.id, e.target.value)}
                  disabled={m.user_id === user?.id}
                  className="input text-xs py-1.5 w-auto cursor-pointer disabled:opacity-40"
                >
                  <option value="member">Member</option>
                  <option value="finance">Finance</option>
                  <option value="admin">Admin</option>
                </select>
              )}
              {m.role !== 'owner' && m.user_id !== user?.id && (
                <button
                  onClick={() => setConfirm({ id: m.id, name: m.full_name })}
                  className="text-ink-300 hover:text-red-500 transition-colors p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Role legend */}
      <section className="card p-4 text-xs text-ink-500 space-y-1.5">
        <p className="text-ink-700 font-semibold mb-2">Role permissions</p>
        <p><span className="text-ink-800 font-medium">Member</span> — upload expenses, view records</p>
        <p><span className="text-blue-600 font-medium">Finance</span> — + export Excel, manage savings, edit settings</p>
        <p><span className="text-purple-600 font-medium">Admin</span> — + approve members, manage all records</p>
        <p><span className="text-brand-600 font-medium">Owner</span> — full access, cannot be removed</p>
      </section>

      <ConfirmDialog
        open={!!confirm}
        title="Remove member"
        message={`Remove ${confirm?.name} from the organization? They will lose all access.`}
        confirmLabel="Remove"
        onConfirm={() => { remove(confirm.id); setConfirm(null); }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
