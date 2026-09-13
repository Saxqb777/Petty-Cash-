import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { TrendingDown, Plus, Trash2, Upload, X, ChevronDown, Link2, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '../utils/api';
import { useToast } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';

const fmt = (n) => new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

function Skeleton({ className = '' }) {
  return <div className={`skeleton ${className}`} />;
}

const BUS = ['AAFB', 'Al Foah', 'GMFF', 'BMB', 'Other'];
const PORTS = ['AUH', 'DXB', 'AJM', 'Other'];

const EMPTY_FORM = {
  date: new Date().toISOString().split('T')[0],
  month: '',
  business_unit: '',
  port: '',
  reference_number: '',
  import_export: 'Import',
  previous_agent: '',
  current_agent: '',
  old_fee: '',
  new_fee: '',
  project_name: '',
  description: '',
};

// 120ms, ease-out, opacity + 4px.
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } }
};
const item = {
  hidden: { opacity: 0, y: 4 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.12, ease: 'easeOut' } }
};

function Sel({ value, onChange, options, placeholder = 'Select...', className = '' }) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)} className={`select ${className}`}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-500 pointer-events-none" strokeWidth={2} />
    </div>
  );
}

// Flat ink scrim, white plate, 2px rule. Same treatment as Records.
function Modal({ title, onClose, children, footer, size = 'max-w-2xl' }) {
  useEffect(() => {
    const handle = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-ink-900/30 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className={`plate w-full ${size} my-auto animate-rise`}>
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b-2 border-ink-900">
          <h2 className="text-base w-wide text-ink-900">{title}</h2>
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

// Column name aliases — maps common spreadsheet headers to our field names
const COL_MAP = {
  date: ['date', 'clearance date', 'bill date', 'inv date'],
  month: ['month'],
  business_unit: ['business unit', 'bu', 'business_unit'],
  port: ['port', 'port of entry'],
  reference_number: ['reference', 'reference number', 'ref', 'ref no', 'reference_number', 'bl number', 'bl no'],
  import_export: ['import/export', 'import_export', 'type', 'i/e'],
  previous_agent: ['previous agent', 'prev agent', 'old agent', 'previous_agent', 'former agent'],
  current_agent: ['current agent', 'new agent', 'current_agent', 'agent'],
  old_fee: ['old fee', 'old agent fee', 'previous fee', 'old_fee', 'prev fee', 'old cost'],
  new_fee: ['new fee', 'new agent fee', 'current fee', 'new_fee', 'new cost'],
  savings: ['savings', 'saving', 'saved'],
  project_name: ['project', 'project name', 'cargo', 'project_name', 'shipment'],
  description: ['description', 'notes', 'remarks', 'details'],
};

function findCol(headers, field) {
  const aliases = COL_MAP[field] || [];
  return headers.findIndex(h => aliases.includes(h.toLowerCase().trim()));
}

function parseSheetRows(rows) {
  if (!rows || rows.length < 2) return [];
  const headers = rows[0].map(h => String(h || '').toLowerCase().trim());
  const idx = {};
  Object.keys(COL_MAP).forEach(f => { idx[f] = findCol(headers, f); });

  return rows.slice(1).map(row => {
    const get = (f) => idx[f] >= 0 ? String(row[idx[f]] ?? '').trim() : '';
    const date = get('date');
    if (!date) return null;
    const old_fee = parseFloat(get('old_fee')) || 0;
    const new_fee = parseFloat(get('new_fee')) || 0;
    const savings_raw = parseFloat(get('savings'));
    return {
      date,
      month:           get('month')           || null,
      business_unit:   get('business_unit')   || null,
      port:            get('port')            || null,
      reference_number:get('reference_number')|| null,
      import_export:   get('import_export')   || null,
      previous_agent:  get('previous_agent')  || null,
      current_agent:   get('current_agent')   || null,
      old_fee,
      new_fee,
      savings:         isNaN(savings_raw) ? undefined : savings_raw,
      project_name:    get('project_name')    || null,
      description:     get('description')     || null,
    };
  }).filter(Boolean);
}

function ImportModal({ onClose, onImport }) {
  const fileRef = useRef();
  const [preview, setPreview] = useState([]);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);

  const processFile = (file) => {
    if (!file) return;
    setFileName(file.name);
    setError('');
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        const parsed = parseSheetRows(rows);
        if (!parsed.length) {
          setError('No valid rows found. Make sure your sheet has a header row with columns like: Date, BU, Port, Previous Agent, Old Fee, New Fee.');
          setPreview([]);
        } else {
          setPreview(parsed);
        }
      } catch (err) {
        setError('Could not read file: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    if (!preview.length) return;
    setImporting(true);
    try {
      await onImport(preview);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setImporting(false);
    }
  };

  const totalSavings = preview.reduce((s, r) => s + (r.savings ?? (r.old_fee - r.new_fee)), 0);

  return (
    <Modal
      title="Import Savings Data"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost flex-1">Cancel</button>
          <button
            onClick={handleImport}
            disabled={importing || preview.length === 0}
            className="btn-primary flex-1"
          >
            <Upload className="w-4 h-4" strokeWidth={2} />
            {importing ? 'Importing...' : `Import ${preview.length} Record${preview.length !== 1 ? 's' : ''}`}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Upload zone */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="w-full border-2 border-dashed border-ink-900 p-8 text-center cursor-pointer transition-colors duration-[120ms] hover:bg-blue-50"
        >
          <FileSpreadsheet className="w-9 h-9 text-ink-500 mx-auto mb-3" strokeWidth={2} />
          <p className="text-sm font-bold text-ink-900 break-all">
            {fileName || 'Upload your savings spreadsheet'}
          </p>
          <p className="meta mt-1">Accepts .xlsx, .xls, .csv in any column order</p>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={e => e.target.files[0] && processFile(e.target.files[0])}
          />
        </button>

        {error && <p className="text-sm text-flare-700 bg-flare-50 border-2 border-flare-700 p-3">{error}</p>}

        {preview.length > 0 && (
          <>
            <div className="flex flex-wrap justify-between items-center gap-2 p-3 bg-green-500 border-2 border-ink-900 text-ink-900">
              <span className="text-sm font-bold">{preview.length} records ready to import</span>
              <span className="font-mono tabular-nums text-sm">AED {fmt(totalSavings)}</span>
            </div>

            {/* Preview table */}
            <div className="overflow-x-auto">
              <table className="ledger min-w-[720px]">
                <thead>
                  <tr>
                    {['Date','BU','Port','Prev. Agent','Old Fee','Curr. Agent','New Fee','Savings'].map((h, i) => (
                      <th key={h} className={i === 4 || i === 6 || i === 7 ? '!text-right' : ''}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 8).map((r, i) => (
                    <tr key={i}>
                      <td className="font-mono text-xs whitespace-nowrap text-ink-700">{r.date}</td>
                      <td className="text-ink-700">{r.business_unit || '-'}</td>
                      <td className="text-ink-700">{r.port || '-'}</td>
                      <td className="text-ink-700">{r.previous_agent || '-'}</td>
                      <td className="amount text-ink-700">{fmt(r.old_fee)}</td>
                      <td className="text-ink-700">{r.current_agent || '-'}</td>
                      <td className="amount text-ink-700">{fmt(r.new_fee)}</td>
                      <td className="amount text-green-700">{fmt(r.savings ?? (r.old_fee - r.new_fee))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.length > 8 && (
              <p className="meta text-center">and {preview.length - 8} more rows</p>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

export default function SavingsPage() {
  const toast = useToast();

  const [tab, setTab] = useState('records');
  const [summary, setSummary] = useState(null);
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCSV, setShowCSV] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Filters
  const [filterBU, setFilterBU] = useState('');
  const [filterIE, setFilterIE] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  // Form
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [shippingExpenses, setShippingExpenses] = useState([]);
  const [linkedExpense, setLinkedExpense] = useState('');

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const computedSavings = form.old_fee !== '' && form.new_fee !== ''
    ? (parseFloat(form.old_fee) || 0) - (parseFloat(form.new_fee) || 0)
    : null;

  // Load shipping expenses for linking
  useEffect(() => {
    api.getRecords({ expense_type: 'shipping', limit: 200 })
      .then(d => setShippingExpenses(d.records || []))
      .catch(() => {});
  }, []);

  const [agentSuggestion, setAgentSuggestion] = useState(null);
  const agentLookupTimer = useRef(null);

  const lookupAgentRate = (agent, port, ie) => {
    clearTimeout(agentLookupTimer.current);
    if (!agent) { setAgentSuggestion(null); return; }
    agentLookupTimer.current = setTimeout(async () => {
      try {
        const r = await api.getAgentRates({ previous_agent: agent, port, import_export: ie });
        setAgentSuggestion(r.suggested_fee != null ? r.suggested_fee : null);
      } catch { setAgentSuggestion(null); }
    }, 500);
  };

  const handleLinkExpense = (id) => {
    setLinkedExpense(id);
    if (!id) return;
    const exp = shippingExpenses.find(e => String(e.id) === String(id));
    if (!exp) return;
    // Extract agent fee from line_items
    const agentFeeItem = (exp.line_items || []).find(li =>
      li.label?.toLowerCase().includes('agent') ||
      li.name?.toLowerCase().includes('agent')
    );
    const agentFee = agentFeeItem ? parseFloat(agentFeeItem.amount) || 0 : 0;
    const bls = exp.bl_numbers?.length ? exp.bl_numbers : exp.bl_number ? [exp.bl_number] : [];
    setForm(f => ({
      ...f,
      date:           exp.date          || f.date,
      business_unit:  exp.business_unit || f.business_unit,
      port:           exp.port          || f.port,
      import_export:  exp.shipment_type || f.import_export,
      current_agent:  exp.vendor_name   || f.current_agent,
      reference_number: bls.join(', ') || exp.invoice_number || f.reference_number,
      new_fee:        agentFee > 0 ? String(agentFee) : f.new_fee,
    }));
  };

  const loadSummary = async () => {
    try {
      const s = await api.getSavingsSummary();
      setSummary(s);
    } catch (e) {
      console.error('Summary load error:', e);
    }
  };

  const loadRecords = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 50 };
      if (filterBU) params.business_unit = filterBU;
      if (filterIE) params.import_export = filterIE;
      if (filterFrom) params.from = filterFrom;
      if (filterTo) params.to = filterTo;
      const data = await api.getSavings(params);
      setRecords(data.records || []);
      setTotal(data.total || 0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSummary(); }, []);
  useEffect(() => { loadRecords(); }, [page, filterBU, filterIE, filterFrom, filterTo]);


  const handleSave = async () => {
    if (!form.date || !form.old_fee) { setFormError('Date and old fee are required.'); return; }
    setSaving(true); setFormError('');
    try {
      await api.createSaving({
        ...form,
        old_fee: parseFloat(form.old_fee) || 0,
        new_fee: parseFloat(form.new_fee) || 0,
      });
      toast.success('Savings record saved');
      setForm(EMPTY_FORM);
      setLinkedExpense('');
      await Promise.all([loadSummary(), loadRecords()]);
      setTab('records');
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteSaving(id);
      toast.success('Savings record deleted');
      await Promise.all([loadSummary(), loadRecords()]);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setConfirmDelete(null);
    }
  };

  const handleBulkImport = async (rows) => {
    await api.bulkSavings(rows);
    toast.success(`${rows.length} record${rows.length !== 1 ? 's' : ''} imported`);
    await Promise.all([loadSummary(), loadRecords()]);
  };

  const netPositive = (summary?.net || 0) >= 0;
  const hasSavingsFilters = filterBU || filterIE || filterFrom || filterTo;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.12, ease: 'easeOut' }}
        className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5 pb-4 border-b-2 border-ink-900"
      >
        <div>
          <h1 className="display text-3xl text-ink-900">Clearance Savings</h1>
          <p className="text-sm text-ink-500 mt-1.5">Track agent fee savings from self-clearance operations</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowCSV(true)} className="btn-ghost btn-sm">
            <Upload className="w-3.5 h-3.5" strokeWidth={2} /> Import CSV
          </button>
          <button onClick={() => setTab('add')} className="btn-primary btn-sm">
            <Plus className="w-4 h-4" strokeWidth={2.5} /> Add Record
          </button>
        </div>
      </motion.div>

      {/* Summary — one object, three panels, green carries the result */}
      <motion.div
        variants={container} initial="hidden" animate="show"
        className="grid grid-cols-1 sm:grid-cols-3 border-2 border-ink-900 mb-6"
      >
        <motion.div variants={item} className="bg-white px-5 py-4">
          <p className="label">Gross savings</p>
          <p className="font-mono tabular-nums text-2xl leading-none text-green-700">AED {fmt(summary?.gross)}</p>
          <p className="meta mt-2">Total agent fees saved</p>
        </motion.div>
        <motion.div variants={item} className="bg-white px-5 py-4 border-t-2 sm:border-t-0 sm:border-l-2 border-ink-900">
          <p className="label">Fuel cost</p>
          <p className="font-mono tabular-nums text-2xl leading-none text-flare-700">AED {fmt(summary?.fuelCost)}</p>
          <p className="meta mt-2">Self-clearance fuel (ADNOC)</p>
        </motion.div>
        <motion.div
          variants={item}
          className={`px-5 py-4 border-t-2 sm:border-t-0 sm:border-l-2 border-ink-900 ${netPositive ? 'bg-green-500' : 'bg-flare-500'}`}
        >
          <p className="block text-2xs font-bold uppercase text-ink-900/70 mb-2">Net savings</p>
          <p className="font-mono tabular-nums text-2xl leading-none text-ink-900">
            {netPositive ? '' : '-'}AED {fmt(Math.abs(summary?.net))}
          </p>
          <p className="text-xs font-mono text-ink-900/70 mt-2">Gross minus fuel costs</p>
        </motion.div>
      </motion.div>

      {/* Segmented control */}
      <div className="inline-flex border-2 border-ink-900 divide-x-2 divide-ink-900 mb-5">
        {[
          { id: 'records', label: `Records (${total})` },
          { id: 'add',     label: 'Add Record' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            aria-pressed={tab === t.id}
            className={`px-4 py-2 text-xs font-bold uppercase transition-colors duration-[120ms] ${tab === t.id ? 'bg-ink-900 text-paper-100' : 'bg-white text-ink-600 hover:bg-paper-100'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Records Tab */}
      {tab === 'records' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.12, ease: 'easeOut' }}>
          {/* Filter strip */}
          <div className="plate mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3">
              <div>
                <label className="label">Business Unit</label>
                <Sel value={filterBU} onChange={setFilterBU} options={BUS} placeholder="All BUs" />
              </div>
              <div>
                <label className="label">Import / Export</label>
                <Sel value={filterIE} onChange={setFilterIE} options={['Import', 'Export']} placeholder="All" />
              </div>
              <div>
                <label className="label">From Date</label>
                <input className="input font-mono" type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
              </div>
              <div>
                <label className="label">To Date</label>
                <input className="input font-mono" type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} />
              </div>
            </div>
            {hasSavingsFilters && (
              <button
                onClick={() => { setFilterBU(''); setFilterIE(''); setFilterFrom(''); setFilterTo(''); setPage(1); }}
                className="w-full px-3 py-2 text-xs font-bold uppercase text-ink-500 hover:text-ink-900 hover:bg-paper-100 border-t-2 border-ink-900 transition-colors duration-[120ms] text-left"
              >
                Clear filters
              </button>
            )}
          </div>

          {error && <div className="mb-4 px-4 py-3 bg-flare-50 border-2 border-flare-700 text-sm text-flare-700">{error}</div>}

          {loading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : records.length === 0 ? (
            <div className="plate p-10 text-center">
              <TrendingDown className="w-9 h-9 text-ink-300 mx-auto mb-3" strokeWidth={2} />
              <p className="text-base w-wide text-ink-900">No savings records yet</p>
              <p className="text-sm text-ink-500 mt-1">Add records manually or import from CSV</p>
              <button onClick={() => setTab('add')} className="btn-primary btn-sm mt-4">
                <Plus className="w-4 h-4" strokeWidth={2.5} /> Add First Record
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="ledger min-w-[1100px]">
                  <thead>
                    <tr>
                      {['Date', 'BU', 'Port', 'Reference', 'I/E', 'Prev. Agent', 'Curr. Agent', 'Old Fee', 'New Fee', 'Savings', 'Description', ''].map((h, i) => (
                        <th key={h || 'actions'} className={i >= 7 && i <= 9 ? '!text-right' : ''}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {records.map(r => (
                      <tr key={r.id}>
                        <td className="font-mono tabular-nums text-ink-700 whitespace-nowrap">{r.date}</td>
                        <td className="text-ink-900 font-bold">{r.business_unit || '-'}</td>
                        <td className="text-ink-700">{r.port || '-'}</td>
                        <td className="font-mono text-xs text-ink-600">{r.reference_number || '-'}</td>
                        <td>
                          <span className={r.import_export === 'Export' ? 'tag-blue' : 'tag-wait'}>
                            {r.import_export || '-'}
                          </span>
                        </td>
                        <td className="text-ink-700">{r.previous_agent || '-'}</td>
                        <td className="text-ink-700">{r.current_agent || '-'}</td>
                        <td className="amount text-ink-600">{fmt(r.old_fee)}</td>
                        <td className="amount text-ink-600">{fmt(r.new_fee)}</td>
                        <td className="amount text-green-700">{fmt(r.savings)}</td>
                        <td className="text-ink-500 max-w-[180px] truncate">{r.description || '-'}</td>
                        <td>
                          <button
                            onClick={() => setConfirmDelete(r.id)}
                            aria-label="Delete savings record"
                            className="w-7 h-7 flex items-center justify-center text-ink-400 hover:text-flare-700 hover:bg-flare-50 transition-colors duration-[120ms]"
                          >
                            <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-ink-900 bg-white">
                      <td colSpan={7} className="px-3 py-2.5 text-2xs font-bold uppercase text-ink-900">Total ({total} records)</td>
                      <td className="px-3 py-2.5 amount text-sm text-ink-700">
                        {fmt(records.reduce((s, r) => s + (r.old_fee || 0), 0))}
                      </td>
                      <td className="px-3 py-2.5 amount text-sm text-ink-700">
                        {fmt(records.reduce((s, r) => s + (r.new_fee || 0), 0))}
                      </td>
                      <td className="px-3 py-2.5 amount text-sm bg-green-500 text-ink-900">
                        {fmt(records.reduce((s, r) => s + (r.savings || 0), 0))}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Pagination */}
              {total > 50 && (
                <div className="px-3 py-2.5 border-2 border-t-0 border-ink-900 bg-white flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-2xs uppercase text-ink-400">
                    Showing {Math.min((page - 1) * 50 + 1, total)} to {Math.min(page * 50, total)} of {total}
                  </span>
                  <div className="flex gap-2">
                    <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-ghost btn-sm">Prev</button>
                    <button disabled={page * 50 >= total} onClick={() => setPage(p => p + 1)} className="btn-ghost btn-sm">Next</button>
                  </div>
                </div>
              )}
            </>
          )}
        </motion.div>
      )}

      {/* Add Record Tab */}
      {tab === 'add' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.12, ease: 'easeOut' }} className="max-w-2xl">
          <div className="plate">
            <div className="px-4 py-3 border-b-2 border-ink-900">
              <h2 className="text-base w-wide text-ink-900">New Savings Record</h2>
            </div>

            <div className="p-4 sm:p-5">
              {formError && <div className="mb-4 px-4 py-3 bg-flare-50 border-2 border-flare-700 text-sm text-flare-700">{formError}</div>}

              {/* Link to existing shipping expense */}
              {shippingExpenses.length > 0 && (
                <div className="mb-5 p-4 bg-blue-50 border-2 border-blue-600">
                  <label className="flex items-center gap-2 text-sm font-bold text-ink-900 mb-2">
                    <Link2 className="w-4 h-4 text-blue-600" strokeWidth={2} />
                    Auto-fill from a recorded shipping bill (optional)
                  </label>
                  <div className="relative">
                    <select
                      value={linkedExpense}
                      onChange={e => handleLinkExpense(e.target.value)}
                      className="select"
                    >
                      <option value="">Pick a shipping expense to auto-fill</option>
                      {shippingExpenses.map(e => {
                        const agentFeeItem = (e.line_items || []).find(li =>
                          li.label?.toLowerCase().includes('agent') || li.name?.toLowerCase().includes('agent')
                        );
                        const agentFee = agentFeeItem ? parseFloat(agentFeeItem.amount) : 0;
                        const bl = e.bl_numbers?.[0] || e.bl_number || '';
                        return (
                          <option key={e.id} value={e.id}>
                            {e.date} · {e.vendor_name}{bl ? ` · BL: ${bl}` : ''}{agentFee > 0 ? ` · Agent Fee: AED ${agentFee}` : ''}
                          </option>
                        );
                      })}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-500 pointer-events-none" strokeWidth={2} />
                  </div>
                  {linkedExpense && (
                    <p className="text-sm text-blue-600 mt-2">
                      Date, port, BU, current agent and new fee filled from the selected bill. Only enter the old agent fee below.
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Date *</label>
                  <input className="input font-mono" type="date" value={form.date} onChange={e => setF('date', e.target.value)} />
                </div>
                <div>
                  <label className="label">Month</label>
                  <input className="input" value={form.month} onChange={e => setF('month', e.target.value)} placeholder="e.g. January 2026" />
                </div>
                <div>
                  <label className="label">Business Unit</label>
                  <Sel value={form.business_unit} onChange={v => setF('business_unit', v)} options={BUS} placeholder="Select BU" />
                </div>
                <div>
                  <label className="label">Port</label>
                  <Sel value={form.port} onChange={v => setF('port', v)} options={PORTS} placeholder="Select port" />
                </div>
                <div>
                  <label className="label">Reference Number</label>
                  <input className="input font-mono" value={form.reference_number} onChange={e => setF('reference_number', e.target.value)} placeholder="REF-001" />
                </div>
                <div>
                  <label className="label">Import / Export</label>
                  <Sel value={form.import_export} onChange={v => setF('import_export', v)} options={['Import', 'Export']} />
                </div>
                <div>
                  <label className="label">Previous Agent</label>
                  <input
                    className="input"
                    value={form.previous_agent}
                    onChange={e => {
                      setF('previous_agent', e.target.value);
                      lookupAgentRate(e.target.value, form.port, form.import_export);
                    }}
                    placeholder="e.g. Al Bahar"
                  />
                </div>
                <div>
                  <label className="label">Current Agent</label>
                  <input className="input" value={form.current_agent} onChange={e => setF('current_agent', e.target.value)} placeholder="e.g. AL GHARBEYA / In House" />
                </div>
                <div>
                  <label className="label">Old Fee (AED) *</label>
                  <input className="input font-mono tabular-nums" type="number" step="0.01" min="0" value={form.old_fee} onChange={e => setF('old_fee', e.target.value)} placeholder="225.00" />
                  {agentSuggestion != null && !form.old_fee && (
                    <button
                      type="button"
                      onClick={() => setF('old_fee', String(agentSuggestion))}
                      className="mt-1.5 text-xs font-bold uppercase text-blue-600 hover:text-blue-800 transition-colors duration-[120ms]"
                    >
                      Use AED {fmt(agentSuggestion)} from past records
                    </button>
                  )}
                </div>
                <div>
                  <label className="label">New Fee (AED)</label>
                  <input className="input font-mono tabular-nums" type="number" step="0.01" min="0" value={form.new_fee} onChange={e => setF('new_fee', e.target.value)} placeholder="43.00" />
                </div>

                {computedSavings !== null && (
                  <div className={`sm:col-span-2 p-3 border-2 border-ink-900 ${computedSavings < 0 ? 'bg-flare-500' : 'bg-green-500'}`}>
                    <p className="text-sm font-bold text-ink-900">
                      Savings = <span className="font-mono tabular-nums font-normal">AED {fmt(computedSavings)}</span>
                      {computedSavings < 0 && <span className="block text-xs mt-0.5">Negative: new fee exceeds old fee</span>}
                    </p>
                  </div>
                )}

                <div>
                  <label className="label">Project Name</label>
                  <input className="input" value={form.project_name} onChange={e => setF('project_name', e.target.value)} placeholder="Project / cargo name" />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Description</label>
                  <textarea className="textarea resize-none" rows={2} value={form.description} onChange={e => setF('description', e.target.value)} placeholder="Additional details about the clearance..." />
                </div>
              </div>
            </div>

            <div className="flex gap-3 px-4 py-3 border-t-2 border-ink-900">
              <button onClick={() => { setTab('records'); setForm(EMPTY_FORM); setFormError(''); setLinkedExpense(''); }} className="btn-ghost">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
                {saving ? 'Saving...' : 'Save Record'}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {showCSV && (
        <ImportModal
          onClose={() => setShowCSV(false)}
          onImport={handleBulkImport}
        />
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Delete Savings Record"
        message="This will permanently remove this savings record. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => handleDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
