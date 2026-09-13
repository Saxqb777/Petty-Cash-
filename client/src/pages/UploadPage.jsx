import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, FileText, X, CheckCircle, AlertCircle,
  ChevronDown, PenLine, Scan, Fuel, Ship, LayoutGrid,
  Plus, Trash2, ArrowLeft, MapPin, PiggyBank,
  Receipt, Briefcase, Car, Plane, Coffee, Package,
  FileSpreadsheet, Zap, Home, ShoppingBag, Truck
} from 'lucide-react';
import { api } from '../utils/api';
import { useToast } from '../components/Toast';

const CURRENCIES = ['AED', 'USD', 'EUR', 'GBP', 'SAR', 'QAR', 'KWD', 'OMR'];
const BUS = ['AAFB', 'Al Foah', 'GMFF', 'BMB', 'Other'];
const PORTS = ['AUH', 'DXB', 'AJM', 'SHJ', 'Other'];
const CATEGORIES = [
  'Fuel & Transport', 'Parking', 'Customs & Clearance', 'Printing & Photocopy',
  'Materials & Supplies', 'Food & Beverages', 'Office Supplies',
  'Accommodation & Travel', 'Medical', 'Miscellaneous'
];
const SHIPPING_CHARGES = [
  'Ocean Freight', 'THC (Terminal Handling)', 'Demurrage', 'Detention',
  'Documentation Fee', 'BOE / Customs Clearance', 'MOIAT Fee', 'Agent Fee',
  'Customs Duty', 'Inspection Fee', 'Transport / Delivery', 'Port Charges', 'Local Charges'
];

const ICON_MAP = {
  fuel: Fuel, ship: Ship, grid: LayoutGrid, receipt: Receipt,
  briefcase: Briefcase, car: Car, plane: Plane, coffee: Coffee,
  package: Package, spreadsheet: FileSpreadsheet, zap: Zap,
  home: Home, shopping: ShoppingBag, truck: Truck
};

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
const STANDARD_KEYS = new Set([
  'vendor_name','invoice_number','amount','currency','date','category',
  'business_unit','payment_method','purpose','submitted_by','notes',
  'line_items','bl_number','bl_numbers','container_number','container_numbers','port','shipment_type'
]);

const fmt = (n) => parseFloat(n || 0).toFixed(2);

/* Receipt sources arrive either as a local object URL, an absolute blob URL
   (the backend is moving to https:// storage) or a legacy relative path. */
const resolveAsset = (path) => {
  if (!path) return '';
  if (/^(https?:|blob:|data:)/i.test(path)) return path;
  return path.startsWith('/') ? path : `/uploads/${path}`;
};

const EMPTY_FLAGS = new Set();

// ─── Type roles ───────────────────────────────────────────────────────────────
function Field({ label, children, span2 = false, flag = false, hint }) {
  return (
    <div className={span2 ? 'sm:col-span-2' : ''}>
      <div className={flag ? 'border-l-2 border-flare-500 pl-3' : ''}>
        <div className="flex flex-wrap items-baseline gap-2 mb-1.5">
          <span className={`text-sm font-bold ${flag ? 'text-flare-700' : 'text-ink-700'}`}>{label}</span>
          {flag && <span className="tag-flare">Check</span>}
        </div>
        {children}
        {hint && <p className="text-sm text-ink-500 mt-1.5">{hint}</p>}
      </div>
    </div>
  );
}

function Sel({ value, onChange, options, placeholder = 'Select', mono = false }) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)} className={`select ${mono ? 'font-mono' : ''}`}>
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-500 pointer-events-none" strokeWidth={2} />
    </div>
  );
}

function ChipInput({ chips, onChange, placeholder, label }) {
  const [val, setVal] = useState('');
  const add = () => {
    const t = val.trim().toUpperCase();
    if (t && !chips.includes(t)) { onChange([...chips, t]); setVal(''); }
  };
  const remove = (chip) => onChange(chips.filter(c => c !== chip));
  return (
    <div>
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {chips.map(c => (
            <span key={c} className="inline-flex items-center gap-2 pl-2 pr-1 py-0.5 bg-white border-2 border-ink-900 font-mono text-xs text-ink-900">
              {c}
              <button type="button" onClick={() => remove(c)} aria-label={`Remove ${c}`}
                className="text-ink-500 hover:text-flare-700 transition-colors duration-[120ms]">
                <X className="w-3 h-3" strokeWidth={2.5} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input className="input flex-1 font-mono" value={val} onChange={e => setVal(e.target.value)}
          aria-label={label || placeholder}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} placeholder={placeholder} />
        <button type="button" onClick={add} className="btn-ghost btn-sm flex-shrink-0">
          <Plus className="w-3.5 h-3.5" strokeWidth={2.5} /> Add
        </button>
      </div>
    </div>
  );
}

function CurrencyAmount({ amount, currency, onAmount, onCurrency, rates }) {
  const rate = rates[currency] || 1;
  const aedPreview = currency !== 'AED' && amount ? parseFloat(amount) * rate : null;
  return (
    <div>
      <div className="flex gap-2">
        <input className="input flex-1 font-mono text-right" type="number" step="0.01" value={amount}
          aria-label="Amount" onChange={e => onAmount(e.target.value)} placeholder="0.00" />
        <div className="relative w-24 flex-shrink-0">
          <select value={currency} onChange={e => onCurrency(e.target.value)} className="select font-mono pr-8" aria-label="Currency">
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-500 pointer-events-none" strokeWidth={2} />
        </div>
      </div>
      {aedPreview !== null && (
        <p className="font-mono text-xs text-ink-500 mt-1.5">
          = AED {aedPreview.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          <span className="text-ink-400 ml-2">rate {rate}</span>
        </p>
      )}
    </div>
  );
}

/* A group of fields, separated by a rule rather than boxed in a card. */
function Group({ title, children, note }) {
  return (
    <section className="border-t-2 border-ink-900 pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <p className="label mb-0">{title}</p>
        {note && <p className="text-sm text-ink-500">{note}</p>}
      </div>
      {children}
    </section>
  );
}

const GRID = 'grid grid-cols-1 sm:grid-cols-2 gap-4';

// ─── Dynamic Form (for custom expense types) ──────────────────────────────────
function DynamicForm({ fields, values, onChange, rates, flags = EMPTY_FLAGS }) {
  const set = (key, val) => onChange({ ...values, [key]: val });

  return (
    <Group title="Details">
      <div className={GRID}>
        {fields.filter(f => f.type !== 'charges').map(field => {
          const wide = ['textarea', 'chips'].includes(field.type) ||
            ['purpose', 'notes', 'description'].includes(field.key);
          return (
            <Field key={field.key} label={field.label} span2={wide} flag={flags.has(field.key)}>
              {field.type === 'currency' ? (
                <CurrencyAmount
                  amount={values.amount || ''}
                  currency={values.currency || 'AED'}
                  onAmount={v => set('amount', v)}
                  onCurrency={v => set('currency', v)}
                  rates={rates}
                />
              ) : field.type === 'select' ? (
                <Sel value={values[field.key] || ''} onChange={v => set(field.key, v)}
                  options={field.options || []} placeholder={field.placeholder || `Select ${field.label}`} />
              ) : field.type === 'date' ? (
                <input className="input font-mono" type="date" aria-label={field.label}
                  value={values[field.key] || ''} onChange={e => set(field.key, e.target.value)} />
              ) : field.type === 'textarea' ? (
                <textarea className="textarea resize-none" rows={2} value={values[field.key] || ''} aria-label={field.label}
                  onChange={e => set(field.key, e.target.value)} placeholder={field.placeholder || ''} />
              ) : field.type === 'number' ? (
                <input className="input font-mono text-right" type="number" step="0.01" value={values[field.key] || ''}
                  aria-label={field.label}
                  onChange={e => set(field.key, e.target.value)} placeholder={field.placeholder || '0'} />
              ) : field.type === 'chips' ? (
                <ChipInput chips={values[field.key] || []} label={field.label}
                  onChange={v => set(field.key, v)} placeholder={field.placeholder || 'Add'} />
              ) : (
                <input className="input" value={values[field.key] || ''} aria-label={field.label}
                  onChange={e => set(field.key, e.target.value)} placeholder={field.placeholder || ''} />
              )}
            </Field>
          );
        })}
      </div>
    </Group>
  );
}

// ─── ADNOC Form ───────────────────────────────────────────────────────────────
function AdnocForm({ form, set, rates, flags = EMPTY_FLAGS }) {
  return (
    <div className="space-y-6">
      <Group title="Receipt">
        <div className={GRID}>
          <Field label="Invoice / receipt no." flag={flags.has('invoice_number')}>
            <input className="input font-mono" value={form.invoice_number} aria-label="Invoice or receipt number"
              onChange={e => set('invoice_number', e.target.value)} placeholder="15051" />
          </Field>
          <Field label="Date" flag={flags.has('date')}>
            <input className="input font-mono" type="date" aria-label="Date" value={form.date} onChange={e => set('date', e.target.value)} />
          </Field>
          <Field label="Amount" flag={flags.has('amount') || flags.has('currency')}>
            <CurrencyAmount amount={form.amount} currency={form.currency}
              onAmount={v => set('amount', v)} onCurrency={v => set('currency', v)} rates={rates} />
          </Field>
          <Field label="Payment method" flag={flags.has('payment_method')}>
            <Sel value={form.payment_method} onChange={v => set('payment_method', v)} options={['Card', 'Cash']} />
          </Field>
        </div>
      </Group>

      <Group title="Assignment">
        <div className={GRID}>
          <Field label="Business unit" flag={flags.has('business_unit')}>
            <Sel value={form.business_unit} onChange={v => set('business_unit', v)} options={BUS} placeholder="Select BU" />
          </Field>
          <Field label="Submitted by" flag={flags.has('submitted_by')}>
            <input className="input" value={form.submitted_by} aria-label="Submitted by"
              onChange={e => set('submitted_by', e.target.value)} placeholder="Name" />
          </Field>
        </div>
      </Group>

      <Group title="Trip">
        <div className={GRID}>
          <Field label="Trip / route details" span2 flag={flags.has('purpose')}>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-500 pointer-events-none" strokeWidth={2} />
              <input className="input pl-9" value={form.purpose} aria-label="Trip or route details"
                onChange={e => set('purpose', e.target.value)}
                placeholder="Abu Dhabi Airport, HUSKY air shipment collection" />
            </div>
          </Field>
          <Field label="Notes" span2 hint="Optional">
            <textarea className="textarea resize-none" rows={2} value={form.notes} aria-label="Notes"
              onChange={e => set('notes', e.target.value)} placeholder="Anything else worth recording" />
          </Field>
        </div>
      </Group>
    </div>
  );
}

// ─── Shipping Form ────────────────────────────────────────────────────────────
function ShippingForm({
  form, set, charges, setCharges, bls, onBls, containers, onContainers,
  savingsOldFee, onSavingsOldFee, savingsPrevAgent, onSavingsPrevAgent,
  recordSaving, onRecordSaving, flags = EMPTY_FLAGS
}) {
  const total = charges.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0);
  const updateCharge = (i, field, val) => setCharges(ch => ch.map((c, idx) => idx === i ? { ...c, [field]: val } : c));
  const addCustom = () => setCharges(ch => [...ch, { label: '', amount: '', custom: true }]);
  const removeCharge = (i) => setCharges(ch => ch.filter((_, idx) => idx !== i));
  const oldFeeNum = parseFloat(savingsOldFee) || 0;
  const saving = oldFeeNum > 0 && total > 0 ? oldFeeNum - total : null;

  return (
    <div className="space-y-6">
      <Group title="Shipment">
        <div className={GRID}>
          <Field label="Shipping line / agent" flag={flags.has('vendor_name')}>
            <input className="input" value={form.vendor_name} aria-label="Shipping line or agent"
              onChange={e => set('vendor_name', e.target.value)} placeholder="MSC, Maersk, Al Gharbeya" />
          </Field>
          <Field label="Invoice / reference no." flag={flags.has('invoice_number')}>
            <input className="input font-mono" value={form.invoice_number} aria-label="Invoice or reference number"
              onChange={e => set('invoice_number', e.target.value)} placeholder="INV-12345" />
          </Field>
          <Field label="BL numbers" span2 flag={flags.has('bl_numbers') || flags.has('bl_number')}>
            <ChipInput chips={bls} onChange={onBls} label="Bill of lading number"
              placeholder="Type a BL number, press Enter" />
          </Field>
          <Field label="Container numbers" span2 flag={flags.has('container_numbers') || flags.has('container_number')}>
            <ChipInput chips={containers} onChange={onContainers} label="Container number"
              placeholder="Type a container number, press Enter" />
          </Field>
          <Field label="Port" flag={flags.has('port')}>
            <Sel value={form.port} onChange={v => set('port', v)} options={PORTS} placeholder="Select port" mono />
          </Field>
          <Field label="Import / export" flag={flags.has('shipment_type')}>
            <Sel value={form.shipment_type} onChange={v => set('shipment_type', v)} options={['Import', 'Export']} />
          </Field>
          <Field label="Date" flag={flags.has('date')}>
            <input className="input font-mono" type="date" aria-label="Date" value={form.date} onChange={e => set('date', e.target.value)} />
          </Field>
          <Field label="Business unit" flag={flags.has('business_unit')}>
            <Sel value={form.business_unit} onChange={v => set('business_unit', v)} options={BUS} placeholder="Select BU" />
          </Field>
          <Field label="Submitted by" span2 flag={flags.has('submitted_by')}>
            <input className="input" value={form.submitted_by} aria-label="Submitted by"
              onChange={e => set('submitted_by', e.target.value)} placeholder="Name" />
          </Field>
        </div>
      </Group>

      <Group title="Charge breakdown" note="Leave blank if not applicable">
        {flags.has('line_items') && (
          <p className="mb-3 border-l-2 border-flare-500 pl-3 text-sm text-flare-700">
            The extracted charges did not add up to the invoice total. Check each line.
          </p>
        )}
        <div className="overflow-x-auto border-2 border-ink-900">
          <div className="min-w-[20rem]">
            <div className="grid grid-cols-5 gap-3 px-3 py-2 bg-ink-900">
              <span className="col-span-3 text-2xs font-bold uppercase text-paper-100">Charge type</span>
              <span className="col-span-2 text-2xs font-bold uppercase text-paper-100 text-right">Amount (AED)</span>
            </div>
            {charges.map((c, i) => (
              <div key={i} className="grid grid-cols-5 gap-3 px-3 py-2 items-center border-b border-paper-300 bg-white">
                <div className="col-span-3">
                  {c.custom ? (
                    <input className="input py-1.5" value={c.label} aria-label="Charge name"
                      onChange={e => updateCharge(i, 'label', e.target.value)} placeholder="Charge name" />
                  ) : (
                    <span className="text-sm text-ink-900">{c.label}</span>
                  )}
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <input className="input py-1.5 text-right font-mono" type="number" step="0.01" min="0"
                    aria-label={`${c.label || 'Charge'} amount`}
                    value={c.amount} onChange={e => updateCharge(i, 'amount', e.target.value)} placeholder="0.00" />
                  {c.custom && (
                    <button type="button" onClick={() => removeCharge(i)} aria-label="Remove charge"
                      className="text-ink-500 hover:text-flare-700 flex-shrink-0 transition-colors duration-[120ms]">
                      <Trash2 className="w-4 h-4" strokeWidth={2} />
                    </button>
                  )}
                </div>
              </div>
            ))}
            <div className="grid grid-cols-5 gap-3 px-3 py-2.5 bg-ink-900">
              <span className="col-span-3 text-sm font-bold text-paper-100">Total</span>
              <span className="col-span-2 font-mono text-sm text-paper-100 text-right">AED {fmt(total)}</span>
            </div>
          </div>
        </div>
        <button type="button" onClick={addCustom} className="btn-quiet btn-sm mt-3">
          <Plus className="w-3.5 h-3.5" strokeWidth={2.5} /> Add custom charge
        </button>
      </Group>

      <Group title="Clearance savings">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <PiggyBank className={`w-4 h-4 ${recordSaving ? 'text-green-700' : 'text-ink-500'}`} strokeWidth={2} />
            <span className="text-sm font-bold text-ink-900">Track what this shipment saved</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={recordSaving}
            aria-label="Record saving"
            onClick={() => onRecordSaving(!recordSaving)}
            className={`flex items-center gap-2 border-2 border-ink-900 px-1 py-1 transition-colors duration-[120ms] ${recordSaving ? 'bg-green-500' : 'bg-white'}`}
          >
            <span className={`w-4 h-4 ${recordSaving ? 'bg-ink-900 order-2' : 'bg-ink-200 order-1'}`} />
            <span className={`text-xs font-bold uppercase text-ink-900 ${recordSaving ? 'order-1 pl-1' : 'order-2 pr-1'}`}>
              {recordSaving ? 'On' : 'Off'}
            </span>
          </button>
        </div>

        {recordSaving ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="plate-sub p-3">
                <p className="label mb-1">Previous fee</p>
                <p className="font-mono text-sm text-ink-900">{oldFeeNum > 0 ? `AED ${fmt(oldFeeNum)}` : <span className="text-ink-400">--</span>}</p>
              </div>
              <div className="plate-sub p-3">
                <p className="label mb-1">You paid</p>
                <p className="font-mono text-sm text-ink-900">{total > 0 ? `AED ${fmt(total)}` : <span className="text-ink-400">--</span>}</p>
              </div>
              <div className={`p-3 border-2 ${saving !== null && saving > 0 ? 'border-green-700 bg-green-50' : saving !== null && saving < 0 ? 'border-flare-700 bg-flare-50' : 'border-paper-400 bg-white'}`}>
                <p className="label mb-1">Saving</p>
                <p className={`font-mono text-sm ${saving !== null && saving > 0 ? 'text-green-700' : saving !== null && saving < 0 ? 'text-flare-700' : 'text-ink-400'}`}>
                  {saving !== null ? `AED ${fmt(saving)}` : '--'}
                </p>
              </div>
            </div>
            <div className={GRID}>
              <Field label="Previous agent fee (AED)">
                <input className="input font-mono text-right" type="number" step="0.01" min="0" value={savingsOldFee}
                  aria-label="Previous agent fee in AED"
                  onChange={e => onSavingsOldFee(e.target.value)} placeholder="225" />
              </Field>
              <Field label="Previous agent name" hint="Optional">
                <input className="input" value={savingsPrevAgent} aria-label="Previous agent name"
                  onChange={e => onSavingsPrevAgent(e.target.value)} placeholder="Al Gharbeya" />
              </Field>
            </div>
          </div>
        ) : (
          <p className="text-sm text-ink-500">Turn this on to record how much this shipment saved against the previous agent.</p>
        )}
      </Group>

      <Group title="Notes">
        <textarea className="textarea resize-none" rows={2} value={form.notes} aria-label="Notes"
          onChange={e => set('notes', e.target.value)} placeholder="Anything else worth recording" />
      </Group>
    </div>
  );
}

// ─── General Form ─────────────────────────────────────────────────────────────
function GeneralForm({ form, set, rates, flags = EMPTY_FLAGS }) {
  return (
    <div className="space-y-6">
      <Group title="Receipt">
        <div className={GRID}>
          <Field label="Vendor / shop name" flag={flags.has('vendor_name')}>
            <input className="input" value={form.vendor_name} aria-label="Vendor or shop name"
              onChange={e => set('vendor_name', e.target.value)} placeholder="Carrefour, Dubai Parking" />
          </Field>
          <Field label="Invoice number" flag={flags.has('invoice_number')}>
            <input className="input font-mono" value={form.invoice_number} aria-label="Invoice number"
              onChange={e => set('invoice_number', e.target.value)} placeholder="Receipt no." />
          </Field>
          <Field label="Amount" flag={flags.has('amount') || flags.has('currency')}>
            <CurrencyAmount amount={form.amount} currency={form.currency}
              onAmount={v => set('amount', v)} onCurrency={v => set('currency', v)} rates={rates} />
          </Field>
          <Field label="Date" flag={flags.has('date')}>
            <input className="input font-mono" type="date" aria-label="Date" value={form.date} onChange={e => set('date', e.target.value)} />
          </Field>
        </div>
      </Group>

      <Group title="Classification">
        <div className={GRID}>
          <Field label="Category" flag={flags.has('category')}>
            <Sel value={form.category} onChange={v => set('category', v)} options={CATEGORIES} placeholder="Select category" />
          </Field>
          <Field label="Business unit" flag={flags.has('business_unit')}>
            <Sel value={form.business_unit} onChange={v => set('business_unit', v)} options={BUS} placeholder="Select BU" />
          </Field>
          <Field label="Payment method" flag={flags.has('payment_method')}>
            <Sel value={form.payment_method} onChange={v => set('payment_method', v)} options={['Cash', 'Card']} />
          </Field>
          <Field label="Submitted by" flag={flags.has('submitted_by')}>
            <input className="input" value={form.submitted_by} aria-label="Submitted by"
              onChange={e => set('submitted_by', e.target.value)} placeholder="Name" />
          </Field>
        </div>
      </Group>

      <Group title="Detail">
        <div className={GRID}>
          <Field label="Purpose" span2 flag={flags.has('purpose')}>
            <input className="input" value={form.purpose} aria-label="Purpose"
              onChange={e => set('purpose', e.target.value)} placeholder="Parking at Sky Cargo" />
          </Field>
          <Field label="Notes" span2 hint="Optional">
            <textarea className="textarea resize-none" rows={2} value={form.notes} aria-label="Notes"
              onChange={e => set('notes', e.target.value)} placeholder="Anything else worth recording" />
          </Field>
        </div>
      </Group>
    </div>
  );
}

// ─── Extraction states ────────────────────────────────────────────────────────
/* Two inks crossing: the mark that says the plates are being pulled. */
function OverprintMark({ size = 'w-6 h-6' }) {
  return (
    <span className={`relative block ${size} flex-shrink-0`} aria-hidden="true">
      <span className="absolute left-0 top-0 w-4 h-4 bg-blue-600 overprint" />
      <span className="absolute right-0 bottom-0 w-4 h-4 bg-flare-500 overprint animate-pulse" />
    </span>
  );
}

const SKELETON_ROWS = ['w-3/4', 'w-1/2', 'w-2/3', 'w-1/3', 'w-5/6', 'w-1/2'];

function ExtractionPanel({ fileName, progress }) {
  return (
    <div className="plate p-4 sm:p-5 animate-fade-in">
      <div className="flex items-center gap-3 border-b-2 border-ink-900 pb-3 mb-4">
        <OverprintMark />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink-900">Reading the document</p>
          <p className="meta truncate">{fileName}</p>
        </div>
        <span className="font-mono text-sm text-ink-900 tabular-nums">{Math.round(progress)}%</span>
      </div>

      <div className="h-3 border-2 border-ink-900 bg-white mb-5">
        <div className="h-full bg-blue-600 transition-[width] duration-[120ms] ease-out" style={{ width: `${progress}%` }} />
      </div>

      <p className="label">Fields being pulled</p>
      <div className="border-t border-paper-300">
        {SKELETON_ROWS.map((w, i) => (
          <div key={i} className="flex items-center gap-4 py-3 border-b border-paper-300">
            <div className="skeleton h-2.5 w-20 flex-shrink-0" />
            <div className={`skeleton h-3.5 ${w}`} />
          </div>
        ))}
      </div>

      <p className="text-sm text-ink-500 mt-4">
        The vendor, amount, date and reference numbers are read straight off the page. Anything read with low
        confidence is marked in orange for you to check.
      </p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function UploadPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [expenseTypes, setExpenseTypes] = useState([]);
  const [typesLoading, setTypesLoading] = useState(true);
  const [selectedType, setSelectedType] = useState(null);
  const [inputMode, setInputMode] = useState('upload');
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [fileName, setFileName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [stage, setStage] = useState('idle');
  const [uploadProgress, setUploadProgress] = useState(0);

  // Extraction review signals from the backend validator
  const [flags, setFlags] = useState(EMPTY_FLAGS);
  const [needsReview, setNeedsReview] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  // SHA-256 of the uploaded file, returned by /api/upload. Carried through to
  // the save so the server's exact-file duplicate check has something to match.
  const [fileHash, setFileHash] = useState('');

  const [rates, setRates] = useState({ AED: 1, USD: 3.6725, EUR: 4.02, GBP: 4.68, SAR: 0.98, QAR: 1.01, KWD: 11.96, OMR: 9.53 });

  // Built-in type form state
  const [adnocForm, setAdnocForm] = useState(EMPTY_ADNOC);
  const [shippingForm, setShippingForm] = useState(EMPTY_SHIPPING);
  const [shippingCharges, setShippingCharges] = useState(SHIPPING_CHARGES.map(label => ({ label, amount: '' })));
  const [shippingBLs, setShippingBLs] = useState([]);
  const [shippingContainers, setShippingContainers] = useState([]);
  const [generalForm, setGeneralForm] = useState(EMPTY_GENERAL);

  // Savings panel state
  const [savingsOldFee, setSavingsOldFee] = useState('');
  const [savingsPrevAgent, setSavingsPrevAgent] = useState('');
  const [recordSaving, setRecordSaving] = useState(true);
  const savingsLookupTimer = useRef(null);

  // Custom type form state
  const [customForm, setCustomForm] = useState({});

  const fileRef = useRef();
  const progressRef = useRef(null);

  useEffect(() => {
    Promise.all([
      api.getExpenseTypes().catch(() => []),
      api.getExchangeRates().catch(() => null)
    ]).then(([types, ratesData]) => {
      setExpenseTypes(types);
      setTypesLoading(false);
      if (ratesData) setRates(ratesData);
    });
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
    setFlags(EMPTY_FLAGS);
    setNeedsReview(false);
    setReviewNotes('');
    setFileHash('');

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
      const result = await api.uploadBill(file, selectedType.slug);
      const p = result.parsed || {};
      if (result.parseError) setError(`Scan failed: ${result.parseError}`);

      setFlags(new Set(Array.isArray(p.low_confidence_fields) ? p.low_confidence_fields : []));
      setNeedsReview(!!p.needs_review);
      setReviewNotes(p.review_notes || '');
      setFileHash(result.file_hash || '');

      if (selectedType.slug === 'adnoc') {
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
      } else if (selectedType.slug === 'shipping') {
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
        setShippingBLs(Array.isArray(p.bl_numbers) && p.bl_numbers.length ? p.bl_numbers : p.bl_number ? [p.bl_number] : []);
        setShippingContainers(Array.isArray(p.container_numbers) && p.container_numbers.length ? p.container_numbers : p.container_number ? [p.container_number] : []);
        const freshCharges = SHIPPING_CHARGES.map(label => ({ label, amount: '' }));
        if (Array.isArray(p.line_items) && p.line_items.length > 0) {
          const normalize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const mapped = freshCharges.map(c => {
            const match = p.line_items.find(li => normalize(li.name) === normalize(c.label));
            return match ? { ...c, amount: match.amount > 0 ? match.amount.toString() : '' } : c;
          });
          const standardNorm = SHIPPING_CHARGES.map(normalize);
          const extras = p.line_items.filter(li => !standardNorm.includes(normalize(li.name)) && parseFloat(li.amount) > 0);
          setShippingCharges([...mapped, ...extras.map(e => ({ label: e.name, amount: e.amount.toString(), custom: true }))]);
        } else {
          setShippingCharges(freshCharges);
        }
        if (p.port || p.shipment_type) lookupOldFee(p.port || '', p.shipment_type || 'Import');
      } else if (selectedType.is_builtin) {
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
      } else {
        // Custom type: merge extracted fields into customForm
        const merged = { ...customForm };
        Object.entries(p).forEach(([k, v]) => {
          if (k !== 'confidence' && k !== 'needs_review' && k !== 'review_notes' && k !== 'low_confidence_fields') {
            if (v !== null && v !== undefined && v !== '') merged[k] = v;
          }
        });
        merged.image_path = result.image_path || '';
        setCustomForm(merged);
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
  }, [selectedType, customForm]);

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleSave = async () => {
    setError('');
    let payload;

    if (selectedType.slug === 'adnoc') {
      if (!adnocForm.amount || !adnocForm.date) { setError('Amount and date are required.'); return; }
      payload = { ...adnocForm };
    } else if (selectedType.slug === 'shipping') {
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
        savings_record: recordSaving && oldFee > 0,
        savings_old_fee: oldFee,
        savings_previous_agent: savingsPrevAgent || null,
      };
    } else if (selectedType.is_builtin) {
      if (!generalForm.vendor_name || !generalForm.amount || !generalForm.date) {
        setError('Vendor, amount, and date are required.'); return;
      }
      payload = { ...generalForm };
    } else {
      // Custom type
      const requiredFields = selectedType.fields_schema.filter(f => f.required);
      for (const f of requiredFields) {
        const val = customForm[f.key];
        if (!val || (typeof val === 'string' && !val.trim())) {
          setError(`${f.label} is required.`); return;
        }
      }
      // Split standard vs custom fields
      const standardPart = {};
      const customPart = {};
      Object.entries(customForm).forEach(([k, v]) => {
        if (STANDARD_KEYS.has(k)) standardPart[k] = v;
        else customPart[k] = v;
      });
      payload = {
        ...standardPart,
        expense_type: selectedType.slug,
        expense_type_id: selectedType.id,
        custom_fields: customPart,
        category: standardPart.category || 'Miscellaneous',
      };
    }

    if (!payload.expense_type) payload.expense_type = selectedType.slug;
    if (!payload.expense_type_id) payload.expense_type_id = selectedType.id;

    // Provenance from the scan. Without these the server's exact-file duplicate
    // check never fires (file_hash is always null) and the AI's own confidence
    // assessment is discarded, leaving needs_review false on every expense.
    // A typed-in entry has no scan behind it, so only send them when there was one.
    if (fileHash) payload.file_hash = fileHash;
    if (needsReview) {
      payload.needs_review = true;
      payload.review_notes = reviewNotes || null;
    }

    setSaving(true);
    try {
      await api.createRecord(payload);
      toast.success('Expense saved successfully!');
      setTimeout(() => navigate('/records'), 900);
    } catch (e) {
      if (e.message?.includes('Duplicate')) toast.error(e.message);
      else setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const clearReview = () => {
    setFlags(EMPTY_FLAGS); setNeedsReview(false); setReviewNotes('');
  };

  const reset = () => {
    setSelectedType(null); setInputMode('upload'); setPreview(null); setFileName('');
    setStage('idle'); setError('');
    setAdnocForm(EMPTY_ADNOC); setShippingForm(EMPTY_SHIPPING); setGeneralForm(EMPTY_GENERAL);
    setShippingCharges(SHIPPING_CHARGES.map(label => ({ label, amount: '' })));
    setShippingBLs([]); setShippingContainers([]);
    setSavingsOldFee(''); setSavingsPrevAgent(''); setRecordSaving(true);
    setCustomForm({});
    clearReview();
  };

  const clearUpload = () => {
    setPreview(null); setStage('idle'); setFileName(''); setError('');
    clearReview();
    if (selectedType?.slug === 'adnoc') setAdnocForm(EMPTY_ADNOC);
    else if (selectedType?.slug === 'shipping') {
      setShippingForm(EMPTY_SHIPPING); setShippingBLs([]); setShippingContainers([]);
      setShippingCharges(SHIPPING_CHARGES.map(label => ({ label, amount: '' })));
      setSavingsOldFee(''); setSavingsPrevAgent('');
    } else if (selectedType?.is_builtin) setGeneralForm(EMPTY_GENERAL);
    else setCustomForm({});
  };

  // ── Type Selection Screen ────────────────────────────────────────────────────
  if (!selectedType) {
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        <div className="mb-7">
          <h1 className="text-3xl w-wider text-ink-900">Add expense</h1>
          <p className="text-sm text-ink-500 mt-1">Pick the kind of receipt you are recording</p>
        </div>

        {typesLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="plate p-5">
                <div className="skeleton w-12 h-12 mb-4" />
                <div className="skeleton h-4 w-3/4 mb-2" />
                <div className="skeleton h-3 w-full" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {expenseTypes.map(type => {
              const IconComp = ICON_MAP[type.icon] || Receipt;
              return (
                <button
                  key={type.id}
                  onClick={() => {
                    setSelectedType(type);
                    // Initialize custom form with defaults
                    if (!type.is_builtin) {
                      const defaults = {};
                      defaults.date = new Date().toISOString().split('T')[0];
                      type.fields_schema.forEach(f => {
                        if (f.type === 'select' && f.options?.length) defaults[f.key] = '';
                        else if (f.type === 'currency') { defaults.amount = ''; defaults.currency = 'AED'; }
                        else defaults[f.key] = '';
                      });
                      setCustomForm(defaults);
                    }
                  }}
                  className="plate p-5 text-left hover:bg-paper-50 transition-colors duration-[120ms]"
                >
                  <div className={`w-12 h-12 flex items-center justify-center mb-4 ${type.is_builtin ? 'bg-ink-900' : 'border-2 border-ink-900 bg-white'}`}>
                    <IconComp className="w-6 h-6" strokeWidth={2}
                      style={{ color: type.is_builtin ? '#EDECE8' : type.color }} />
                  </div>
                  <h2 className="text-lg w-wide text-ink-900">{type.name}</h2>
                  <p className="text-sm text-ink-500 mt-1">{type.description}</p>
                  {!type.is_builtin && (
                    <span className="tag-blue mt-3">Custom</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Form Screen ──────────────────────────────────────────────────────────────
  const IconComp = ICON_MAP[selectedType.icon] || Receipt;
  const twoUp = inputMode === 'upload' && stage === 'extracted';

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={reset} aria-label="Back to expense types"
          className="w-9 h-9 border-2 border-ink-900 bg-white flex items-center justify-center text-ink-900 hover:bg-paper-100 transition-colors duration-[120ms] flex-shrink-0">
          <ArrowLeft className="w-4 h-4" strokeWidth={2.5} />
        </button>
        <div className={`w-9 h-9 flex items-center justify-center flex-shrink-0 ${selectedType.is_builtin ? 'bg-ink-900' : 'border-2 border-ink-900 bg-white'}`}>
          <IconComp className="w-[18px] h-[18px]" strokeWidth={2}
            style={{ color: selectedType.is_builtin ? '#EDECE8' : selectedType.color }} />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl w-wider text-ink-900 truncate">{selectedType.name}</h1>
          <p className="text-sm text-ink-500">Upload the bill to auto-fill, or type it in</p>
        </div>
      </div>

      {error && (
        <div className="mb-5 border-2 border-flare-700 bg-flare-50 px-4 py-3 flex items-start gap-3 text-sm text-flare-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={2.5} /> {error}
        </div>
      )}

      <div className="inline-flex border-2 border-ink-900 mb-6">
        <button onClick={() => setInputMode('upload')}
          aria-pressed={inputMode === 'upload'}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-bold transition-colors duration-[120ms]
            ${inputMode === 'upload' ? 'bg-blue-600 text-white' : 'bg-white text-ink-900 hover:bg-paper-100'}`}>
          <Scan className="w-4 h-4" strokeWidth={2.5} /> Upload and scan
        </button>
        <button onClick={() => setInputMode('manual')}
          aria-pressed={inputMode === 'manual'}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-bold border-l-2 border-ink-900 transition-colors duration-[120ms]
            ${inputMode === 'manual' ? 'bg-blue-600 text-white' : 'bg-white text-ink-900 hover:bg-paper-100'}`}>
          <PenLine className="w-4 h-4" strokeWidth={2.5} /> Type it in
        </button>
      </div>

      <div className={`grid gap-5 ${twoUp ? 'grid-cols-1 lg:grid-cols-5' : 'grid-cols-1'}`}>
        {inputMode === 'upload' && (
          <div className={twoUp ? 'lg:col-span-2' : ''}>
            {!preview ? (
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click(); } }}
                className={`relative border-2 cursor-pointer transition-colors duration-[120ms] flex flex-col items-center justify-center text-center px-6 py-12 min-h-[17rem]
                  ${dragOver ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-ink-900 text-ink-900 hover:bg-paper-50'}`}
              >
                <span className={`absolute inset-2 border pointer-events-none ${dragOver ? 'border-white/40' : 'border-paper-400'}`} aria-hidden="true" />
                <div className={`w-16 h-16 border-2 flex items-center justify-center mb-4 ${dragOver ? 'border-white' : 'border-ink-900'}`}>
                  <Upload className="w-7 h-7" strokeWidth={2} />
                </div>
                <p className="text-xl w-wide font-bold">{dragOver ? 'Release to scan' : 'Drop the receipt here'}</p>
                <p className={`text-sm mt-1 ${dragOver ? 'text-white/80' : 'text-ink-500'}`}>or click to browse</p>
                <p className={`font-mono text-xs mt-4 ${dragOver ? 'text-white/70' : 'text-ink-400'}`}>
                  JPG · PNG · WEBP · PDF · up to 15 MB
                </p>
                <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden"
                  onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
              </div>
            ) : (
              <div className="plate">
                <div className="flex items-center gap-2 px-3 py-2 border-b-2 border-ink-900">
                  <FileText className="w-4 h-4 text-ink-900 flex-shrink-0" strokeWidth={2} />
                  <p className="font-mono text-xs text-ink-900 truncate flex-1">{fileName}</p>
                  {!uploading && (
                    <button onClick={clearUpload} aria-label="Remove file"
                      className="w-6 h-6 border border-paper-400 flex items-center justify-center text-ink-500 hover:border-flare-700 hover:text-flare-700 transition-colors duration-[120ms] flex-shrink-0">
                      <X className="w-3.5 h-3.5" strokeWidth={2.5} />
                    </button>
                  )}
                </div>

                {preview === 'pdf' ? (
                  <div className="flex flex-col items-center justify-center py-12 bg-paper-50">
                    <div className="w-14 h-14 border-2 border-ink-900 bg-white flex items-center justify-center mb-3">
                      <FileText className="w-6 h-6 text-ink-900" strokeWidth={2} />
                    </div>
                    <p className="text-sm text-ink-500">{uploading ? 'Reading the document' : 'Document uploaded'}</p>
                  </div>
                ) : (
                  <img src={resolveAsset(preview)} alt="Uploaded receipt" className="w-full object-contain max-h-80 bg-paper-50" />
                )}

                {uploading && (
                  <div className="border-t-2 border-ink-900">
                    <div className="h-2 bg-paper-300">
                      <div className="h-full bg-blue-600 transition-[width] duration-[120ms] ease-out" style={{ width: `${uploadProgress}%` }} />
                    </div>
                    <div className="px-3 py-2 flex items-center gap-3">
                      <OverprintMark size="w-5 h-5" />
                      <span className="text-sm text-ink-700 flex-1">Extracting details</span>
                      <span className="font-mono text-xs text-ink-500 tabular-nums">{Math.round(uploadProgress)}%</span>
                    </div>
                  </div>
                )}

                {stage === 'extracted' && !uploading && (
                  needsReview ? (
                    <div className="border-t-2 border-ink-900 bg-flare-500 px-3 py-2 flex items-center gap-2 text-sm font-bold text-ink-900">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" strokeWidth={2.5} /> Extracted, some fields need checking
                    </div>
                  ) : (
                    <div className="border-t-2 border-ink-900 bg-green-500 px-3 py-2 flex items-center gap-2 text-sm font-bold text-ink-900">
                      <CheckCircle className="w-4 h-4 flex-shrink-0" strokeWidth={2.5} /> Extracted, review and save
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        )}

        <div className={twoUp ? 'lg:col-span-3' : ''}>
          {uploading ? (
            <ExtractionPanel fileName={fileName} progress={uploadProgress} />
          ) : (
            <div className="animate-fade-in">
              {needsReview && stage === 'extracted' && (
                <div className="mb-6 border-2 border-flare-500 bg-flare-50 px-4 py-3">
                  <p className="text-sm font-bold text-flare-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" strokeWidth={2.5} /> Check the marked fields before saving
                  </p>
                  {reviewNotes && <p className="text-sm text-ink-700 mt-1.5">{reviewNotes}</p>}
                </div>
              )}

              {selectedType.slug === 'adnoc' && (
                <AdnocForm form={adnocForm} set={(k, v) => setField('adnoc', k, v)} rates={rates} flags={flags} />
              )}
              {selectedType.slug === 'shipping' && (
                <ShippingForm
                  form={shippingForm} set={(k, v) => setField('shipping', k, v)}
                  charges={shippingCharges} setCharges={setShippingCharges}
                  bls={shippingBLs} onBls={setShippingBLs}
                  containers={shippingContainers} onContainers={setShippingContainers}
                  savingsOldFee={savingsOldFee} onSavingsOldFee={setSavingsOldFee}
                  savingsPrevAgent={savingsPrevAgent} onSavingsPrevAgent={setSavingsPrevAgent}
                  recordSaving={recordSaving} onRecordSaving={setRecordSaving}
                  flags={flags}
                />
              )}
              {selectedType.is_builtin && selectedType.slug !== 'adnoc' && selectedType.slug !== 'shipping' && (
                <GeneralForm form={generalForm} set={(k, v) => setField('general', k, v)} rates={rates} flags={flags} />
              )}
              {!selectedType.is_builtin && (
                <DynamicForm fields={selectedType.fields_schema} values={customForm}
                  onChange={setCustomForm} rates={rates} flags={flags} />
              )}

              <div className="flex flex-wrap gap-3 mt-6 pt-5 border-t-2 border-ink-900">
                <button onClick={reset} className="btn-ghost">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
                  {saving
                    ? <><span className="w-2.5 h-2.5 bg-current animate-pulse" /> Saving</>
                    : 'Save expense'
                  }
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
