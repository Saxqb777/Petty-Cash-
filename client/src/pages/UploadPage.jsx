import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, X, CheckCircle, AlertCircle, ChevronDown, PenLine, Scan } from 'lucide-react';
import { api } from '../utils/api';

const CATEGORIES = [
  'Fuel & Transport', 'Parking', 'Customs & Clearance', 'Printing & Photocopy',
  'Materials & Supplies', 'Food & Beverages', 'Office Supplies',
  'Accommodation & Travel', 'Medical', 'Miscellaneous'
];

const BUS = ['AAFB', 'Al Foah', 'GMFF', 'BMB', 'Other'];

const EMPTY_FORM = {
  invoice_number: '', vendor_name: '', amount: '', currency: 'AED',
  date: new Date().toISOString().split('T')[0], category: 'Miscellaneous',
  business_unit: '', payment_method: 'Cash', purpose: '', submitted_by: '',
  notes: '', image_path: ''
};

function Field({ label, children }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function Select({ value, onChange, options, placeholder = 'Select...' }) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
        className="input appearance-none pr-8 cursor-pointer">
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
    </div>
  );
}

export default function UploadPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('upload'); // 'upload' | 'manual'
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null); // null | 'pdf' | objectURL
  const [fileName, setFileName] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [stage, setStage] = useState('idle'); // idle | extracted | manual
  const fileRef = useRef();

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    setError('');
    setUploading(true);
    setFileName(file.name);
    const isPdf = file.name.toLowerCase().endsWith('.pdf');
    setPreview(isPdf ? 'pdf' : URL.createObjectURL(file));
    try {
      const result = await api.uploadBill(file);
      const p = result.parsed || {};
      setForm({
        invoice_number: p.invoice_number || '',
        vendor_name: p.vendor_name || '',
        amount: p.amount?.toString() || '',
        currency: p.currency || 'AED',
        date: p.date || new Date().toISOString().split('T')[0],
        category: p.category || 'Miscellaneous',
        business_unit: p.business_unit || '',
        payment_method: p.payment_method || 'Cash',
        purpose: p.purpose || '',
        submitted_by: p.submitted_by || '',
        notes: p.notes || '',
        image_path: result.image_path || ''
      });
      setStage('extracted');
    } catch (e) {
      setError(`Upload failed: ${e.message}`);
      setPreview(null);
    } finally {
      setUploading(false);
    }
  }, []);

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleSave = async () => {
    if (!form.vendor_name || !form.amount || !form.date) {
      setError('Vendor name, amount, and date are required.'); return;
    }
    setSaving(true); setError('');
    try {
      await api.createRecord(form);
      setSaved(true);
      setTimeout(() => navigate('/records'), 1200);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setForm(EMPTY_FORM); setPreview(null); setFileName(''); setStage('idle'); setSaved(false); setError('');
  };

  const FormBody = () => (
    <div className="grid grid-cols-2 gap-4">
      <Field label="Vendor / Shop Name">
        <input className="input" value={form.vendor_name} onChange={e => set('vendor_name', e.target.value)} placeholder="e.g. ADNOC, Carrefour" />
      </Field>
      <Field label="Invoice Number">
        <input className="input" value={form.invoice_number} onChange={e => set('invoice_number', e.target.value)} placeholder="Receipt #" />
      </Field>
      <Field label="Amount">
        <div className="flex gap-2">
          <input className="input flex-1" type="number" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00" />
          <Select value={form.currency} onChange={v => set('currency', v)} options={['AED', 'USD', 'EUR', 'GBP']} placeholder="AED" />
        </div>
      </Field>
      <Field label="Date">
        <input className="input" type="date" value={form.date} onChange={e => set('date', e.target.value)} />
      </Field>
      <Field label="Category">
        <Select value={form.category} onChange={v => set('category', v)} options={CATEGORIES} placeholder="Select category" />
      </Field>
      <Field label="Business Unit">
        <Select value={form.business_unit} onChange={v => set('business_unit', v)} options={BUS} placeholder="Select BU" />
      </Field>
      <Field label="Payment Method">
        <Select value={form.payment_method} onChange={v => set('payment_method', v)} options={['Cash', 'Card']} placeholder="Cash" />
      </Field>
      <Field label="Submitted By">
        <input className="input" value={form.submitted_by} onChange={e => set('submitted_by', e.target.value)} placeholder="Name" />
      </Field>
      <Field label="Purpose / Description">
        <input className="input col-span-2" value={form.purpose} onChange={e => set('purpose', e.target.value)} placeholder="e.g. Vehicle fuel for Abu Dhabi airport run" />
      </Field>
      <Field label="Notes">
        <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any additional info..." />
      </Field>
    </div>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Add Expense</h1>
        <p className="text-sm text-gray-500 mt-0.5">Upload a bill for AI extraction, or enter details manually</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-6">
        <button
          onClick={() => { setTab('upload'); reset(); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'upload' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Scan className="w-4 h-4" /> Upload & Scan
        </button>
        <button
          onClick={() => { setTab('manual'); reset(); setStage('manual'); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'manual' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <PenLine className="w-4 h-4" /> Manual Entry
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-sm text-red-600">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {saved && (
        <div className="mb-4 p-4 bg-brand-50 border border-brand-100 rounded-xl flex items-center gap-3 text-sm text-brand-700">
          <CheckCircle className="w-4 h-4" />
          Expense saved! Redirecting to records...
        </div>
      )}

      {/* UPLOAD TAB */}
      {tab === 'upload' && (
        <div className={`grid ${stage === 'extracted' ? 'grid-cols-5' : 'grid-cols-1'} gap-6`}>
          {/* Drop Zone / Preview */}
          <div className={stage === 'extracted' ? 'col-span-2' : 'col-span-1'}>
            {!preview ? (
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`card border-2 border-dashed cursor-pointer transition-all duration-200 flex flex-col items-center justify-center p-12 min-h-64
                  ${dragOver ? 'border-brand-500 bg-brand-50 scale-[1.01]' : 'border-gray-200 hover:border-brand-300 hover:bg-brand-50/50'}`}
              >
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-colors ${dragOver ? 'bg-brand-100' : 'bg-gray-100'}`}>
                  {uploading
                    ? <div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                    : <Upload className={`w-7 h-7 ${dragOver ? 'text-brand-600' : 'text-gray-400'}`} />
                  }
                </div>
                <p className="text-base font-semibold text-gray-700 mb-1">
                  {uploading ? 'Processing bill...' : 'Drop your bill here'}
                </p>
                <p className="text-sm text-gray-400 text-center">
                  {uploading ? 'OCR scanning + AI extraction in progress' : 'or click to browse · JPG, PNG, PDF up to 15MB'}
                </p>
                <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden"
                  onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
              </div>
            ) : (
              <div className="card overflow-hidden">
                <div className="relative">
                  {preview === 'pdf' ? (
                    <div className="flex flex-col items-center justify-center py-10 px-6 bg-gray-50">
                      <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mb-3">
                        <FileText className="w-7 h-7 text-red-500" />
                      </div>
                      <p className="text-sm font-semibold text-gray-700 text-center truncate max-w-full">{fileName}</p>
                      <p className="text-xs text-gray-400 mt-1">PDF — Claude will read it directly</p>
                    </div>
                  ) : (
                    <img src={preview} alt="Bill preview" className="w-full object-contain max-h-80" />
                  )}
                  <button onClick={reset} className="absolute top-2 right-2 w-7 h-7 bg-white rounded-full shadow flex items-center justify-center hover:bg-red-50">
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
                {stage === 'extracted' && (
                  <div className="p-3 bg-brand-50 border-t border-brand-100">
                    <div className="flex items-center gap-2 text-xs text-brand-700 font-medium">
                      <CheckCircle className="w-3.5 h-3.5" />
                      AI extracted fields — review before saving
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Extracted Form */}
          {stage === 'extracted' && (
            <div className="col-span-3 card p-6 fade-in">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-semibold text-gray-800">Review Extracted Data</h2>
                <span className="badge badge-green">AI Extracted</span>
              </div>
              <FormBody />
              <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
                <button onClick={reset} className="btn-secondary">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</> : 'Save Expense'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MANUAL TAB */}
      {tab === 'manual' && (
        <div className="card p-6 slide-up">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-gray-800">Manual Expense Entry</h2>
            <span className="badge badge-gray">Manual</span>
          </div>
          <FormBody />
          <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
            <button onClick={reset} className="btn-secondary">Clear</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</> : 'Save Expense'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
