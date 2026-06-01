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

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } }
};
const item = {
  hidden: { opacity: 0, y: 14 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] } }
};

function Sel({ value, onChange, options, placeholder = 'Select...', className = '' }) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)} className={`input appearance-none pr-8 cursor-pointer ${className}`}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
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
          setError('No valid rows found. Make sure your sheet has a header row with columns like: Date, BU, Port, Previous Agent, Old Fee, New Fee…');
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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="font-heading font-bold text-slate-800">Import Savings Data</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Upload zone */}
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-slate-200 hover:border-brand-400 rounded-xl p-8 text-center cursor-pointer transition-colors hover:bg-brand-50/30"
          >
            <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700">
              {fileName || 'Upload your savings spreadsheet'}
            </p>
            <p className="text-xs text-slate-400 mt-1">Accepts .xlsx, .xls, .csv — any column order</p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={e => e.target.files[0] && processFile(e.target.files[0])}
            />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-xl">{error}</p>}

          {preview.length > 0 && (
            <>
              <div className="p-3 bg-brand-50 rounded-xl border border-brand-100 text-sm text-brand-700 flex justify-between items-center">
                <span><strong>{preview.length} records</strong> ready to import</span>
                <span className="font-bold">Total savings: AED {fmt(totalSavings)}</span>
              </div>

              {/* Preview table */}
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      {['Date','BU','Port','Prev. Agent','Old Fee','Curr. Agent','New Fee','Savings'].map(h => (
                        <th key={h} className="text-left px-3 py-2 font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {preview.slice(0, 8).map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-3 py-1.5 text-slate-600">{r.date}</td>
                        <td className="px-3 py-1.5 text-slate-600">{r.business_unit || '—'}</td>
                        <td className="px-3 py-1.5 text-slate-600">{r.port || '—'}</td>
                        <td className="px-3 py-1.5 text-slate-600">{r.previous_agent || '—'}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-slate-700">{fmt(r.old_fee)}</td>
                        <td className="px-3 py-1.5 text-slate-600">{r.current_agent || '—'}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-slate-700">{fmt(r.new_fee)}</td>
                        <td className="px-3 py-1.5 text-right font-mono font-bold text-emerald-700">
                          {fmt(r.savings ?? (r.old_fee - r.new_fee))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.length > 8 && (
                  <p className="text-xs text-slate-400 text-center py-2">…and {preview.length - 8} more rows</p>
                )}
              </div>
            </>
          )}

          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button
              onClick={handleImport}
              disabled={importing || preview.length === 0}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {importing
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Importing...</>
                : <><Upload className="w-4 h-4" /> Import {preview.length} Record{preview.length !== 1 ? 's' : ''}</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
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

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
        className="flex items-center justify-between mb-7"
      >
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-900 tracking-tight">Clearance Savings</h1>
          <p className="text-sm text-slate-400 mt-0.5 font-medium">Track agent fee savings from self-clearance operations</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowCSV(true)} className="btn-secondary flex items-center gap-2 text-sm">
            <Upload className="w-3.5 h-3.5" /> Import CSV
          </button>
          <button onClick={() => setTab('add')} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Add Record
          </button>
        </div>
      </motion.div>

      {/* Summary Cards */}
      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-3 gap-4 mb-6">
        <motion.div variants={item} className="card p-5">
          <p className="text-xs text-brand-600 font-semibold mb-2">GROSS SAVINGS</p>
          <p className="text-2xl font-bold font-heading text-brand-700">AED {fmt(summary?.gross)}</p>
          <p className="text-xs text-slate-400 mt-1">Total agent fees saved</p>
        </motion.div>
        <motion.div variants={item} className="card p-5">
          <p className="text-xs text-orange-600 font-semibold mb-2">FUEL COST</p>
          <p className="text-2xl font-bold font-heading text-orange-700">AED {fmt(summary?.fuelCost)}</p>
          <p className="text-xs text-slate-400 mt-1">Self-clearance fuel (ADNOC)</p>
        </motion.div>
        <motion.div variants={item} className={`card p-5 ${(summary?.net || 0) >= 0 ? 'border-emerald-100' : 'border-red-100'}`}>
          <p className={`text-xs font-semibold mb-2 ${(summary?.net || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>NET SAVINGS</p>
          <p className={`text-2xl font-bold font-heading ${(summary?.net || 0) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
            AED {fmt(Math.abs(summary?.net))}
          </p>
          <p className="text-xs text-slate-400 mt-1">Gross minus fuel costs</p>
        </motion.div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-5">
        <button onClick={() => setTab('records')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'records' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          Records ({total})
        </button>
        <button onClick={() => setTab('add')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'add' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          Add Record
        </button>
      </div>

      {/* Records Tab */}
      {tab === 'records' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {/* Filters */}
          <div className="card p-4 mb-4">
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="label text-xs">Business Unit</label>
                <Sel value={filterBU} onChange={setFilterBU} options={BUS} placeholder="All BUs" />
              </div>
              <div>
                <label className="label text-xs">Import / Export</label>
                <Sel value={filterIE} onChange={setFilterIE} options={['Import', 'Export']} placeholder="All" />
              </div>
              <div>
                <label className="label text-xs">From Date</label>
                <input className="input text-sm" type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
              </div>
              <div>
                <label className="label text-xs">To Date</label>
                <input className="input text-sm" type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} />
              </div>
            </div>
            {(filterBU || filterIE || filterFrom || filterTo) && (
              <button
                onClick={() => { setFilterBU(''); setFilterIE(''); setFilterFrom(''); setFilterTo(''); setPage(1); }}
                className="mt-2 text-xs text-brand-600 font-medium hover:text-brand-700"
              >
                Clear filters
              </button>
            )}
          </div>

          {error && <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">{error}</div>}

          {loading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : records.length === 0 ? (
            <div className="card p-10 text-center">
              <TrendingDown className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No savings records yet</p>
              <p className="text-sm text-slate-400 mt-1">Add records manually or import from CSV</p>
              <button onClick={() => setTab('add')} className="mt-4 btn-primary text-sm">
                <Plus className="w-4 h-4 inline mr-1" /> Add First Record
              </button>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      {['Date', 'BU', 'Port', 'Reference', 'I/E', 'Prev. Agent', 'Curr. Agent', 'Old Fee', 'New Fee', 'Savings', 'Description', ''].map(h => (
                        <th key={h} className="text-left px-3 py-2.5 font-semibold text-xs text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {records.map((r, i) => (
                      <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                        <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{r.date}</td>
                        <td className="px-3 py-2.5 text-slate-700 font-medium">{r.business_unit || '—'}</td>
                        <td className="px-3 py-2.5 text-slate-600">{r.port || '—'}</td>
                        <td className="px-3 py-2.5 text-slate-600 font-mono text-xs">{r.reference_number || '—'}</td>
                        <td className="px-3 py-2.5">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${r.import_export === 'Export' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                            {r.import_export || '—'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-slate-600 text-xs">{r.previous_agent || '—'}</td>
                        <td className="px-3 py-2.5 text-slate-600 text-xs">{r.current_agent || '—'}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-slate-600">{fmt(r.old_fee)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-slate-600">{fmt(r.new_fee)}</td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-700">{fmt(r.savings)}</td>
                        <td className="px-3 py-2.5 text-slate-500 text-xs max-w-[160px] truncate">{r.description || '—'}</td>
                        <td className="px-3 py-2.5">
                          <button onClick={() => setConfirmDelete(r.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-brand-50 border-t-2 border-brand-200">
                      <td colSpan={7} className="px-3 py-2.5 font-bold text-brand-700 text-sm">TOTAL ({total} records)</td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-brand-700">
                        {fmt(records.reduce((s, r) => s + (r.old_fee || 0), 0))}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-brand-700">
                        {fmt(records.reduce((s, r) => s + (r.new_fee || 0), 0))}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-700 text-base">
                        {fmt(records.reduce((s, r) => s + (r.savings || 0), 0))}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Pagination */}
              {total > 50 && (
                <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
                  <span>Showing {Math.min((page - 1) * 50 + 1, total)}–{Math.min(page * 50, total)} of {total}</span>
                  <div className="flex gap-2">
                    <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary text-xs px-2.5 py-1.5 disabled:opacity-40">Prev</button>
                    <button disabled={page * 50 >= total} onClick={() => setPage(p => p + 1)} className="btn-secondary text-xs px-2.5 py-1.5 disabled:opacity-40">Next</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>
      )}

      {/* Add Record Tab */}
      {tab === 'add' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl">
          <div className="card p-6">
            <h2 className="font-heading font-bold text-slate-800 mb-5">New Savings Record</h2>

            {formError && <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">{formError}</div>}

            {/* Link to existing shipping expense */}
            {shippingExpenses.length > 0 && (
              <div className="mb-5 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                  <Link2 className="w-4 h-4 text-brand-500" />
                  Auto-fill from a recorded shipping bill (optional)
                </label>
                <div className="relative">
                  <select
                    value={linkedExpense}
                    onChange={e => handleLinkExpense(e.target.value)}
                    className="input appearance-none pr-8 cursor-pointer text-sm"
                  >
                    <option value="">— Pick a shipping expense to auto-fill —</option>
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
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
                {linkedExpense && (
                  <p className="text-xs text-brand-600 mt-1.5 font-medium">
                    ✓ Date, port, BU, current agent and new fee filled from the selected bill. Only enter the old agent fee below.
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Date *</label>
                <input className="input" type="date" value={form.date} onChange={e => setF('date', e.target.value)} />
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
                <input className="input" value={form.reference_number} onChange={e => setF('reference_number', e.target.value)} placeholder="REF-001" />
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
                <input className="input" type="number" step="0.01" min="0" value={form.old_fee} onChange={e => setF('old_fee', e.target.value)} placeholder="225.00" />
                {agentSuggestion != null && !form.old_fee && (
                  <button
                    type="button"
                    onClick={() => setF('old_fee', String(agentSuggestion))}
                    className="mt-1 text-xs text-brand-600 hover:text-brand-700 font-medium"
                  >
                    ↑ Use AED {fmt(agentSuggestion)} from past records
                  </button>
                )}
              </div>
              <div>
                <label className="label">New Fee (AED)</label>
                <input className="input" type="number" step="0.01" min="0" value={form.new_fee} onChange={e => setF('new_fee', e.target.value)} placeholder="43.00" />
              </div>

              {computedSavings !== null && (
                <div className="col-span-2 p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                  <p className="text-sm font-semibold text-emerald-700">
                    Savings = AED {fmt(computedSavings)}
                    {computedSavings < 0 && <span className="text-red-600 ml-2">(negative — new fee exceeds old fee)</span>}
                  </p>
                </div>
              )}

              <div>
                <label className="label">Project Name</label>
                <input className="input" value={form.project_name} onChange={e => setF('project_name', e.target.value)} placeholder="Project / cargo name" />
              </div>
              <div className="col-span-2">
                <label className="label">Description</label>
                <textarea className="input resize-none" rows={2} value={form.description} onChange={e => setF('description', e.target.value)} placeholder="Additional details about the clearance..." />
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100">
              <button onClick={() => { setTab('records'); setForm(EMPTY_FORM); setFormError(''); setLinkedExpense(''); }} className="btn-secondary">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                {saving
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</>
                  : 'Save Record'
                }
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
