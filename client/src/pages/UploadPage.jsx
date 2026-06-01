import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, FileText, X, CheckCircle, AlertCircle,
  ChevronDown, PenLine, Scan, Fuel, Ship, LayoutGrid,
  Plus, Trash2, ArrowLeft, MapPin, PiggyBank
} from 'lucide-react';
import { api } from '../utils/api';
import { useToast } from '../components/Toast';

const CATEGORIES = [
  'Fuel & Transport', 'Parking', 'Customs & Clearance', 'Printing & Photocopy',
  'Materials & Supplies', 'Food & Beverages', 'Office Supplies',
  'Accommodation & Travel', 'Medical', 'Miscellaneous'
];
const BUS = ['AAFB', 'Al Foah', 'GMFF', 'BMB', 'Other'];
const PORTS = ['AUH', 'DXB', 'AJM', 'SHJ', 'Other'];
const CURRENCIES = ['AED', 'USD', 'EUR', 'GBP', 'SAR', 'QAR', 'KWD', 'OMR'];

const SHIPPING_CHARGES = [
  'Ocean Freight', 'THC (Terminal Handling)', 'Demurrage', 'Detention',
  'Documentation Fee', 'BOE / Customs Clearance', 'MOIAT Fee', 'Agent Fee',
  'Customs Duty', 'Inspection Fee', 'Transport / Delivery', 'Port Charges', 'Local Charges'
];

const EMPTY_ADNOC = {
  expense_type: 'adnoc', vendor_name: 'ADNOC', category: 'Fuel & Transport',
  invoice_number: '', amount: '', currency: 'AED',
  date: new Date().toISOString().split('T')[0],
  business_unit: '', payment_method: 'Card',
  purpose: '', submitted_by: '', notes: '', image_path: ''
};

const EMPTY_SHIPPING = {
  expense_type: 'shipping', vendor_name: '', category: 'Customs & Clearance',
  invoice_number: '', bl_number: '', container_number: '',
  port: '', shipment_type: 'Import',
  currency: 'AED', date: new Date().toISOString().split('T')[0],
  business_unit: '', submitted_by: '', notes: '', image_path: ''
};

const EMPTY_GENERAL = {
  expense_type: 'general', vendor_name: '', category: 'Miscellaneous',
  invoice_number: '', amount: '', currency: 'AED',
  date: new Date().toISOString().split('T')[0],
  business_unit: '', payment_method: 'Cash',
  purpose: '', submitted_by: '', notes: '', image_path: ''
};

const fmt = (n) => parseFloat(n || 0).toFixed(2);

function Field({ label, children, span2 = false }) {
  return (
    <div className={span2 ? 'col-span-2' : ''}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function Sel({ value, onChange, options, placeholder = 'Select...' }) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)} className="input appearance-none pr-8 cursor-pointer">
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
    </div>
  );
}

// Chip input component for BLs / containers
function ChipInput({ chips, onChange, placeholder }) {
  const [val, setVal] = useState('');
  const add = () => {
    const t = val.trim().toUpperCase();
    if (t && !chips.includes(t)) { onChange([...chips, t]); setVal(''); }
  };
  const remove = (chip) => onChange(chips.filter(c => c !== chip));
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {chips.map(c => (
          <span key={c} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md text-xs font-mono font-medium border border-blue-100">
            {c}
            <button onClick={() => remove(c)} className="text-blue-400 hover:text-red-500">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="input flex-1 text-sm font-mono"
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={placeholder}
        />
        <button type="button" onClick={add} className="btn-secondary text-xs flex items-center gap-1 flex-shrink-0 px-2.5">
          <Plus className="w-3 h-3" /> Add
        </button>
      </div>
    </div>
  );
}

// Currency amount with AED preview
function CurrencyAmount({ amount, currency, onAmount, onCurrency, rates }) {
  const rate = rates[currency] || 1;
  const aedPreview = currency !== 'AED' && amount ? parseFloat(amount) * rate : null;
  return (
    <div>
      <div className="flex gap-2">
        <input
          className="input flex-1"
          type="number"
          step="0.01"
          value={amount}
          onChange={e => onAmount(e.target.value)}
          placeholder="0.00"
        />
        <div className="relative w-28 flex-shrink-0">
          <select
            value={currency}
            onChange={e => onCurrency(e.target.value)}
            className="input appearance-none pr-7 cursor-pointer"
          >
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        </div>
      </div>
      {aedPreview !== null && (
        <p className="text-xs text-amber-600 mt-1 font-medium">
          ≈ AED {aedPreview.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          <span className="text-gray-400 font-normal ml-1">(rate: {rate})</span>
        </p>
      )}
    </div>
  );
}

// ─── ADNOC Form ───────────────────────────────────────────────────────────────
function AdnocForm({ form, set, rates }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <Field label="Invoice / Receipt No.">
        <input className="input" value={form.invoice_number} onChange={e => set('invoice_number', e.target.value)} placeholder="e.g. 15051" />
      </Field>
      <Field label="Date">
        <input className="input" type="date" value={form.date} onChange={e => set('date', e.target.value)} />
      </Field>
      <Field label="Amount">
        <CurrencyAmount
          amount={form.amount}
          currency={form.currency}
          onAmount={v => set('amount', v)}
          onCurrency={v => set('currency', v)}
          rates={rates}
        />
      </Field>
      <Field label="Payment Method">
        <Sel value={form.payment_method} onChange={v => set('payment_method', v)} options={['Card', 'Cash']} />
      </Field>
      <Field label="Business Unit">
        <Sel value={form.business_unit} onChange={v => set('business_unit', v)} options={BUS} placeholder="Select BU" />
      </Field>
      <Field label="Submitted By">
        <input className="input" value={form.submitted_by} onChange={e => set('submitted_by', e.target.value)} placeholder="Name" />
      </Field>
      <Field label="Trip / Route Details" span2>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            className="input pl-9"
            value={form.purpose}
            onChange={e => set('purpose', e.target.value)}
            placeholder="e.g. Abu Dhabi Airport — HUSKY Air Shipment Collection"
          />
        </div>
      </Field>
      <Field label="Notes (optional)" span2>
        <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any additional info..." />
      </Field>
    </div>
  );
}

// ─── Shipping Form ────────────────────────────────────────────────────────────
function ShippingForm({
  form, set, charges, setCharges, bls, onBls, containers, onContainers,
  savingsOldFee, onSavingsOldFee, savingsPrevAgent, onSavingsPrevAgent,
  recordSaving, onRecordSaving
}) {
  const total = charges.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0);

  const updateCharge = (i, field, val) =>
    setCharges(ch => ch.map((c, idx) => idx === i ? { ...c, [field]: val } : c));

  const addCustom = () =>
    setCharges(ch => [...ch, { label: '', amount: '', custom: true }]);

  const removeCharge = (i) => setCharges(ch => ch.filter((_, idx) => idx !== i));

  // new_fee = total bill paid (what you now pay instead of the old agent)
  const oldFeeNum = parseFloat(savingsOldFee) || 0;
  const saving = oldFeeNum > 0 && total > 0 ? oldFeeNum - total : null;

  return (
    <div className="space-y-5">
      {/* Header fields */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Shipping Line / Agent">
          <input className="input" value={form.vendor_name} onChange={e => set('vendor_name', e.target.value)} placeholder="e.g. MSC, Maersk, Al Gharbeya" />
        </Field>
        <Field label="Invoice / Reference No.">
          <input className="input" value={form.invoice_number} onChange={e => set('invoice_number', e.target.value)} placeholder="INV-12345" />
        </Field>

        <Field label="BL Numbers (Bill of Lading)" span2>
          <ChipInput
            chips={bls}
            onChange={onBls}
            placeholder="Type BL number, press Enter to add..."
          />
        </Field>

        <Field label="Container Numbers" span2>
          <ChipInput
            chips={containers}
            onChange={onContainers}
            placeholder="Type container number, press Enter to add..."
          />
        </Field>

        <Field label="Port">
          <Sel value={form.port} onChange={v => set('port', v)} options={PORTS} placeholder="Select port" />
        </Field>
        <Field label="Import / Export">
          <Sel value={form.shipment_type} onChange={v => set('shipment_type', v)} options={['Import', 'Export']} />
        </Field>
        <Field label="Date">
          <input className="input" type="date" value={form.date} onChange={e => set('date', e.target.value)} />
        </Field>
        <Field label="Business Unit">
          <Sel value={form.business_unit} onChange={v => set('business_unit', v)} options={BUS} placeholder="Select BU" />
        </Field>
        <Field label="Submitted By" span2>
          <input className="input" value={form.submitted_by} onChange={e => set('submitted_by', e.target.value)} placeholder="Name" />
        </Field>
      </div>

      {/* Charge Breakdown */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Charge Breakdown</h3>
          <p className="text-xs text-gray-400">Leave blank if not applicable</p>
        </div>
        <div className="border border-gray-100 rounded-xl overflow-hidden">
          {/* Column headers */}
          <div className="grid grid-cols-5 gap-3 px-4 py-2 bg-gray-50 border-b border-gray-100">
            <span className="col-span-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Charge Type</span>
            <span className="col-span-2 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Amount (AED)</span>
          </div>

          <div className="divide-y divide-gray-50">
            {charges.map((c, i) => (
              <div key={i} className="grid grid-cols-5 gap-3 px-4 py-2.5 items-center hover:bg-gray-50/50">
                <div className="col-span-3">
                  {c.custom ? (
                    <input
                      className="input text-sm py-1.5"
                      value={c.label}
                      onChange={e => updateCharge(i, 'label', e.target.value)}
                      placeholder="Charge name..."
                    />
                  ) : (
                    <span className="text-sm text-gray-700">{c.label}</span>
                  )}
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <input
                    className="input text-sm py-1.5 text-right"
                    type="number"
                    step="0.01"
                    min="0"
                    value={c.amount}
                    onChange={e => updateCharge(i, 'amount', e.target.value)}
                    placeholder="0.00"
                  />
                  {c.custom && (
                    <button onClick={() => removeCharge(i)} className="text-gray-300 hover:text-red-400 flex-shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Total row */}
          <div className="grid grid-cols-5 gap-3 px-4 py-3 bg-brand-50 border-t border-brand-100">
            <span className="col-span-3 text-sm font-bold text-brand-700">Total</span>
            <span className="col-span-2 text-sm font-bold text-brand-700 text-right">AED {fmt(total)}</span>
          </div>
        </div>

        <button onClick={addCustom} className="mt-2 flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 font-medium">
          <Plus className="w-3.5 h-3.5" /> Add custom charge
        </button>
      </div>

      {/* Savings Panel */}
      <div className={`rounded-xl border p-4 ${recordSaving ? 'border-green-200 bg-green-50' : 'border-gray-100 bg-gray-50'}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <PiggyBank className={`w-4 h-4 ${recordSaving ? 'text-green-600' : 'text-gray-400'}`} />
            <span className={`text-sm font-semibold ${recordSaving ? 'text-green-800' : 'text-gray-500'}`}>Clearance Savings</span>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-xs text-gray-500">Record saving</span>
            <div
              onClick={() => onRecordSaving(!recordSaving)}
              className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${recordSaving ? 'bg-green-500' : 'bg-gray-300'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${recordSaving ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
          </label>
        </div>

        {recordSaving && (
          <div className="space-y-3">
            {/* Fee comparison row */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-white rounded-lg p-2.5 border border-green-100">
                <p className="text-xs text-gray-400 mb-0.5">Previous fee</p>
                <p className="text-sm font-bold text-gray-700">
                  {oldFeeNum > 0 ? `AED ${fmt(oldFeeNum)}` : <span className="text-gray-300 font-normal">—</span>}
                </p>
              </div>
              <div className="bg-white rounded-lg p-2.5 border border-green-100">
                <p className="text-xs text-gray-400 mb-0.5">You paid</p>
                <p className="text-sm font-bold text-gray-700">
                  {total > 0 ? `AED ${fmt(total)}` : <span className="text-gray-300 font-normal">—</span>}
                </p>
              </div>
              <div className={`rounded-lg p-2.5 border ${saving !== null && saving > 0 ? 'bg-green-100 border-green-200' : saving !== null && saving < 0 ? 'bg-red-50 border-red-100' : 'bg-white border-green-100'}`}>
                <p className="text-xs text-gray-400 mb-0.5">Saving</p>
                <p className={`text-sm font-bold ${saving !== null && saving > 0 ? 'text-green-700' : saving !== null && saving < 0 ? 'text-red-600' : 'text-gray-300'}`}>
                  {saving !== null ? `AED ${fmt(saving)}` : '—'}
                </p>
              </div>
            </div>

            {/* Input fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label text-xs">Previous agent fee (AED)</label>
                <input
                  className="input text-sm"
                  type="number"
                  step="0.01"
                  min="0"
                  value={savingsOldFee}
                  onChange={e => onSavingsOldFee(e.target.value)}
                  placeholder="e.g. 225"
                />
                {oldFeeNum === 0 && (
                  <p className="text-xs text-amber-600 mt-1">Enter the fee the previous agent used to charge</p>
                )}
              </div>
              <div>
                <label className="label text-xs">Previous agent name (optional)</label>
                <input
                  className="input text-sm"
                  value={savingsPrevAgent}
                  onChange={e => onSavingsPrevAgent(e.target.value)}
                  placeholder="e.g. Al Gharbeya"
                />
              </div>
            </div>
          </div>
        )}

        {!recordSaving && (
          <p className="text-xs text-gray-400">Turn on to track how much you saved vs. the previous agent</p>
        )}
      </div>

      <Field label="Notes (optional)">
        <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any additional info..." />
      </Field>
    </div>
  );
}

// ─── General Form ─────────────────────────────────────────────────────────────
function GeneralForm({ form, set, rates }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <Field label="Vendor / Shop Name">
        <input className="input" value={form.vendor_name} onChange={e => set('vendor_name', e.target.value)} placeholder="e.g. Carrefour, Dubai Parking" />
      </Field>
      <Field label="Invoice Number">
        <input className="input" value={form.invoice_number} onChange={e => set('invoice_number', e.target.value)} placeholder="Receipt #" />
      </Field>
      <Field label="Amount">
        <CurrencyAmount
          amount={form.amount}
          currency={form.currency}
          onAmount={v => set('amount', v)}
          onCurrency={v => set('currency', v)}
          rates={rates}
        />
      </Field>
      <Field label="Date">
        <input className="input" type="date" value={form.date} onChange={e => set('date', e.target.value)} />
      </Field>
      <Field label="Category">
        <Sel value={form.category} onChange={v => set('category', v)} options={CATEGORIES} placeholder="Select category" />
      </Field>
      <Field label="Business Unit">
        <Sel value={form.business_unit} onChange={v => set('business_unit', v)} options={BUS} placeholder="Select BU" />
      </Field>
      <Field label="Payment Method">
        <Sel value={form.payment_method} onChange={v => set('payment_method', v)} options={['Cash', 'Card']} />
      </Field>
      <Field label="Submitted By">
        <input className="input" value={form.submitted_by} onChange={e => set('submitted_by', e.target.value)} placeholder="Name" />
      </Field>
      <Field label="Purpose" span2>
        <input className="input" value={form.purpose} onChange={e => set('purpose', e.target.value)} placeholder="e.g. Parking at Sky Cargo" />
      </Field>
      <Field label="Notes (optional)" span2>
        <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any additional info..." />
      </Field>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function UploadPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [expenseType, setExpenseType] = useState(null);
  const [inputMode, setInputMode] = useState('upload'); // 'upload' | 'manual'
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [fileName, setFileName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [stage, setStage] = useState('idle');
  const [uploadProgress, setUploadProgress] = useState(0);

  // Exchange rates for AED preview
  const [rates, setRates] = useState({ AED: 1, USD: 3.6725, EUR: 4.02, GBP: 4.68, SAR: 0.98, QAR: 1.01, KWD: 11.96, OMR: 9.53 });

  const [adnocForm, setAdnocForm] = useState(EMPTY_ADNOC);
  const [shippingForm, setShippingForm] = useState(EMPTY_SHIPPING);
  const [shippingCharges, setShippingCharges] = useState(
    SHIPPING_CHARGES.map(label => ({ label, amount: '' }))
  );
  const [shippingBLs, setShippingBLs] = useState([]);
  const [shippingContainers, setShippingContainers] = useState([]);
  const [generalForm, setGeneralForm] = useState(EMPTY_GENERAL);

  // Savings panel state (shipping only)
  const [savingsOldFee, setSavingsOldFee] = useState('');
  const [savingsPrevAgent, setSavingsPrevAgent] = useState('');
  const [recordSaving, setRecordSaving] = useState(true);
  const savingsLookupTimer = useRef(null);

  const fileRef = useRef();
  const progressRef = useRef(null);

  // Load exchange rates on mount
  useEffect(() => {
    api.getExchangeRates().then(r => setRates(r)).catch(() => {});
  }, []);

  const lookupOldFee = (port, ie) => {
    if (!port) return;
    clearTimeout(savingsLookupTimer.current);
    savingsLookupTimer.current = setTimeout(async () => {
      try {
        const r = await api.getAgentRates({ port, import_export: ie });
        if (r.suggested_fee != null) setSavingsOldFee(String(r.suggested_fee));
      } catch (_) {}
    }, 600);
  };

  const setField = (type, k, v) => {
    if (type === 'adnoc') setAdnocForm(f => ({ ...f, [k]: v }));
    else if (type === 'shipping') {
      setShippingForm(f => {
        const next = { ...f, [k]: v };
        if (k === 'port' || k === 'shipment_type') lookupOldFee(next.port, next.shipment_type);
        return next;
      });
    } else setGeneralForm(f => ({ ...f, [k]: v }));
  };

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    setError('');
    setUploading(true);
    setUploadProgress(2);
    setFileName(file.name);

    clearInterval(progressRef.current);
    progressRef.current = setInterval(() => {
      setUploadProgress(p => {
        if (p >= 88) return 88;
        const step = p < 40 ? 7 : p < 65 ? 4 : p < 80 ? 2 : 0.6;
        return Math.min(88, p + step);
      });
    }, 180);
    setPreview(file.name.toLowerCase().endsWith('.pdf') ? 'pdf' : URL.createObjectURL(file));

    try {
      const result = await api.uploadBill(file, expenseType);
      const p = result.parsed || {};
      if (result.parseError) setError(`Scan failed: ${result.parseError}`);

      if (expenseType === 'adnoc') {
        // Build auto notes from extra ADNOC fields
        const adnocExtra = [
          p.vehicle_plate && `Plate: ${p.vehicle_plate}`,
          p.fuel_type && `Fuel: ${p.fuel_type}`,
          p.litres && parseFloat(p.litres) > 0 && `${p.litres}L`,
          p.odometer && `Odometer: ${p.odometer}`,
        ].filter(Boolean).join(' | ');

        setAdnocForm(f => ({
          ...f,
          invoice_number: p.invoice_number || f.invoice_number,
          amount: p.amount?.toString() || f.amount,
          currency: p.currency || f.currency,
          date: p.date || f.date,
          business_unit: p.business_unit || f.business_unit,
          payment_method: p.payment_method || f.payment_method,
          purpose: p.purpose || f.purpose,
          submitted_by: p.submitted_by || f.submitted_by,
          notes: adnocExtra || f.notes,
          image_path: result.image_path || ''
        }));
      } else if (expenseType === 'shipping') {
        // Reset form completely before applying new scan — prevents merging two bills
        setShippingForm({
          ...EMPTY_SHIPPING,
          vendor_name: p.vendor_name || '',
          invoice_number: p.invoice_number || '',
          bl_number: p.bl_number || '',
          container_number: p.container_number || '',
          port: p.port || '',
          shipment_type: p.shipment_type || 'Import',
          date: p.date || EMPTY_SHIPPING.date,
          business_unit: p.business_unit || '',
          submitted_by: p.submitted_by || '',
          image_path: result.image_path || ''
        });

        // Reset BLs and containers to only what was extracted
        setShippingBLs(
          Array.isArray(p.bl_numbers) && p.bl_numbers.length > 0 ? p.bl_numbers :
          p.bl_number ? [p.bl_number] : []
        );
        setShippingContainers(
          Array.isArray(p.container_numbers) && p.container_numbers.length > 0 ? p.container_numbers :
          p.container_number ? [p.container_number] : []
        );

        // Reset charges then apply extracted line_items
        const freshCharges = SHIPPING_CHARGES.map(label => ({ label, amount: '' }));
        if (Array.isArray(p.line_items) && p.line_items.length > 0) {
          const normalize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const mapped = freshCharges.map(c => {
            const match = p.line_items.find(li => normalize(li.name) === normalize(c.label));
            return match ? { ...c, amount: match.amount > 0 ? match.amount.toString() : '' } : c;
          });
          const standardNorm = SHIPPING_CHARGES.map(normalize);
          const extras = p.line_items.filter(li => {
            const n = normalize(li.name);
            return !standardNorm.includes(n) && parseFloat(li.amount) > 0;
          });
          setShippingCharges([...mapped, ...extras.map(e => ({ label: e.name, amount: e.amount.toString(), custom: true }))]);
        } else {
          setShippingCharges(freshCharges);
        }

        // Trigger old-fee lookup from extracted port/type
        if (p.port || p.shipment_type) lookupOldFee(p.port || '', p.shipment_type || 'Import');
      } else {
        setGeneralForm(f => ({
          ...f,
          vendor_name: p.vendor_name || f.vendor_name,
          invoice_number: p.invoice_number || f.invoice_number,
          amount: p.amount?.toString() || f.amount,
          date: p.date || f.date,
          category: p.category || f.category,
          payment_method: p.payment_method || f.payment_method,
          purpose: p.purpose || f.purpose,
          submitted_by: p.submitted_by || f.submitted_by,
          image_path: result.image_path || ''
        }));
      }
      setStage('extracted');
    } catch (e) {
      toast.error(`Upload failed: ${e.message}`);
      setPreview(null);
    } finally {
      clearInterval(progressRef.current);
      setUploadProgress(100);
      setTimeout(() => { setUploadProgress(0); setUploading(false); }, 500);
    }
  }, [expenseType]);

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleSave = async () => {
    setError('');
    let payload;

    if (expenseType === 'adnoc') {
      if (!adnocForm.amount || !adnocForm.date) { setError('Amount and date are required.'); return; }
      payload = { ...adnocForm };
    } else if (expenseType === 'shipping') {
      if (!shippingForm.vendor_name || !shippingForm.date) { setError('Shipping line and date are required.'); return; }
      const filled = shippingCharges.filter(c => c.label && parseFloat(c.amount) > 0);
      const total = filled.reduce((s, c) => s + parseFloat(c.amount), 0);
      const oldFee = parseFloat(savingsOldFee) || 0;
      payload = {
        ...shippingForm,
        bl_number: shippingBLs[0] || shippingForm.bl_number || '',
        bl_numbers: shippingBLs,
        container_number: shippingContainers[0] || shippingForm.container_number || '',
        container_numbers: shippingContainers,
        amount: total || 0,
        line_items: filled,
        // Savings fields — only sent when recordSaving is on and old fee is provided
        savings_record: recordSaving && oldFee > 0,
        savings_old_fee: oldFee,
        savings_previous_agent: savingsPrevAgent || null,
      };
    } else {
      if (!generalForm.vendor_name || !generalForm.amount || !generalForm.date) {
        setError('Vendor, amount, and date are required.'); return;
      }
      payload = { ...generalForm };
    }

    setSaving(true);
    try {
      await api.createRecord(payload);
      toast.success('Expense saved successfully!');
      setTimeout(() => navigate('/records'), 900);
    } catch (e) {
      if (e.message?.includes('Duplicate')) {
        toast.error(e.message);
      } else {
        setError(e.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setExpenseType(null); setInputMode('upload'); setPreview(null); setFileName('');
    setStage('idle'); setError('');
    setAdnocForm(EMPTY_ADNOC); setShippingForm(EMPTY_SHIPPING); setGeneralForm(EMPTY_GENERAL);
    setShippingCharges(SHIPPING_CHARGES.map(label => ({ label, amount: '' })));
    setShippingBLs([]); setShippingContainers([]);
    setSavingsOldFee(''); setSavingsPrevAgent(''); setRecordSaving(true);
  };

  // ── Type Selection Screen ──────────────────────────────────────────────────
  if (!expenseType) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Add Expense</h1>
          <p className="text-sm text-gray-500 mt-1">Select the type of expense to add</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Fuel / Petrol */}
          <button
            onClick={() => setExpenseType('adnoc')}
            className="group card p-6 text-left hover:shadow-card-hover hover:border-orange-200 transition-all duration-200"
          >
            <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-orange-200 transition-colors">
              <Fuel className="w-6 h-6 text-orange-600" />
            </div>
            <h3 className="font-bold text-gray-900 mb-1">Petrol & Fuel</h3>
            <p className="text-xs text-gray-500 leading-relaxed">Fuel station receipts, vehicle expenses. Quick entry with invoice #, amount, date.</p>
          </button>

          {/* Shipping */}
          <button
            onClick={() => setExpenseType('shipping')}
            className="group card p-6 text-left hover:shadow-card-hover hover:border-blue-200 transition-all duration-200"
          >
            <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
              <Ship className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="font-bold text-gray-900 mb-1">Shipping Line Bill</h3>
            <p className="text-xs text-gray-500 leading-relaxed">THC, demurrage, detention, BOE, MOIAT, agent fee, customs duty & more.</p>
          </button>

          {/* General */}
          <button
            onClick={() => setExpenseType('general')}
            className="group card p-6 text-left hover:shadow-card-hover hover:border-brand-200 transition-all duration-200"
          >
            <div className="w-12 h-12 bg-brand-100 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-brand-200 transition-colors">
              <LayoutGrid className="w-6 h-6 text-brand-600" />
            </div>
            <h3 className="font-bold text-gray-900 mb-1">General Expense</h3>
            <p className="text-xs text-gray-500 leading-relaxed">Parking, printing, office supplies, materials, food, and any other expense.</p>
          </button>
        </div>
      </div>
    );
  }

  // ── Form Screen ────────────────────────────────────────────────────────────
  const typeConfig = {
    adnoc:    { label: 'Petrol & Fuel', icon: Fuel, color: 'text-orange-600', bg: 'bg-orange-100' },
    shipping: { label: 'Shipping Line Bill', icon: Ship, color: 'text-blue-600', bg: 'bg-blue-100' },
    general:  { label: 'General Expense', icon: LayoutGrid, color: 'text-brand-600', bg: 'bg-brand-100' }
  };
  const tc = typeConfig[expenseType];
  const TypeIcon = tc.icon;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={reset} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className={`w-8 h-8 rounded-lg ${tc.bg} flex items-center justify-center`}>
          <TypeIcon className={`w-4 h-4 ${tc.color}`} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{tc.label}</h1>
          <p className="text-xs text-gray-400">Fill in details or upload a bill to auto-extract</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-sm text-red-600">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Input mode tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-5">
        <button onClick={() => setInputMode('upload')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${inputMode === 'upload' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          <Scan className="w-4 h-4" /> Upload & Scan
        </button>
        <button onClick={() => setInputMode('manual')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${inputMode === 'manual' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          <PenLine className="w-4 h-4" /> Manual Entry
        </button>
      </div>

      <div className={`grid ${inputMode === 'upload' && stage === 'extracted' ? 'grid-cols-5' : 'grid-cols-1'} gap-6`}>
        {/* Upload Zone */}
        {inputMode === 'upload' && (
          <div className={stage === 'extracted' ? 'col-span-2' : 'col-span-1'}>
            {!preview ? (
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`card border-2 border-dashed cursor-pointer transition-all flex flex-col items-center justify-center p-12 min-h-56
                  ${dragOver ? 'border-brand-500 bg-brand-50 scale-[1.01]' : 'border-gray-200 hover:border-brand-300 hover:bg-brand-50/40'}`}
              >
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${dragOver ? 'bg-brand-100' : 'bg-gray-100'}`}>
                  {uploading
                    ? <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                    : <Upload className={`w-6 h-6 ${dragOver ? 'text-brand-600' : 'text-gray-400'}`} />
                  }
                </div>
                <p className="text-sm font-semibold text-gray-700 mb-1">
                  {uploading ? 'Scanning document...' : 'Drop your bill here'}
                </p>
                <p className="text-xs text-gray-400 text-center">or click to browse · JPG, PNG, PDF up to 15MB</p>
                <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden"
                  onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
              </div>
            ) : (
              <div className="card overflow-hidden">
                <div className="relative">
                  {preview === 'pdf' ? (
                    <div className="flex flex-col items-center justify-center py-10 bg-gray-50">
                      <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mb-2">
                        <FileText className="w-6 h-6 text-red-500" />
                      </div>
                      <p className="text-sm font-medium text-gray-700 truncate max-w-xs px-4 text-center">{fileName}</p>
                      <p className="text-xs text-gray-400 mt-1">{uploading ? 'Reading document...' : 'Document uploaded'}</p>
                    </div>
                  ) : (
                    <img src={preview} alt="Bill" className="w-full object-contain max-h-72" />
                  )}
                  {!uploading && (
                    <button onClick={() => {
                      setPreview(null); setStage('idle'); setFileName(''); setError('');
                      if (expenseType === 'adnoc') setAdnocForm(EMPTY_ADNOC);
                      else if (expenseType === 'shipping') {
                        setShippingForm(EMPTY_SHIPPING);
                        setShippingBLs([]); setShippingContainers([]);
                        setShippingCharges(SHIPPING_CHARGES.map(label => ({ label, amount: '' })));
                        setSavingsOldFee(''); setSavingsPrevAgent('');
                      } else setGeneralForm(EMPTY_GENERAL);
                    }}
                      className="absolute top-2 right-2 w-7 h-7 bg-white rounded-full shadow flex items-center justify-center hover:bg-red-50">
                      <X className="w-4 h-4 text-gray-500" />
                    </button>
                  )}
                  {/* Loading bar */}
                  {uploading && (
                    <div className="absolute bottom-0 left-0 right-0">
                      <div className="h-1 bg-gray-200">
                        <div
                          className="h-full bg-brand-500 transition-all duration-300 ease-out"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                {uploading && (
                  <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center gap-3">
                    <div className="w-3.5 h-3.5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                    <span className="text-xs text-gray-500 font-medium">Extracting details from your bill...</span>
                    <span className="ml-auto text-xs text-gray-400">{Math.round(uploadProgress)}%</span>
                  </div>
                )}
                {stage === 'extracted' && !uploading && (
                  <div className="p-3 bg-brand-50 border-t border-brand-100 flex items-center gap-2 text-xs text-brand-700 font-medium">
                    <CheckCircle className="w-3.5 h-3.5" /> Details extracted — review and save
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Form */}
        {(inputMode === 'manual' || stage === 'extracted' || inputMode === 'upload') && (
          <div className={`${inputMode === 'upload' && stage === 'extracted' ? 'col-span-3' : 'col-span-1'} card p-6 fade-in`}>
            {expenseType === 'adnoc' && (
              <AdnocForm form={adnocForm} set={(k, v) => setField('adnoc', k, v)} rates={rates} />
            )}
            {expenseType === 'shipping' && (
              <ShippingForm
                form={shippingForm}
                set={(k, v) => setField('shipping', k, v)}
                charges={shippingCharges}
                setCharges={setShippingCharges}
                bls={shippingBLs}
                onBls={setShippingBLs}
                containers={shippingContainers}
                onContainers={setShippingContainers}
                savingsOldFee={savingsOldFee}
                onSavingsOldFee={setSavingsOldFee}
                savingsPrevAgent={savingsPrevAgent}
                onSavingsPrevAgent={setSavingsPrevAgent}
                recordSaving={recordSaving}
                onRecordSaving={setRecordSaving}
              />
            )}
            {expenseType === 'general' && (
              <GeneralForm form={generalForm} set={(k, v) => setField('general', k, v)} rates={rates} />
            )}

            <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
              <button onClick={reset} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                {saving
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</>
                  : 'Save Expense'
                }
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
