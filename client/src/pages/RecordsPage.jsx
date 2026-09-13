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
  adnoc:    { label: 'Fuel',     icon: Fuel,    tag: 'tag-solid-flare' },
  shipping: { label: 'Shipping', icon: Ship,    tag: 'tag-solid-blue' },
  general:  { label: 'General',  icon: Receipt, tag: 'tag-muted' },
};

const fmt = (n) => new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2 }).format(n || 0);
const fmtDate = (d) => {
  if (!d) return '-';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Three inks carry meaning, so most categories stay uncoloured. Flare marks the
// cost centres finance watches; blue marks the shipping chain.
const CATEGORY_TAGS = {
  'Fuel & Transport':       'tag-flare',
  'Parking':                'tag-muted',
  'Customs & Clearance':    'tag-blue',
  'Printing & Photocopy':   'tag-muted',
  'Materials & Supplies':   'tag-wait',
  'Food & Beverages':       'tag-muted',
  'Office Supplies':        'tag-muted',
  'Accommodation & Travel': 'tag-blue',
  'Medical':                'tag-flare',
  'Miscellaneous':          'tag-muted',
};

// image_path may arrive as a full blob URL or as a legacy relative upload path.
const fileHref = (p) => {
  if (!p) return '';
  if (/^https?:\/\//i.test(p)) return p;
  return p.startsWith('/') ? p : `/${p}`;
};
const isPdf = (p) => /\.pdf(\?|#|$)/i.test(p || '');

// ─── Modal shell — flat scrim, white plate, 2px ink rule ──────────────────────
function Modal({ title, onClose, children, footer, size = 'max-w-md' }) {
  useEffect(() => {
    const handle = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-ink-900/30 flex items-start sm:items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
      <div className={`plate w-full ${size} my-auto animate-rise`}>
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b-2 border-ink-900">
          <h3 className="text-base w-wide text-ink-900">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-7 h-7 flex items-center justify-center text-ink-500 hover:text-ink-900 hover:bg-paper-200 transition-colors duration-[120ms]"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
        <div className="p-4 sm:p-5 max-h-[70vh] overflow-y-auto">{children}</div>
        {footer && <div className="flex gap-3 px-4 py-3 border-t-2 border-ink-900">{footer}</div>}
      </div>
    </div>
  );
}

// ─── Export Modal ─────────────────────────────────────────────────────────────
function ExportModal({ onClose }) {
  const [type, setType]         = useState('all');
  const [from, setFrom]         = useState('');
  const [to, setTo]             = useState('');
  const [category, setCategory] = useState('');
  const [bu, setBu]             = useState('');

  const doExport = () => {
    const url = api.exportUrl({ type, from: type === 'custom' ? from : '', to: type === 'custom' ? to : '', category, business_unit: bu });
    window.open(url, '_blank');
    onClose();
  };

  return (
    <Modal
      title="Export to Excel"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost flex-1">Cancel</button>
          <button onClick={doExport} className="btn-primary flex-1">
            <Download className="w-4 h-4" strokeWidth={2} /> Download
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label">Date Range</label>
          <div className="grid grid-cols-3 border-2 border-ink-900 divide-x-2 divide-ink-900">
            {['all', 'this_month', 'custom'].map(t => (
              <button key={t} onClick={() => setType(t)}
                className={`py-2 px-1 text-xs font-bold uppercase transition-colors duration-[120ms] ${type === t ? 'bg-blue-600 text-white' : 'bg-white text-ink-600 hover:bg-paper-100'}`}>
                {t === 'all' ? 'All Time' : t === 'this_month' ? 'This Month' : 'Custom'}
              </button>
            ))}
          </div>
        </div>

        {type === 'custom' && (
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">From</label><input type="date" className="input font-mono" value={from} onChange={e => setFrom(e.target.value)} /></div>
            <div><label className="label">To</label><input type="date" className="input font-mono" value={to} onChange={e => setTo(e.target.value)} /></div>
          </div>
        )}
        <div>
          <label className="label">Filter by Category (optional)</label>
          <select className="select" value={category} onChange={e => setCategory(e.target.value)}>
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Filter by Business Unit (optional)</label>
          <select className="select" value={bu} onChange={e => setBu(e.target.value)}>
            <option value="">All Business Units</option>
            {BUS.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
      </div>
    </Modal>
  );
}

// ─── Edit Modal ────────────────────────────────────────────────────────────────
function EditModal({ record, onClose, onSave }) {
  const toast = useToast();
  const [form, setForm] = useState({ ...record, line_items: undefined });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

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
    <Modal
      title="Edit Expense"
      onClose={onClose}
      size="max-w-2xl"
      footer={
        <>
          <button onClick={onClose} className="btn-ghost flex-1">Cancel</button>
          <button onClick={save} disabled={saving} className="btn-primary flex-1">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { k: 'vendor_name',    l: 'Vendor',      placeholder: 'e.g. ADNOC' },
          { k: 'invoice_number', l: 'Invoice No.', placeholder: 'Receipt #' },
        ].map(({ k, l, placeholder }) => (
          <div key={k}>
            <label className="label">{l}</label>
            <input className={`input ${k === 'invoice_number' ? 'font-mono' : ''}`} value={form[k] || ''} onChange={e => set(k, e.target.value)} placeholder={placeholder} />
          </div>
        ))}
        <div>
          <label className="label">Amount (AED)</label>
          <input className="input font-mono tabular-nums" type="number" step="0.01" value={form.amount || ''} onChange={e => set('amount', e.target.value)} />
        </div>
        <div>
          <label className="label">Date</label>
          <input className="input font-mono" type="date" value={form.date || ''} onChange={e => set('date', e.target.value)} />
        </div>
        <div>
          <label className="label">Category</label>
          <select className="select" value={form.category || ''} onChange={e => set('category', e.target.value)}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Business Unit</label>
          <select className="select" value={form.business_unit || ''} onChange={e => set('business_unit', e.target.value)}>
            <option value="">None</option>
            {BUS.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Payment Method</label>
          <select className="select" value={form.payment_method || 'Cash'} onChange={e => set('payment_method', e.target.value)}>
            <option>Cash</option><option>Card</option>
          </select>
        </div>
        <div>
          <label className="label">Submitted By</label>
          <input className="input" value={form.submitted_by || ''} onChange={e => set('submitted_by', e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Purpose</label>
          <input className="input" value={form.purpose || ''} onChange={e => set('purpose', e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Notes</label>
          <textarea className="textarea resize-none" rows={2} value={form.notes || ''} onChange={e => set('notes', e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}

// ─── Sortable column header ────────────────────────────────────────────────────
// Indicator is set in ink (the head is an ink-900 fill), never a coloured arrow.
function SortTh({ label, field, sortBy, sortDir, onSort, align = 'left' }) {
  const active = sortBy === field;
  return (
    <th
      onClick={() => field && onSort(field)}
      aria-sort={active ? (sortDir === 'desc' ? 'descending' : 'ascending') : 'none'}
      className={`select-none ${align === 'right' ? '!text-right' : ''} ${field ? 'cursor-pointer hover:!bg-ink-700' : ''}`}
    >
      <span className={`inline-flex items-center gap-1.5 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
        {label}
        {field && (
          active
            ? (sortDir === 'desc'
                ? <ChevronDown className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                : <ChevronUp className="w-3.5 h-3.5 text-white" strokeWidth={3} />)
            : <ArrowUpDown className="w-3 h-3 text-paper-100/40" strokeWidth={2} />
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
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5 pb-4 border-b-2 border-ink-900">
        <div>
          <h1 className="display text-3xl text-ink-900">Records</h1>
          <p className="meta mt-1.5 uppercase">
            {total} expense{total !== 1 ? 's' : ''} · AED {fmt(totalAmt)} shown
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowExport(true)} className="btn-ghost btn-sm">
            <Download className="w-3.5 h-3.5" strokeWidth={2} /> Export
          </button>
          <button onClick={() => navigate('/upload')} className="btn-primary btn-sm">
            <Plus className="w-4 h-4" strokeWidth={2.5} /> Add
          </button>
        </div>
      </div>

      {/* Control strip */}
      <div className="plate mb-4">
        <div className="flex flex-col sm:flex-row divide-y-2 sm:divide-y-0 sm:divide-x-2 divide-ink-900">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" strokeWidth={2} />
            <input
              className="w-full bg-transparent pl-9 pr-3 py-2.5 text-sm text-ink-900 placeholder:text-ink-300 focus:outline-none focus:bg-blue-50 transition-colors duration-[120ms]"
              placeholder="Search vendor, purpose, invoice..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold uppercase transition-colors duration-[120ms] ${showFilters ? 'bg-ink-900 text-paper-100' : 'text-ink-700 hover:bg-paper-100'}`}
          >
            <Filter className="w-3.5 h-3.5" strokeWidth={2} /> Filters
            {hasFilters && <span className="w-2 h-2 bg-flare-500 overprint" />}
          </button>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold uppercase text-ink-500 hover:text-ink-900 hover:bg-paper-100 transition-colors duration-[120ms]"
            >
              <X className="w-3.5 h-3.5" strokeWidth={2} /> Clear
            </button>
          )}
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 p-3 border-t-2 border-ink-900 bg-paper-50 animate-fade-in">
            <div>
              <label className="label">Type</label>
              <select className="select" value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }}>
                <option value="">All Types</option>
                <option value="adnoc">Petrol & Fuel</option>
                <option value="shipping">Shipping Bill</option>
                <option value="general">General</option>
              </select>
            </div>
            <div>
              <label className="label">Category</label>
              <select className="select" value={filterCat} onChange={e => { setFilterCat(e.target.value); setPage(1); }}>
                <option value="">All</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Business Unit</label>
              <select className="select" value={filterBU} onChange={e => { setFilterBU(e.target.value); setPage(1); }}>
                <option value="">All</option>
                {BUS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="label">From</label>
              <input type="date" className="input font-mono" value={filterFrom} onChange={e => { setFilterFrom(e.target.value); setPage(1); }} />
            </div>
            <div>
              <label className="label">To</label>
              <input type="date" className="input font-mono" value={filterTo} onChange={e => { setFilterTo(e.target.value); setPage(1); }} />
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-flare-50 border-2 border-flare-700 flex items-center gap-3 text-sm text-flare-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" strokeWidth={2} /> {error}
        </div>
      )}

      {/* Ledger */}
      {loading ? (
        <div className="plate p-8 text-center">
          <p className="font-mono text-2xs uppercase text-ink-400">Loading records...</p>
          <div className="skeleton h-1 w-40 mx-auto mt-3" />
        </div>
      ) : records.length === 0 ? (
        <div className="plate p-10 sm:p-12 text-center">
          <FileText className="w-9 h-9 text-ink-300 mx-auto mb-3" strokeWidth={2} />
          <p className="text-base w-wide text-ink-900">{hasFilters ? 'No records match your filters' : 'No records found'}</p>
          <p className="text-sm text-ink-500 mt-1">
            {hasFilters ? 'Try clearing some filters to see more results' : 'Add a new expense to get started'}
          </p>
          {hasFilters
            ? <button onClick={clearFilters} className="btn-ghost btn-sm mt-4">Clear Filters</button>
            : <button onClick={() => navigate('/upload')} className="btn-primary btn-sm mt-4">Add Expense</button>
          }
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="ledger min-w-[900px]">
              <thead>
                <tr>
                  <SortTh label="Date"         field="date"          sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="Invoice"      field={null}          sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="Vendor"       field="vendor_name"   sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="Category"     field="category"      sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="BU"           field="business_unit" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="Payment"      field={null}          sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="Amount (AED)" field="amount_aed"    sortBy={sortBy} sortDir={sortDir} onSort={handleSort} align="right" />
                  <th className="w-24" />
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <Fragment key={r.id}>
                    <tr
                      onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                      className="cursor-pointer group"
                    >
                      <td className="font-mono tabular-nums text-ink-700 whitespace-nowrap">{fmtDate(r.date)}</td>
                      <td className="font-mono text-xs text-ink-400 whitespace-nowrap">{r.invoice_number || '-'}</td>
                      <td>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-ink-900">{r.vendor_name}</p>
                          {r.expense_type && r.expense_type !== 'general' && (() => {
                            const meta = EXPENSE_TYPE_META[r.expense_type];
                            if (!meta) return null;
                            const Icon = meta.icon;
                            return (
                              <span className={meta.tag}>
                                <Icon className="w-3 h-3" strokeWidth={2.5} />{meta.label}
                              </span>
                            );
                          })()}
                        </div>
                        {r.purpose && <p className="text-sm text-ink-500 truncate max-w-[240px]">{r.purpose}</p>}
                        {r.expense_type === 'shipping' && (() => {
                          const bls = r.bl_numbers?.length ? r.bl_numbers : r.bl_number ? [r.bl_number] : [];
                          if (!bls.length) return null;
                          return (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {bls.map(bl => <span key={bl} className="tag-blue">{bl}</span>)}
                            </div>
                          );
                        })()}
                      </td>
                      <td>
                        <span className={`${CATEGORY_TAGS[r.category] || 'tag-muted'} whitespace-nowrap`}>{r.category}</span>
                      </td>
                      <td>
                        {r.business_unit && <span className="tag-wait whitespace-nowrap">{r.business_unit}</span>}
                      </td>
                      <td>
                        <span className={`font-mono text-xs uppercase ${r.payment_method === 'Card' ? 'text-blue-600' : 'text-ink-500'}`}>
                          {r.payment_method || 'Cash'}
                        </span>
                      </td>
                      <td className="amount">
                        <span className="text-sm text-ink-900">{fmt(r.amount_aed || r.amount)}</span>
                        {r.currency && r.currency !== 'AED' && (
                          <span className="block text-xs text-ink-400">{r.currency} {fmt(r.amount)}</span>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity duration-[120ms]">
                          <button onClick={e => { e.stopPropagation(); setEditRecord(r); }}
                            aria-label="Edit expense"
                            className="w-7 h-7 flex items-center justify-center text-ink-500 hover:text-blue-600 hover:bg-blue-50 transition-colors duration-[120ms]">
                            <Edit2 className="w-3.5 h-3.5" strokeWidth={2} />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); setConfirmDelete(r.id); }}
                            disabled={deleting === r.id}
                            aria-label="Delete expense"
                            className="w-7 h-7 flex items-center justify-center text-ink-500 hover:text-flare-700 hover:bg-flare-50 transition-colors duration-[120ms] disabled:opacity-40"
                          >
                            <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                          </button>
                          {expanded === r.id
                            ? <ChevronUp className="w-3.5 h-3.5 text-ink-400" strokeWidth={2} />
                            : <ChevronDown className="w-3.5 h-3.5 text-ink-400" strokeWidth={2} />}
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Row */}
                    {expanded === r.id && (
                      <tr className="!bg-paper-100">
                        <td colSpan={8} className="!p-4 border-t-2 border-ink-900">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {[
                              { l: 'Submitted By', v: r.submitted_by || '-' },
                              { l: 'Currency',     v: r.currency || 'AED' },
                              { l: 'Created',      v: r.created_at ? new Date(r.created_at).toLocaleString('en-AE') : '-' },
                              { l: 'Notes',        v: r.notes || '-' },
                            ].map(({ l, v }) => (
                              <div key={l}>
                                <p className="label">{l}</p>
                                <p className="text-sm text-ink-800 break-words">{v}</p>
                              </div>
                            ))}

                            {/* Shipping-specific fields */}
                            {r.expense_type === 'shipping' && (() => {
                              const bls   = r.bl_numbers?.length   ? r.bl_numbers   : r.bl_number   ? [r.bl_number]   : [];
                              const conts = r.container_numbers?.length ? r.container_numbers : r.container_number ? [r.container_number] : [];
                              return (
                                <>
                                  {bls.length > 0 && (
                                    <div className="sm:col-span-2">
                                      <p className="label">BL Numbers ({bls.length})</p>
                                      <div className="flex flex-wrap gap-1.5">
                                        {bls.map(bl => <span key={bl} className="tag-blue">{bl}</span>)}
                                      </div>
                                    </div>
                                  )}
                                  {conts.length > 0 && (
                                    <div className="sm:col-span-2">
                                      <p className="label">Containers ({conts.length})</p>
                                      <div className="flex flex-wrap gap-1.5">
                                        {conts.map(c => <span key={c} className="tag-muted">{c}</span>)}
                                      </div>
                                    </div>
                                  )}
                                  {r.port && <div>
                                    <p className="label">Port</p>
                                    <p className="text-sm text-ink-800">{r.port}</p>
                                  </div>}
                                  {r.shipment_type && <div>
                                    <p className="label">Shipment</p>
                                    <p className="text-sm text-ink-800">{r.shipment_type}</p>
                                  </div>}
                                </>
                              );
                            })()}

                            {/* Charge breakdown for shipping */}
                            {r.expense_type === 'shipping' && r.line_items && r.line_items.length > 0 && (
                              <div className="sm:col-span-2 lg:col-span-4">
                                <p className="label">Charge Breakdown</p>
                                <div className="overflow-x-auto">
                                  <table className="w-full bg-white border-2 border-ink-900 border-collapse min-w-[320px]">
                                    <thead>
                                      <tr>
                                        <th className="!bg-blue-600 !text-white !text-left">Charge</th>
                                        <th className="!bg-blue-600 !text-white !text-right">Amount (AED)</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {r.line_items.map((item, i) => (
                                        <tr key={i} className="border-t border-paper-300">
                                          <td className="px-3 py-2 text-sm text-ink-800">{item.name || item.label || item.description}</td>
                                          <td className="px-3 py-2 text-sm amount text-ink-900">{fmt(item.amount)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot>
                                      <tr className="bg-blue-50 border-t-2 border-ink-900">
                                        <td className="px-3 py-2 text-2xs font-bold uppercase text-blue-600">Total</td>
                                        <td className="px-3 py-2 text-sm amount text-blue-600">
                                          {fmt(r.line_items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0))}
                                        </td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              </div>
                            )}

                            {r.image_path && (
                              <div className="sm:col-span-2 lg:col-span-4">
                                <p className="label">Bill</p>
                                {isPdf(r.image_path) ? (
                                  <a href={fileHref(r.image_path)} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm">
                                    <FileText className="w-3.5 h-3.5" strokeWidth={2} /> View PDF
                                  </a>
                                ) : (
                                  <a href={fileHref(r.image_path)} target="_blank" rel="noopener noreferrer" className="inline-block">
                                    <img src={fileHref(r.image_path)} alt="Bill" className="h-28 max-w-full object-contain border-2 border-ink-900 bg-white hover:opacity-80 transition-opacity duration-[120ms]" />
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
            <div className="flex items-center justify-between gap-3 px-3 py-2.5 border-2 border-t-0 border-ink-900 bg-white">
              <p className="font-mono text-2xs uppercase text-ink-400">Page {page} of {pages} · {total} records</p>
              <div className="flex">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  aria-label="Previous page"
                  className="w-8 h-8 border-2 border-ink-900 flex items-center justify-center bg-white hover:bg-paper-100 disabled:opacity-40 transition-colors duration-[120ms]">
                  <ChevronLeft className="w-4 h-4" strokeWidth={2.5} />
                </button>
                <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
                  aria-label="Next page"
                  className="w-8 h-8 border-2 border-l-0 border-ink-900 flex items-center justify-center bg-white hover:bg-paper-100 disabled:opacity-40 transition-colors duration-[120ms]">
                  <ChevronRight className="w-4 h-4" strokeWidth={2.5} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

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
