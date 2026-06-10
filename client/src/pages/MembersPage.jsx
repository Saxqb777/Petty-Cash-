import { useState, useEffect } from 'react';
import { UserCheck, UserX, Shield, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';

const ROLE_LABELS = { owner: 'Owner', admin: 'Admin', finance: 'Finance', member: 'Member' };
const ROLE_COLORS = { owner: 'text-brand-400', admin: 'text-purple-400', finance: 'text-blue-400', member: 'text-white/50' };

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

  const api = (path, method, body) =>
    fetch(path, { method, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });

  const approve = async (id, role = 'member') => {
    const r = await api(`/api/members/${id}/approve`, 'PUT', { role });
    if (r.ok) { showToast('Member approved', 'success'); load(); }
    else showToast((await r.json()).error, 'error');
  };

  const reject = async (id) => {
    const r = await api(`/api/members/${id}/reject`, 'PUT');
    if (r.ok) { showToast('Request rejected', 'success'); load(); }
    else showToast((await r.json()).error, 'error');
  };

  const changeRole = async (id, role) => {
    const r = await api(`/api/members/${id}/role`, 'PUT', { role });
    if (r.ok) { showToast('Role updated', 'success'); load(); }
    else showToast((await r.json()).error, 'error');
  };

  const remove = async (id) => {
    const r = await api(`/api/members/${id}`, 'DELETE');
    if (r.ok) { showToast('Member removed', 'success'); load(); }
    else showToast((await r.json()).error, 'error');
  };

  const pending = members.filter(m => m.status === 'pending');
  const active  = members.filter(m => m.status === 'active');

  if (loading) return <div className="p-8 text-white/40 text-sm">Loading…</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-white text-xl font-semibold">Members</h1>
        <p className="text-white/40 text-sm mt-1">{user?.org_name}</p>
      </div>

      {/* Pending requests */}
      {pending.length > 0 && (
        <section>
          <h2 className="text-white/60 text-xs font-bold uppercase tracking-[0.15em] mb-3">
            Pending requests ({pending.length})
          </h2>
          <div className="space-y-2">
            {pending.map(m => (
              <div key={m.id} className="bg-slate-800/60 border border-amber-500/20 rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400 text-xs font-bold">
                  {m.full_name?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{m.full_name}</p>
                  <p className="text-white/40 text-xs truncate">{m.email}</p>
                </div>
                <select
                  defaultValue="member"
                  onChange={e => approve(m.id, e.target.value)}
                  className="bg-brand-600/20 border border-brand-500/30 text-brand-300 text-xs rounded-lg px-2 py-1.5 cursor-pointer"
                >
                  <option value="member">Approve as Member</option>
                  <option value="finance">Approve as Finance</option>
                  <option value="admin">Approve as Admin</option>
                </select>
                <button onClick={() => reject(m.id)} className="text-white/30 hover:text-red-400 transition-colors p-1">
                  <UserX className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Active members */}
      <section>
        <h2 className="text-white/60 text-xs font-bold uppercase tracking-[0.15em] mb-3">
          Active members ({active.length})
        </h2>
        <div className="space-y-2">
          {active.map(m => (
            <div key={m.id} className="bg-slate-800/60 border border-white/[0.06] rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-brand-500/10 flex items-center justify-center text-brand-400 text-xs font-bold">
                {m.full_name?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{m.full_name}
                  {m.user_id === user?.id && <span className="text-white/30 text-xs ml-2">(you)</span>}
                </p>
                <p className="text-white/40 text-xs truncate">{m.email}</p>
              </div>
              {m.role === 'owner' ? (
                <span className="text-brand-400 text-xs font-semibold px-2 py-1 bg-brand-500/10 rounded-lg">Owner</span>
              ) : (
                <select
                  value={m.role}
                  onChange={e => changeRole(m.id, e.target.value)}
                  disabled={m.user_id === user?.id}
                  className="bg-slate-900/60 border border-white/[0.08] text-white/70 text-xs rounded-lg px-2 py-1.5 disabled:opacity-40"
                >
                  <option value="member">Member</option>
                  <option value="finance">Finance</option>
                  <option value="admin">Admin</option>
                </select>
              )}
              {m.role !== 'owner' && m.user_id !== user?.id && (
                <button
                  onClick={() => setConfirm({ id: m.id, name: m.full_name })}
                  className="text-white/20 hover:text-red-400 transition-colors p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Role legend */}
      <section className="bg-slate-800/30 border border-white/[0.04] rounded-xl p-4 text-xs text-white/40 space-y-1">
        <p className="text-white/60 font-medium mb-2">Role permissions</p>
        <p><span className="text-white/60">Member</span> — upload expenses, view records</p>
        <p><span className="text-blue-400">Finance</span> — + export Excel, manage savings, edit settings</p>
        <p><span className="text-purple-400">Admin</span> — + approve members, manage all records</p>
        <p><span className="text-brand-400">Owner</span> — full access, cannot be removed</p>
      </section>

      <ConfirmDialog
        open={!!confirm}
        title="Remove member"
        message={`Remove ${confirm?.name} from the organization? They will lose all access.`}
        variant="danger"
        onConfirm={() => { remove(confirm.id); setConfirm(null); }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
