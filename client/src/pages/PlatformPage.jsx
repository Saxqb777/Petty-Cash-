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
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' }) : '--';

function StatTile({ icon: Icon, label, value, accent = 'ink' }) {
  const rule = {
    ink:   'border-l-ink-900',
    blue:  'border-l-blue-600',
    flare: 'border-l-flare-500',
    green: 'border-l-green-500',
  }[accent] || 'border-l-ink-900';

  return (
    <div className={`plate border-l-8 ${rule} p-4`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <p className="label mb-0">{label}</p>
        <Icon className="w-4 h-4 text-ink-500 flex-shrink-0" strokeWidth={2} />
      </div>
      {/* Fragment Mono is single weight: size carries the emphasis, never bold. */}
      <p className="font-mono tabular-nums text-2xl leading-none text-ink-900">{value}</p>
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
    <div className="fixed inset-0 bg-ink-900/40 flex items-center justify-center z-50 p-4">
      <div className="plate w-full max-w-md p-5 animate-rise">
        <div className="flex items-center justify-between gap-3 border-b-2 border-ink-900 pb-3 mb-5">
          <h3 className="text-lg w-wide text-ink-900">Edit organization</h3>
          <button onClick={onClose} aria-label="Close"
            className="w-8 h-8 border-2 border-ink-900 flex items-center justify-center text-ink-900 hover:bg-paper-100 transition-colors duration-[120ms] flex-shrink-0">
            <X className="w-4 h-4" strokeWidth={2.5} />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label htmlFor="org-name" className="block text-sm font-bold text-ink-700 mb-1.5">Name</label>
            <input id="org-name" className="input" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label htmlFor="org-color" className="block text-sm font-bold text-ink-700 mb-1.5">Accent colour</label>
            <div className="flex items-center gap-2">
              <input
                id="org-color"
                type="color" value={color} onChange={e => setColor(e.target.value)}
                className="w-11 h-11 border-2 border-ink-900 cursor-pointer bg-white p-0"
              />
              <input className="input flex-1 font-mono" aria-label="Accent colour hex" value={color} onChange={e => setColor(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-ghost flex-1">Cancel</button>
          <button onClick={submit} disabled={saving || !name.trim()} className="btn-primary flex-1">
            {saving ? <><span className="w-2.5 h-2.5 bg-current animate-pulse" /> Saving</> : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

const ROLE_TAG = {
  owner:   'tag-solid-blue',
  admin:   'tag-blue',
  finance: 'tag-wait',
  member:  'tag-muted',
};

const STATUS_TAG = {
  active:   'tag-green',
  pending:  'tag-wait',
  rejected: 'tag-flare',
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
      <tr className="cursor-pointer" onClick={toggle}>
        <td>
          <div className="flex items-center gap-2.5">
            {/* Tenant-chosen colour, rendered as a hard square */}
            <div className="w-8 h-8 border-2 border-ink-900 flex-shrink-0"
              style={{ backgroundColor: org.accent_color || '#62833A' }}
              aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-ink-900 truncate">{org.name}</p>
              <p className="meta truncate">/{org.slug}</p>
            </div>
          </div>
        </td>
        <td className="font-mono tabular-nums text-ink-700">{fmtInt(org.member_count)}</td>
        <td>
          {org.pending_count > 0
            ? <span className="tag-flare">{org.pending_count}</span>
            : <span className="font-mono text-ink-400">--</span>}
        </td>
        <td className="font-mono tabular-nums text-ink-700">{fmtInt(org.expense_count)}</td>
        <td className="amount text-ink-900">AED {fmt(org.total_spend)}</td>
        <td className="font-mono text-xs text-ink-500 whitespace-nowrap">{fmtDate(org.last_activity)}</td>
        <td className="font-mono text-xs text-ink-500 whitespace-nowrap">{fmtDate(org.created_at)}</td>
        <td onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-1.5 justify-end">
            <button onClick={() => onEdit(org)} aria-label={`Edit ${org.name}`} title="Edit"
              className="w-8 h-8 border-2 border-paper-400 text-ink-500 flex items-center justify-center hover:border-ink-900 hover:text-ink-900 transition-colors duration-[120ms]">
              <Edit2 className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
            <button onClick={() => onDelete(org)} aria-label={`Delete ${org.name}`} title="Delete"
              className="w-8 h-8 border-2 border-paper-400 text-ink-500 flex items-center justify-center hover:border-flare-700 hover:text-flare-700 transition-colors duration-[120ms]">
              <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
            {expanded
              ? <ChevronUp className="w-4 h-4 text-ink-500" strokeWidth={2.5} />
              : <ChevronDown className="w-4 h-4 text-ink-500" strokeWidth={2.5} />}
          </div>
        </td>
      </tr>

      {expanded && (
        <tr className="bg-paper-100">
          <td colSpan={8} className="px-4 py-4">
            {!detail ? (
              <div className="space-y-2">
                <div className="skeleton h-10 w-full" />
                <div className="skeleton h-10 w-2/3" />
              </div>
            ) : detail.members?.length === 0 ? (
              <p className="text-sm text-ink-500">No members in this organization yet.</p>
            ) : (
              <div>
                <p className="label">Members ({detail.members.length})</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {detail.members.map(m => (
                    <div key={m.id} className="flex items-center gap-2.5 bg-white border border-paper-400 px-3 py-2">
                      <div className="w-7 h-7 bg-ink-900 text-paper-100 text-xs font-bold flex items-center justify-center flex-shrink-0" aria-hidden="true">
                        {m.full_name?.[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-ink-900 truncate">{m.full_name}</p>
                        <p className="meta truncate">{m.email}</p>
                      </div>
                      <span className={ROLE_TAG[m.role] || 'tag-muted'}>{m.role}</span>
                      {m.status !== 'active' && (
                        <span className={STATUS_TAG[m.status] || 'tag-muted'}>{m.status}</span>
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
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Platform console carries a flare rule: this screen sits above every org. */}
      <div className="h-1.5 bg-flare-500 mb-5" aria-hidden="true" />

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.12, ease: 'easeOut' }}
        className="flex flex-wrap items-end justify-between gap-4 mb-7">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl w-wider text-ink-900">Platform</h1>
            <span className="tag-solid-flare"><ShieldAlert className="w-3 h-3" strokeWidth={2.5} /> Owner</span>
          </div>
          <p className="text-sm text-ink-500 mt-1">Manage all organizations on Doc Ledger</p>
        </div>
      </motion.div>

      {/* Overview */}
      {loading || !overview ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {[0, 1, 2, 3].map(i => <div key={i} className="skeleton h-24" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <StatTile icon={Building2} label="Organizations"   value={fmtInt(overview.orgCount)}       accent="blue" />
          <StatTile icon={Users}     label="Total users"     value={fmtInt(overview.userCount)}      accent="ink" />
          <StatTile icon={FileText}  label="Expenses"        value={fmtInt(overview.expenseCount)}   accent="blue" />
          <StatTile icon={Activity}  label="Active sessions" value={fmtInt(overview.activeSessions)} accent="green" />
        </div>
      )}

      {/* Cross-platform summary strip */}
      {overview && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-7">
          <div className="plate p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-ink-900 flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4 text-paper-100" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <p className="label mb-1">Total spend, all orgs</p>
              <p className="font-mono tabular-nums text-lg text-ink-900">AED {fmt(overview.totalSpend)}</p>
            </div>
          </div>
          <div className="plate p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-flare-500 flex items-center justify-center flex-shrink-0">
              <Clock className="w-4 h-4 text-ink-900" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <p className="label mb-1">Pending join requests</p>
              <p className="font-mono tabular-nums text-lg text-ink-900">{fmtInt(overview.pendingJoins)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Orgs table */}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-2 border-b-2 border-ink-900 pb-2 mb-0">
          <div>
            <h2 className="text-lg w-wide text-ink-900">Organizations</h2>
            <p className="text-sm text-ink-500">Click a row to expand members</p>
          </div>
          <p className="meta">{orgs.length} {orgs.length === 1 ? 'org' : 'orgs'}</p>
        </div>

        {loading ? (
          <div className="space-y-2 mt-3">
            <div className="skeleton h-12 w-full" />
            <div className="skeleton h-12 w-full" />
            <div className="skeleton h-12 w-full" />
          </div>
        ) : orgs.length === 0 ? (
          <div className="plate border-t-0 p-12 text-center">
            <Building2 className="w-10 h-10 text-ink-300 mx-auto mb-3" strokeWidth={2} />
            <p className="text-ink-500 text-sm">No organizations yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="ledger min-w-[56rem]">
              <thead>
                <tr>
                  <th>Organization</th>
                  <th>Members</th>
                  <th>Pending</th>
                  <th>Expenses</th>
                  <th className="text-right">Total spend</th>
                  <th>Last activity</th>
                  <th>Created</th>
                  <th className="w-28" />
                </tr>
              </thead>
              <tbody>
                {orgs.map(org => (
                  <OrgRow key={org.id} org={org} onEdit={setEdit} onDelete={setConfirm} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

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
