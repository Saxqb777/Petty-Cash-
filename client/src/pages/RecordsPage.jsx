import { useEffect, useState, useCallback, Fragment } from 'react';
import {
  Search, Download, Trash2, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  FileText, Filter, X, Edit2, AlertCircle, Plus, Ship, Fuel, Receipt, ArrowUpDown
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { useToast } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';

const CATEGORIES = [
  'Fuel & Transport', 'Parking', 'Customs & Clearance', 'Printing & Photocopy',
  'Materials & Supplies', 'Food & Beverages', 'Office Supplies',
  'Accommodation & Travel', 'Medical', 'Miscellaneous'
];

const BUS = ['AAFB', 'Al Foah', 'GMFF', 'BMB', 'Other'];

const EXPENSE_TYPE_META = {
  adnoc:    { label: 'Petrol & Fuel',  icon: Fuel,    color: 'bg-orange-100 text-orange-700' },
  shipping: { label: 'Shipping Bill',  icon: Ship,    color: 'bg-blue-100 text-blue-700' },
  general:  { label: 'General',        icon: Receipt, color: 'bg-paper-300 text-ink-600' },
};

const fmt = (n) => new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2 }).format(n || 0);
const fmtDate = (d) => {
  if (!d) return '-';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' });
};

const CATEGORY_COLORS = {
  'Fuel & Transport':       'bg-orange-100 text-orange-700',
  'Parking':                'bg-blue-100 text-blue-700',
  'Customs & Clearance':    'bg-purple-100 text-purple-700',
  'Materials & Supplies':   'bg-yellow-100 text-yellow-700',
  'Food & Beverages':       'bg-pink-100 text-pink-700',
  'Printing & Photocopy':   'bg-cyan-100 text-cyan-700',
  'Office Supplies':        'bg-indigo-100 text-indigo-700',
  'Accommodation & Travel': 'bg-sky-100 text-sky-700',
  'Medical':                'bg-red-100 text-red-700',
  'Miscellaneous':          'bg-paper-300 text-ink-600'
};

// ─── Export Modal ─────────────────────────────────────────────────────────────
function ExportModal({ onClose }) {
  const [type, setType]         = useState('all');
  const [from, setFrom]         = useState('');
  const [to, setTo]             = useState('');
  const [category, setCategory] = useState('');
  const [bu, setBu]             = useState('');

  useEffect(() => {
    const handle = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [onClose]);

  const doExport = () => {
    const url = api.exportUrl({ type, from: type === 'custom' ? from : '', to: type === 'custom' ? to : '', category, business_unit: bu });
    window.open(url, '_blank');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-ink-900/20 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-modal border border-paper-400 w-full max-w-md p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-ink-900">Export to Excel</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-paper-200 flex items-center justify-center text-ink-500">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label">Date Range</label>
            <div className="grid grid-cols-3 gap-2">
              {['all', 'this_month', 'custom'].map(t => (
                <button key={t} onClick={() => setType(t)}
                  className={`py-2 rounded-lg text-sm font-medium border transition-all ${type === t ? 'bg-brand-600 text-white border-brand-600' : 'border-slate-200 text-slate-600 hover:border-brand-300'}`}>
                  {t === 'all' ? 'All Time' : t === 'this_month' ? 'This Month' : 'Custom'}
                </button>
              ))}
            </div>
          </div>

          {type === 'custom' && (
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">From</label><input type="date" className="input" value={from} onChange={e => setFrom(e.target.value)} /></div>
              <div><label className="label">To</label><input type="date" className="input" value={to} onChange={e => setTo(e.target.value)} /></div>
            </div>
          )}
          <div>
            <label className="label">Filter by Category (optional)</label>
            <select className="input" value={category} onChange={e => setCategory(e.target.value)}>
              <option value="">All Categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Filter by Business Unit (optional)</label>
            <select className="input" value={bu} onChange={e => setBu(e.target.value)}>
              <option value="">All Business Units</option>
              {BUS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={doExport} className="btn-primary flex-1 flex items-center justify-center gap-2">
            <Download className="w-4 h-4" /> Download Excel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Modal ────────────────────────────────────────────────────────────────
function EditModal({ record, onClose, onSave }) {
  const toast = useToast();
  const [form, setForm] = useState({ ...record, line_items: undefined });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    const handle = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [onClose]);

  const save = async () => {
    setSaving(true);
    try {
      await api.updateRecord(record.id, form);
      toast.success('Expense updated');
      onSave();
      onClose();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-ink-900/20 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-modal border border-paper-400 w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-ink-900">Edit Expense</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-paper-200 flex items-center justify-center text-ink-500"><X className="w-4 h-4" /></button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[
            { k: 'vendor_name',    l: 'Vendor',      placeholder: 'e.g. ADNOC' },
            { k: 'invoice_number', l: 'Invoice No.', placeholder: 'Receipt #' },
          ].map(({ k, l, placeholder }) => (
            <div key={k}>
              <label className="label">{l}</label>
              <input className="input" value={form[k] || ''} onChange={e => set(k, e.target.value)} placeholder={placeholder} />
            </div>
          ))}
          <div>
            <label className="label">Amount (AED)</label>
            <input className="input" type="number" step="0.01" value={form.amount || ''} onChange={e => set('amount', e.target.value)} />
          </div>
          <div>
            <label className="label">Date</label>
            <input className="input" type="date" value={form.date || ''} onChange={e => set('date', e.target.value)} />
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input" value={form.category || ''} onChange={e => set('category', e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Business Unit</label>
            <select className="input" value={form.business_unit || ''} onChange={e => set('business_unit', e.target.value)}>
              <option value="">—</option>
              {BUS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Payment Method</label>
            <select className="input" value={form.payment_method || 'Cash'} onChange={e => set('payment_method', e.target.value)}>
              <option>Cash</option><option>Card</option>
            </select>
          </div>
          <div>
            <label className="label">Submitted By</label>
            <input className="input" value={form.submitted_by || ''} onChange={e => set('submitted_by', e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="label">Purpose</label>
            <input className="input" value={form.purpose || ''} onChange={e => set('purpose', e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="label">Notes</label>
            <textarea className="input resize-none" rows={2} value={form.notes || ''} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={save} disabled={saving} className="btn-primary flex-1">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sortable column header ────────────────────────────────────────────────────
function SortTh({ label, field, sortBy, sortDir, onSort, className = '' }) {
  const active = sortBy === field;
  return (
    <th
      onClick={() => field && onSort(field)}
      className={`text-left px-4 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wide whitespace-nowrap select-none
        ${field ? 'cursor-pointer hover:text-ink-700 hover:bg-paper-200 transition-colors' : ''} ${className}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {field && (
          active
            ? (sortDir === 'desc'
                ? <ChevronDown className="w-3 h-3 text-brand-500" />
                : <ChevronUp className="w-3 h-3 text-brand-500" />)
            : <ArrowUpDown className="w-3 h-3 opacity-25" />
        )}
      </span>
    </th>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function RecordsPage() {
  const navigate  = useNavigate();
  const toast     = useToast();

  const [records, setRecords] = useState([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [pages,   setPages]   = useState(1);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const [search,     setSearch]     = useState('');
  const [filterCat,  setFilterCat]  = useState('');
  const [filterBU,   setFilterBU]   = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo,   setFilterTo]   = useState('');
  const [filterType, setFilterType] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [sortBy,  setSortBy]  = useState('date');
  const [sortDir, setSortDir] = useState('desc');

  const [expanded,      setExpanded]      = useState(null);
  const [showExport,    setShowExport]    = useState(false);
  const [editRecord,    setEditRecord]    = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting,      setDeleting]      = useState(null);

  const handleSort = (field) => {
    if (sortBy === field) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortBy(field); setSortDir('desc'); }
    setPage(1);
  };

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await api.getRecords({
        search, category: filterCat, business_unit: filterBU,
        from: filterFrom, to: filterTo, expense_type: filterType,
        page, limit: 20, sort_by: sortBy, sort_dir: sortDir
      });
      setRecords(data.records); setTotal(data.total);
      setPage(data.page); setPages(data.pages);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [search, filterCat, filterBU, filterFrom, filterTo, filterType, page, sortBy, sortDir]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    setDeleting(id);
    try {
      await api.deleteRecord(id);
      toast.success('Expense deleted');
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDeleting(null);
      setConfirmDelete(null);
    }
  };

  const clearFilters = () => {
    setSearch(''); setFilterCat(''); setFilterBU('');
    setFilterFrom(''); setFilterTo(''); setFilterType(''); setPage(1);
  };
  const hasFilters = search || filterCat || filterBU || filterFrom || filterTo || filterType;
  const totalAmt = records.reduce((s, r) => s + (r.amount_aed || r.amount || 0), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-ink-900 tracking-tight">Records</h1>
          <p className="text-sm text-ink-400 mt-0.5 font-medium">{total} expense{total !== 1 ? 's' : ''} · AED {fmt(totalAmt)} shown</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowExport(true)} className="btn-secondary flex items-center gap-2 text-sm">
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={() => navigate('/upload')} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
      </div>

      {/* Search + Filter bar */}
      <div className="card p-4 mb-4">
        <div className="flex gap-3 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-300" />
            <input
              className="input pl-9"
              placeholder="Search vendor, purpose, invoice..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`btn-secondary flex items-center gap-2 text-sm ${showFilters ? 'border-brand-300 text-brand-700' : ''}`}
          >
            <Filter className="w-4 h-4" /> Filters {hasFilters && <span className="w-2 h-2 bg-brand-500 rounded-full" />}
          </button>
          {hasFilters && (
            <button onClick={clearFilters} className="text-sm text-ink-400 hover:text-ink-700 flex items-center gap-1">
              <X className="w-3.5 h-3.5" /> Clear
            </button>
          )}
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-3 pt-3 border-t border-paper-400 animate-fade-in">
            <div>
              <label className="label">Type</label>
              <select className="input" value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }}>
                <option value="">All Types</option>
                <option value="adnoc">Petrol & Fuel</option>
                <option value="shipping">Shipping Bill</option>
                <option value="general">General</option>
              </select>
            </div>
            <div>
              <label className="label">Category</label>
              <select className="input" value={filterCat} onChange={e => { setFilterCat(e.target.value); setPage(1); }}>
                <option value="">All</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Business Unit</label>
              <select className="input" value={filterBU} onChange={e => { setFilterBU(e.target.value); setPage(1); }}>
                <option value="">All</option>
                {BUS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="label">From</label>
              <input type="date" className="input" value={filterFrom} onChange={e => { setFilterFrom(e.target.value); setPage(1); }} />
            </div>
            <div>
              <label className="label">To</label>
              <input type="date" className="input" value={filterTo} onChange={e => { setFilterTo(e.target.value); setPage(1); }} />
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-sm text-red-600">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-ink-400 text-sm">
            <div className="w-5 h-5 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto mb-2" />
            Loading records...
          </div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-10 h-10 text-paper-500 mx-auto mb-3" />
            <p className="text-ink-500 font-medium">{hasFilters ? 'No records match your filters' : 'No records found'}</p>
            <p className="text-sm text-ink-400 mt-1">
              {hasFilters ? 'Try clearing some filters to see more results' : 'Add a new expense to get started'}
            </p>
            {hasFilters
              ? <button onClick={clearFilters} className="btn-secondary mt-4 text-sm">Clear Filters</button>
              : <button onClick={() => navigate('/upload')} className="btn-primary mt-4 text-sm">Add Expense</button>
            }
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-paper-100 border-b border-paper-400">
                    <SortTh label="Date"         field="date"          sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                    <SortTh label="Invoice"      field={null}          sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                    <SortTh label="Vendor"       field="vendor_name"   sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                    <SortTh label="Category"     field="category"      sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                    <SortTh label="BU"           field="business_unit" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                    <SortTh label="Payment"      field={null}          sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                    <SortTh label="Amount (AED)" field="amount_aed"    sortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="text-right" />
                    <th className="px-4 py-3 w-24" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-paper-300">
                  {records.map(r => (
                    <Fragment key={r.id}>
                      <tr
                        onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                        className="hover:bg-paper-100 cursor-pointer transition-colors group"
                      >
                        <td className="px-4 py-3 text-sm text-ink-600 whitespace-nowrap">{fmtDate(r.date)}</td>
                        <td className="px-4 py-3 text-[11px] text-ink-400 font-mono">{r.invoice_number || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-ink-800">{r.vendor_name}</p>
                            {r.expense_type && r.expense_type !== 'general' && (() => {
                              const meta = EXPENSE_TYPE_META[r.expense_type];
                              if (!meta) return null;
                              const Icon = meta.icon;
                              return <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md font-medium ${meta.color}`}><Icon className="w-3 h-3" />{meta.label}</span>;
                            })()}
                          </div>
                          {r.purpose && <p className="text-xs text-ink-400 truncate max-w-xs">{r.purpose}</p>}
                          {r.expense_type === 'shipping' && (() => {
                            const bls = r.bl_numbers?.length ? r.bl_numbers : r.bl_number ? [r.bl_number] : [];
                            if (!bls.length) return null;
                            return (
                              <div className="flex flex-wrap gap-1 mt-0.5">
                                {bls.map(bl => (
                                  <span key={bl} className="text-[10px] font-mono bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100">{bl}</span>
                                ))}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`badge text-xs ${CATEGORY_COLORS[r.category] || 'badge-gray'}`}>
                            {r.category}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {r.business_unit && <span className="badge badge-green text-xs">{r.business_unit}</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium ${r.payment_method === 'Card' ? 'text-blue-600' : 'text-ink-500'}`}>
                            {r.payment_method || 'Cash'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm font-bold text-ink-900 font-mono tabular-nums">{fmt(r.amount_aed || r.amount)}</span>
                          {r.currency && r.currency !== 'AED' && (
                            <span className="block text-[10px] text-ink-400 font-mono">{r.currency} {fmt(r.amount)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={e => { e.stopPropagation(); setEditRecord(r); }}
                              className="w-7 h-7 rounded-lg hover:bg-brand-50 flex items-center justify-center text-slate-400 hover:text-brand-600">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); setConfirmDelete(r.id); }}
                              disabled={deleting === r.id}
                              className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-slate-400 hover:text-red-500"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            {expanded === r.id ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Row */}
                      {expanded === r.id && (
                        <tr className="bg-paper-100">
                          <td colSpan={8} className="px-6 py-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              {[
                                { l: 'Submitted By', v: r.submitted_by || '—' },
                                { l: 'Currency',     v: r.currency || 'AED' },
                                { l: 'Created',      v: r.created_at ? new Date(r.created_at).toLocaleString('en-AE') : '—' },
                                { l: 'Notes',        v: r.notes || '—' },
                              ].map(({ l, v }) => (
                                <div key={l}>
                                  <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wide mb-0.5">{l}</p>
                                  <p className="text-ink-700">{v}</p>
                                </div>
                              ))}

                              {/* Shipping-specific fields */}
                              {r.expense_type === 'shipping' && (() => {
                                const bls   = r.bl_numbers?.length   ? r.bl_numbers   : r.bl_number   ? [r.bl_number]   : [];
                                const conts = r.container_numbers?.length ? r.container_numbers : r.container_number ? [r.container_number] : [];
                                return (
                                  <>
                                    {bls.length > 0 && (
                                      <div className="col-span-2">
                                        <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wide mb-1">BL Numbers ({bls.length})</p>
                                        <div className="flex flex-wrap gap-1.5">
                                          {bls.map(bl => <span key={bl} className="text-xs font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">{bl}</span>)}
                                        </div>
                                      </div>
                                    )}
                                    {conts.length > 0 && (
                                      <div className="col-span-2">
                                        <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wide mb-1">Containers ({conts.length})</p>
                                        <div className="flex flex-wrap gap-1.5">
                                          {conts.map(c => <span key={c} className="text-xs font-mono bg-paper-300 text-ink-700 px-2 py-0.5 rounded">{c}</span>)}
                                        </div>
                                      </div>
                                    )}
                                    {r.port && <div>
                                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Port</p>
                                      <p className="text-ink-700">{r.port}</p>
                                    </div>}
                                    {r.shipment_type && <div>
                                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Shipment</p>
                                      <p className="text-ink-700">{r.shipment_type}</p>
                                    </div>}
                                  </>
                                );
                              })()}

                              {/* Charge breakdown for shipping */}
                              {r.expense_type === 'shipping' && r.line_items && r.line_items.length > 0 && (
                                <div className="col-span-2 md:col-span-4">
                                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Charge Breakdown</p>
                                  <div className="bg-white rounded-lg border border-paper-400 overflow-hidden">
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr className="bg-blue-50 border-b border-blue-100">
                                          <th className="text-left px-4 py-2 text-xs font-semibold text-blue-700">Charge</th>
                                          <th className="text-right px-4 py-2 text-xs font-semibold text-blue-700">Amount (AED)</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-paper-300">
                                        {r.line_items.map((item, i) => (
                                          <tr key={i}>
                                            <td className="px-4 py-2 text-ink-700">{item.name || item.label || item.description}</td>
                                            <td className="px-4 py-2 text-right text-ink-900 font-medium font-mono tabular-nums">{fmt(item.amount)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                      <tfoot>
                                        <tr className="bg-blue-50 border-t border-blue-100">
                                          <td className="px-4 py-2 text-xs font-bold text-blue-700">TOTAL</td>
                                          <td className="px-4 py-2 text-right text-sm font-bold text-blue-700">
                                            {fmt(r.line_items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0))}
                                          </td>
                                        </tr>
                                      </tfoot>
                                    </table>
                                  </div>
                                </div>
                              )}

                              {r.image_path && (
                                <div className="col-span-2 md:col-span-4">
                                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Bill</p>
                                  {r.image_path.toLowerCase().endsWith('.pdf') ? (
                                    <a href={r.image_path} target="_blank" rel="noopener noreferrer"
                                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-paper-400 rounded-lg text-sm text-blue-600 hover:bg-blue-50 transition-colors">
                                      <FileText className="w-4 h-4" />
                                      View PDF
                                    </a>
                                  ) : (
                                    <a href={r.image_path} target="_blank" rel="noopener noreferrer">
                                      <img src={r.image_path} alt="Bill" className="h-28 rounded-lg object-contain border border-paper-400 hover:opacity-80 transition-opacity" />
                                    </a>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-paper-400">
                <p className="text-xs text-ink-400">Page {page} of {pages} · {total} records</p>
                <div className="flex gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="w-8 h-8 rounded-lg border border-paper-400 flex items-center justify-center hover:bg-paper-100 disabled:opacity-40">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
                    className="w-8 h-8 rounded-lg border border-paper-400 flex items-center justify-center hover:bg-paper-100 disabled:opacity-40">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showExport && <ExportModal onClose={() => setShowExport(false)} />}
      {editRecord && <EditModal record={editRecord} onClose={() => setEditRecord(null)} onSave={load} />}

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Delete Expense"
        message="This will permanently remove the expense and any linked savings record. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => handleDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
