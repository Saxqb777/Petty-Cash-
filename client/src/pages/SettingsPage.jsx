import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Building2, Users, Tag, DollarSign, Save, CheckCircle, Plus, X, Globe, RefreshCw } from 'lucide-react';
import { api } from '../utils/api';

const DEFAULTS = {
  companyName:       'Agthia Group',
  department:        'Finance',
  defaultCurrency:   'AED',
  defaultBU:         '',
  monthlyBudget:     '',
  categories: [
    'Fuel & Transport','Parking','Customs & Clearance','Printing & Photocopy',
    'Materials & Supplies','Food & Beverages','Office Supplies',
    'Accommodation & Travel','Medical','Miscellaneous'
  ],
  businessUnits: ['AAFB','Al Foah','GMFF','BMB','Other'],
  approvalThreshold: '500',
  fiscalYearStart:   '01',
};

const CURRENCIES = ['USD','EUR','GBP','SAR','QAR','KWD','OMR','INR'];

const DEFAULT_RATES = { USD: 3.6725, EUR: 4.02, GBP: 4.68, SAR: 0.98, QAR: 1.01, KWD: 11.96, OMR: 9.53, INR: 0.044 };

function Section({ icon: Icon, title, description, children }) {
  return (
    <div className="card p-6">
      <div className="flex items-start gap-3 mb-5 pb-5 border-b border-slate-100">
        <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4.5 h-[18px] text-brand-600" />
        </div>
        <div>
          <h3 className="font-heading font-bold text-slate-800 text-[15px]">{title}</h3>
          <p className="text-xs text-slate-400 mt-0.5">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function TagList({ items, onRemove, onAdd, placeholder }) {
  const [val, setVal] = useState('');
  const add = () => {
    const t = val.trim();
    if (t && !items.includes(t)) { onAdd(t); setVal(''); }
  };
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        {items.map(item => (
          <span key={item} className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium">
            {item}
            <button onClick={() => onRemove(item)} className="text-slate-400 hover:text-red-500 transition-colors">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="input flex-1 text-sm"
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder={placeholder}
        />
        <button onClick={add} className="btn-secondary text-sm flex items-center gap-1.5 flex-shrink-0">
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>
    </div>
  );
}

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } }
};
const item = {
  hidden: { opacity: 0, y: 14 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] } }
};

export default function SettingsPage() {
  const [cfg, setCfg] = useState(DEFAULTS);
  const [rates, setRates] = useState(DEFAULT_RATES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setCfg(c => ({ ...c, [k]: v }));
  const setRate = (currency, val) => setRates(r => ({ ...r, [currency]: val }));

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await api.getSettings();
        const app = data.app_settings || {};
        setCfg({
          companyName:       app.companyName       || DEFAULTS.companyName,
          department:        app.department        || DEFAULTS.department,
          defaultCurrency:   app.defaultCurrency   || DEFAULTS.defaultCurrency,
          defaultBU:         app.defaultBU         || DEFAULTS.defaultBU,
          monthlyBudget:     app.monthlyBudget      || DEFAULTS.monthlyBudget,
          categories:        app.categories        || DEFAULTS.categories,
          businessUnits:     app.businessUnits     || DEFAULTS.businessUnits,
          approvalThreshold: app.approvalThreshold || DEFAULTS.approvalThreshold,
          fiscalYearStart:   app.fiscalYearStart   || DEFAULTS.fiscalYearStart,
        });
        if (data.exchange_rates) {
          setRates({ ...DEFAULT_RATES, ...data.exchange_rates });
        }
      } catch (e) {
        setError('Could not load settings: ' + e.message);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const save = async () => {
    setSaving(true); setError('');
    try {
      const parsedRates = {};
      CURRENCIES.forEach(c => {
        parsedRates[c] = parseFloat(rates[c]) || DEFAULT_RATES[c];
      });
      await api.updateSettings({
        app_settings: cfg,
        exchange_rates: parsedRates,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError('Save failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const MONTHS = ['January','February','March','April','May','June',
    'July','August','September','October','November','December'];

  if (loading) {
    return (
      <div className="p-6 max-w-3xl mx-auto flex items-center gap-3 text-slate-400">
        <RefreshCw className="w-4 h-4 animate-spin" /> Loading settings...
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity:0,y:-8 }} animate={{ opacity:1,y:0 }} transition={{ duration:0.3 }}
        className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-900 tracking-tight">Settings</h1>
          <p className="text-sm text-slate-400 mt-0.5 font-medium">Configure your petty cash workspace</p>
        </div>
        <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2 text-sm">
          {saving
            ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</>
            : saved
            ? <><CheckCircle className="w-4 h-4" /> Saved!</>
            : <><Save className="w-4 h-4" /> Save Changes</>}
        </button>
      </motion.div>

      {error && (
        <div className="mb-5 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">{error}</div>
      )}

      <motion.div variants={container} initial="hidden" animate="show" className="space-y-5">

        {/* Company */}
        <motion.div variants={item}>
          <Section icon={Building2} title="Company Details" description="Basic information about your organisation and department">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Company Name</label>
                <input className="input" value={cfg.companyName} onChange={e => set('companyName', e.target.value)} />
              </div>
              <div>
                <label className="label">Department</label>
                <input className="input" value={cfg.department} onChange={e => set('department', e.target.value)} />
              </div>
              <div>
                <label className="label">Fiscal Year Start</label>
                <select className="input" value={cfg.fiscalYearStart} onChange={e => set('fiscalYearStart', e.target.value)}>
                  {MONTHS.map((m, i) => (
                    <option key={i} value={String(i + 1).padStart(2, '0')}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Monthly Budget Limit (AED)</label>
                <input className="input" type="number" min="0" value={cfg.monthlyBudget}
                  onChange={e => set('monthlyBudget', e.target.value)} placeholder="e.g. 10000" />
              </div>
            </div>
          </Section>
        </motion.div>

        {/* Defaults */}
        <motion.div variants={item}>
          <Section icon={DollarSign} title="Expense Defaults" description="Default values pre-filled when creating new expenses">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Default Currency</label>
                <select className="input" value={cfg.defaultCurrency} onChange={e => set('defaultCurrency', e.target.value)}>
                  {['AED','USD','EUR','GBP','SAR','QAR','KWD','OMR'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Default Business Unit</label>
                <select className="input" value={cfg.defaultBU} onChange={e => set('defaultBU', e.target.value)}>
                  <option value="">— None —</option>
                  {cfg.businessUnits.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Approval Threshold (AED)</label>
                <input className="input" type="number" min="0" value={cfg.approvalThreshold}
                  onChange={e => set('approvalThreshold', e.target.value)} placeholder="e.g. 500" />
                <p className="text-xs text-slate-400 mt-1">Expenses above this amount are flagged for review</p>
              </div>
            </div>
          </Section>
        </motion.div>

        {/* Exchange Rates */}
        <motion.div variants={item}>
          <Section icon={Globe} title="Exchange Rates" description="Rates used to convert foreign currency expenses to AED">
            <div className="grid grid-cols-2 gap-3">
              {CURRENCIES.map(cur => (
                <div key={cur} className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-slate-600 w-10">1 {cur}</span>
                  <span className="text-slate-400 text-sm">=</span>
                  <input
                    className="input flex-1 text-sm"
                    type="number"
                    step="0.0001"
                    min="0"
                    value={rates[cur] ?? DEFAULT_RATES[cur]}
                    onChange={e => setRate(cur, e.target.value)}
                    placeholder={String(DEFAULT_RATES[cur])}
                  />
                  <span className="text-sm text-slate-500">AED</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-3">These rates are used to calculate AED equivalents when recording foreign currency expenses.</p>
          </Section>
        </motion.div>

        {/* Business Units */}
        <motion.div variants={item}>
          <Section icon={Users} title="Business Units" description="Manage the business unit options available when adding expenses">
            <TagList
              items={cfg.businessUnits}
              onRemove={v => set('businessUnits', cfg.businessUnits.filter(x => x !== v))}
              onAdd={v => set('businessUnits', [...cfg.businessUnits, v])}
              placeholder="Add business unit..."
            />
          </Section>
        </motion.div>

        {/* Categories */}
        <motion.div variants={item}>
          <Section icon={Tag} title="Expense Categories" description="Manage the categories used to classify expenses">
            <TagList
              items={cfg.categories}
              onRemove={v => set('categories', cfg.categories.filter(x => x !== v))}
              onAdd={v => set('categories', [...cfg.categories, v])}
              placeholder="Add category..."
            />
          </Section>
        </motion.div>

      </motion.div>
    </div>
  );
}
