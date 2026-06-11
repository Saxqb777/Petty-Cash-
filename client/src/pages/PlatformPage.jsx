import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Building2, Users, FileText, Activity, Trash2, Edit2, X,
  ChevronDown, ChevronUp, Clock, ShieldAlert
} from 'lucide-react';
import { api } from '../utils/api';
import { useToast } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';

const fmt = (n) => new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
const fmtInt = (n) => new Intl.NumberFormat('en-AE').format(n || 0);
const fmtDateTime = (iso) => iso ? new Date(iso).toLocaleString('en-AE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

function StatTile({ icon: Icon, label, value, color = 'brand' }) {
  const colors = {
    brand:  'bg-brand-50 text-brand-600 border-l-brand-500',
    blue:   'bg-blue-50 text-blue-600 border-l-blue-500',
    violet: 'bg-violet-50 text-violet-600 border-l-violet-500',
    amber:  'bg-amber-50 text-amber-600 border-l-amber-500',
  };
  const [bg, fg, border] = (colors[color] || colors.brand).split(' ');
  return (
    <div className={`card p-4 border-l-[3px] ${border}`}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-400">{label}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${bg} ${fg}`}>
          <Icon className="w-[17px] h-[17px]" />
        </div>
      </div>
      <p className="text-[1.45rem] font-bold tracking-tight leading-none font-mono tabular-nums text-ink-900">{value}</p>
    </div>
  );
}

function EditOrgModal({ org, onClose, onSave }) {
  const [name, setName] = useState(org.name);
  const [color, setColor] = useState(org.accent_color || '#62833A');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await onSave({ name: name.trim(), accent_color: color });
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-ink-900/20 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-modal border border-paper-400 w-full max-w-md p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-ink-900">Edit organization</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-paper-200 flex items-center justify-center text-ink-500">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">Accent color</label>
            <div className="flex items-center gap-2">
              <input
                type="color" value={color} onChange={e => setColor(e.target.value)}
                className="w-10 h-10 rounded-lg border border-paper-400 cursor-pointer"
              />
              <input className="input flex-1 font-mono" value={color} onChange={e => setColor(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={submit} disabled={saving || !name.trim()} className="btn-primary flex-1">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

const ROLE_COLOR = {
  owner:   'bg-brand-100 text-brand-700',
  admin:   'bg-purple-100 text-purple-700',
  finance: 'bg-blue-100 text-blue-700',
  member:  'bg-paper-300 text-ink-600',
};

const STATUS_COLOR = {
  active:   'bg-emerald-100 text-emerald-700',
  pending:  'bg-amber-100 text-amber-700',
  rejected: 'bg-red-100 text-red-700',
};

function OrgRow({ org, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState(null);

  const toggle = async () => {
    if (!expanded && !detail) {
      try { setDetail(await api.getPlatformOrg(org.id)); }
      catch (_) { setDetail({ members: [] }); }
    }
    setExpanded(e => !e);
  };

  return (
    <>
      <tr className="hover:bg-paper-100 transition-colors cursor-pointer" onClick={toggle}>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-xs font-bold font-heading"
              style={{ backgroundColor: org.accent_color || '#62833A' }}>
              {org.name?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink-900 truncate">{org.name}</p>
              <p className="text-[11px] text-ink-400 font-mono truncate">/{org.slug}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-ink-600 font-mono tabular-nums">{fmtInt(org.member_count)}</td>
        <td className="px-4 py-3 text-sm">
          {org.pending_count > 0
            ? <span className="badge-amber">{org.pending_count}</span>
            : <span className="text-ink-300">—</span>}
        </td>
        <td className="px-4 py-3 text-sm text-ink-600 font-mono tabular-nums">{fmtInt(org.expense_count)}</td>
        <td className="px-4 py-3 text-sm text-ink-900 font-mono tabular-nums font-semibold text-right">AED {fmt(org.total_spend)}</td>
        <td className="px-4 py-3 text-xs text-ink-500 whitespace-nowrap">{fmtDate(org.last_activity)}</td>
        <td className="px-4 py-3 text-xs text-ink-500 whitespace-nowrap">{fmtDate(org.created_at)}</td>
        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-1 justify-end">
            <button onClick={() => onEdit(org)}
              className="w-7 h-7 rounded-lg hover:bg-brand-50 flex items-center justify-center text-ink-400 hover:text-brand-600">
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onDelete(org)}
              className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-ink-400 hover:text-red-500">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            {expanded ? <ChevronUp className="w-3.5 h-3.5 text-ink-400" /> : <ChevronDown className="w-3.5 h-3.5 text-ink-400" />}
          </div>
        </td>
      </tr>

      {expanded && (
        <tr className="bg-paper-100">
          <td colSpan={8} className="px-6 py-4">
            {!detail ? (
              <div className="flex items-center gap-2 text-ink-400 text-xs">
                <div className="w-3 h-3 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
                Loading members…
              </div>
            ) : detail.members?.length === 0 ? (
              <p className="text-xs text-ink-400">No members in this organization yet.</p>
            ) : (
              <div>
                <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-widest mb-2">
                  Members ({detail.members.length})
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {detail.members.map(m => (
                    <div key={m.id} className="flex items-center gap-2.5 bg-white border border-paper-400 rounded-lg px-3 py-2">
                      <div className="w-7 h-7 rounded-lg bg-brand-100 text-brand-700 text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                        {m.full_name?.[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-ink-800 truncate">{m.full_name}</p>
                        <p className="text-[10px] text-ink-400 truncate">{m.email}</p>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${ROLE_COLOR[m.role] || 'bg-paper-300 text-ink-600'}`}>
                        {m.role}
                      </span>
                      {m.status !== 'active' && (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${STATUS_COLOR[m.status]}`}>
                          {m.status}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export default function PlatformPage() {
  const toast = useToast();
  const [overview, setOverview] = useState(null);
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [ov, list] = await Promise.all([api.getPlatformOverview(), api.getPlatformOrgs()]);
      setOverview(ov);
      setOrgs(list);
    } catch (e) {
      toast.error(e.message);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (data) => {
    try {
      await api.updatePlatformOrg(edit.id, data);
      toast.success('Organization updated');
      load();
    } catch (e) { toast.error(e.message); throw e; }
  };

  const handleDelete = async () => {
    try {
      await api.deletePlatformOrg(confirm.id);
      toast.success(`Deleted ${confirm.name}`);
      load();
    } catch (e) { toast.error(e.message); }
    finally { setConfirm(null); }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
        className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-heading font-bold text-ink-900 tracking-tight flex items-center gap-2">
            Platform
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-violet-100 border border-violet-200 rounded text-violet-700 text-[10px] font-semibold uppercase tracking-widest">
              <ShieldAlert className="w-3 h-3" /> Owner
            </span>
          </h1>
          <p className="text-sm text-ink-400 mt-0.5 font-medium">Manage all organizations on Doc Ledger</p>
        </div>
      </motion.div>

      {/* Overview */}
      {loading || !overview ? (
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[0, 1, 2, 3].map(i => <div key={i} className="skeleton h-24" />)}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <StatTile icon={Building2} label="Organizations" value={fmtInt(overview.orgCount)}    color="brand" />
          <StatTile icon={Users}     label="Total Users"   value={fmtInt(overview.userCount)}   color="blue" />
          <StatTile icon={FileText}  label="Expenses"      value={fmtInt(overview.expenseCount)} color="violet" />
          <StatTile icon={Activity}  label="Active Sessions" value={fmtInt(overview.activeSessions)} color="amber" />
        </div>
      )}

      {/* Cross-platform summary strip */}
      {overview && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="card p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-brand-100 flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4 text-brand-600" />
            </div>
            <div>
              <p className="text-xs text-ink-400 font-medium">Total spend across all orgs</p>
              <p className="text-base font-bold text-ink-900 font-mono tabular-nums">AED {fmt(overview.totalSpend)}</p>
            </div>
          </div>
          <div className="card p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-ink-400 font-medium">Pending join requests</p>
              <p className="text-base font-bold text-ink-900 font-mono tabular-nums">{fmtInt(overview.pendingJoins)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Orgs table */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-paper-400">
          <div>
            <h2 className="text-[15px] font-heading font-bold text-ink-800">Organizations</h2>
            <p className="text-xs text-ink-400 mt-0.5">Click a row to expand members</p>
          </div>
          <p className="text-xs text-ink-400 font-mono">{orgs.length} {orgs.length === 1 ? 'org' : 'orgs'}</p>
        </div>

        {loading ? (
          <div className="p-8 text-center text-ink-400 text-sm">
            <div className="w-5 h-5 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto mb-2" />
            Loading organizations…
          </div>
        ) : orgs.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="w-10 h-10 text-paper-500 mx-auto mb-3" />
            <p className="text-ink-500 font-medium">No organizations yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-paper-100 border-b border-paper-400">
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-ink-400 uppercase tracking-wide">Organization</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-ink-400 uppercase tracking-wide">Members</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-ink-400 uppercase tracking-wide">Pending</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-ink-400 uppercase tracking-wide">Expenses</th>
                  <th className="text-right px-4 py-3 text-[10px] font-semibold text-ink-400 uppercase tracking-wide">Total Spend</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-ink-400 uppercase tracking-wide">Last Activity</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-ink-400 uppercase tracking-wide">Created</th>
                  <th className="px-4 py-3 w-28" />
                </tr>
              </thead>
              <tbody className="divide-y divide-paper-300">
                {orgs.map(org => (
                  <OrgRow key={org.id} org={org} onEdit={setEdit} onDelete={setConfirm} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {edit && <EditOrgModal org={edit} onClose={() => setEdit(null)} onSave={handleSave} />}

      <ConfirmDialog
        open={!!confirm}
        title="Delete organization"
        message={`Permanently delete "${confirm?.name}"? All expenses, settings, members, and expense types for this org will be wiped. This cannot be undone.`}
        confirmLabel="Delete forever"
        onConfirm={handleDelete}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
