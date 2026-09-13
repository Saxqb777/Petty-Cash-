import { useState, useEffect } from 'react';
import { UserX, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';

const ROLE_TAG = {
  owner:   'tag-solid-blue',
  admin:   'tag-blue',
  finance: 'tag-wait',
  member:  'tag-muted',
};

function Avatar({ name, inverted = false }) {
  return (
    <div
      className={`w-9 h-9 flex items-center justify-center text-sm font-bold flex-shrink-0 border-2 border-ink-900 ${
        inverted ? 'bg-white text-ink-900' : 'bg-ink-900 text-paper-100'
      }`}
      aria-hidden="true"
    >
      {name?.[0]?.toUpperCase() || '?'}
    </div>
  );
}

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
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="skeleton h-8 w-40 mb-6" />
      <div className="space-y-2">
        <div className="skeleton h-14 w-full" />
        <div className="skeleton h-14 w-full" />
        <div className="skeleton h-14 w-full" />
      </div>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl w-wider text-ink-900">Members</h1>
        <p className="text-sm text-ink-500 mt-1">{user?.org_name}</p>
      </div>

      {/* Pending requests */}
      {pending.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between border-b-2 border-ink-900 pb-2 mb-0">
            <p className="label mb-0">Pending requests</p>
            <p className="meta">{pending.length}</p>
          </div>
          <div>
            {pending.map(m => (
              <div key={m.id} className="border-b-2 border-ink-900 bg-white px-3 py-3 flex flex-wrap items-center gap-3">
                <Avatar name={m.full_name} inverted />
                <div className="flex-1 min-w-[8rem]">
                  <p className="text-ink-900 text-sm font-bold truncate">{m.full_name}</p>
                  <p className="meta truncate">{m.email}</p>
                </div>
                <span className="tag-wait">Pending</span>
                <div className="flex items-center gap-2 ml-auto">
                  <select
                    defaultValue="member"
                    onChange={e => approve(m.id, e.target.value)}
                    aria-label={`Approve ${m.full_name} as`}
                    className="select w-auto py-1.5 text-sm"
                  >
                    <option value="member">Approve as member</option>
                    <option value="finance">Approve as finance</option>
                    <option value="admin">Approve as admin</option>
                  </select>
                  <button
                    onClick={() => reject(m.id)}
                    aria-label={`Reject ${m.full_name}`}
                    title="Reject request"
                    className="w-9 h-9 border-2 border-paper-400 text-ink-500 flex items-center justify-center hover:border-flare-700 hover:text-flare-700 transition-colors duration-[120ms]"
                  >
                    <UserX className="w-4 h-4" strokeWidth={2} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Active members */}
      <section>
        <div className="flex items-baseline justify-between border-b-2 border-ink-900 pb-2">
          <p className="label mb-0">Active members</p>
          <p className="meta">{active.length}</p>
        </div>
        <div className="plate border-t-0">
          {active.map(m => (
            <div key={m.id} className="px-3 py-3 flex flex-wrap items-center gap-3 border-b border-paper-300 last:border-b-0 hover:bg-blue-50 transition-colors duration-[120ms]">
              <Avatar name={m.full_name} />
              <div className="flex-1 min-w-[8rem]">
                <p className="text-ink-900 text-sm font-bold truncate">
                  {m.full_name}
                  {m.user_id === user?.id && <span className="text-ink-400 text-sm font-normal ml-2">(you)</span>}
                </p>
                <p className="meta truncate">{m.email}</p>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                {m.role === 'owner' ? (
                  <span className="tag-solid-blue">Owner</span>
                ) : (
                  <select
                    value={m.role}
                    onChange={e => changeRole(m.id, e.target.value)}
                    disabled={m.user_id === user?.id}
                    aria-label={`Role for ${m.full_name}`}
                    className="select w-auto py-1.5 text-sm disabled:opacity-40"
                  >
                    <option value="member">Member</option>
                    <option value="finance">Finance</option>
                    <option value="admin">Admin</option>
                  </select>
                )}
                {m.role !== 'owner' && m.user_id !== user?.id && (
                  <button
                    onClick={() => setConfirm({ id: m.id, name: m.full_name })}
                    aria-label={`Remove ${m.full_name}`}
                    title="Remove member"
                    className="w-9 h-9 border-2 border-paper-400 text-ink-500 flex items-center justify-center hover:border-flare-700 hover:text-flare-700 transition-colors duration-[120ms]"
                  >
                    <Trash2 className="w-4 h-4" strokeWidth={2} />
                  </button>
                )}
              </div>
            </div>
          ))}
          {active.length === 0 && (
            <p className="px-3 py-6 text-sm text-ink-500">No active members yet.</p>
          )}
        </div>
      </section>

      {/* Role legend */}
      <section>
        <p className="label border-b-2 border-ink-900 pb-2 mb-0">Role permissions</p>
        <dl className="text-sm">
          {[
            ['member',  'Member',  'Upload expenses, view records'],
            ['finance', 'Finance', 'Everything a member can do, plus export Excel, manage savings, edit settings'],
            ['admin',   'Admin',   'Everything finance can do, plus approve members and manage all records'],
            ['owner',   'Owner',   'Full access, cannot be removed'],
          ].map(([key, name, desc]) => (
            <div key={key} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5 border-b border-paper-300">
              <dt className="w-24 flex-shrink-0"><span className={ROLE_TAG[key]}>{name}</span></dt>
              <dd className="text-ink-500 flex-1 min-w-[12rem]">{desc}</dd>
            </div>
          ))}
        </dl>
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
