import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Building2, Users, Tag, DollarSign, Save, CheckCircle, Plus, X, Globe } from 'lucide-react';
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

/* A form label the user can actually read. `.label` is reserved for true
   micro-labels (column heads, eyebrows). */
function L({ children, htmlFor }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-bold text-ink-700 mb-1.5">{children}</label>
  );
}

function Section({ icon: Icon, title, description, children }) {
  return (
    <section className="border-t-2 border-ink-900 pt-5">
      <div className="flex items-start gap-3 mb-5">
        <div className="w-9 h-9 border-2 border-ink-900 bg-white flex items-center justify-center flex-shrink-0">
          <Icon className="w-[18px] h-[18px] text-ink-900" strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg w-wide text-ink-900">{title}</h2>
          <p className="text-sm text-ink-500 mt-0.5">{description}</p>
        </div>
      </div>
      {children}
    </section>
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
          <span key={item} className="inline-flex items-center gap-2 pl-2.5 pr-1.5 py-1 bg-white border-2 border-ink-900 text-ink-900 text-sm">
            {item}
            <button
              type="button"
              onClick={() => onRemove(item)}
              aria-label={`Remove ${item}`}
              className="text-ink-500 hover:text-flare-700 transition-colors duration-[120ms]"
            >
              <X className="w-3.5 h-3.5" strokeWidth={2.5} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="input flex-1"
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder={placeholder}
        />
        <button onClick={add} className="btn-ghost flex-shrink-0">
          <Plus className="w-4 h-4" strokeWidth={2.5} /> Add
        </button>
      </div>
    </div>
  );
}

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } }
};
const item = {
  hidden: { opacity: 0, y: 4 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.12, ease: 'easeOut' } }
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
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        <div className="skeleton h-8 w-44 mb-6" />
        <div className="space-y-3">
          <div className="skeleton h-24 w-full" />
          <div className="skeleton h-24 w-full" />
          <div className="skeleton h-24 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.12, ease: 'easeOut' }}
        className="flex flex-wrap items-end justify-between gap-4 mb-7">
        <div>
          <h1 className="text-3xl w-wider text-ink-900">Settings</h1>
          <p className="text-sm text-ink-500 mt-1">Configure your petty cash workspace</p>
        </div>
        <button onClick={save} disabled={saving} className="btn-primary">
          {saving
            ? <><span className="w-2.5 h-2.5 bg-current animate-pulse" /> Saving</>
            : saved
            ? <><CheckCircle className="w-4 h-4" strokeWidth={2.5} /> Settings saved</>
            : <><Save className="w-4 h-4" strokeWidth={2.5} /> Save settings</>}
        </button>
      </motion.div>

      {error && (
        <div className="mb-6 border-2 border-flare-700 bg-flare-50 px-4 py-3 text-sm text-flare-700">{error}</div>
      )}

      <motion.div variants={container} initial="hidden" animate="show" className="space-y-8">

        {/* Company */}
        <motion.div variants={item}>
          <Section icon={Building2} title="Company details" description="Basic information about your organisation and department">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <L htmlFor="s-company">Company name</L>
                <input id="s-company" className="input" value={cfg.companyName} onChange={e => set('companyName', e.target.value)} />
              </div>
              <div>
                <L htmlFor="s-dept">Department</L>
                <input id="s-dept" className="input" value={cfg.department} onChange={e => set('department', e.target.value)} />
              </div>
              <div>
                <L htmlFor="s-fiscal">Fiscal year start</L>
                <select id="s-fiscal" className="select" value={cfg.fiscalYearStart} onChange={e => set('fiscalYearStart', e.target.value)}>
                  {MONTHS.map((m, i) => (
                    <option key={i} value={String(i + 1).padStart(2, '0')}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <L htmlFor="s-budget">Monthly budget limit (AED)</L>
                <input id="s-budget" className="input font-mono" type="number" min="0" value={cfg.monthlyBudget}
                  onChange={e => set('monthlyBudget', e.target.value)} placeholder="10000" />
              </div>
            </div>
          </Section>
        </motion.div>

        {/* Defaults */}
        <motion.div variants={item}>
          <Section icon={DollarSign} title="Expense defaults" description="Default values pre-filled when creating new expenses">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <L htmlFor="s-cur">Default currency</L>
                <select id="s-cur" className="select font-mono" value={cfg.defaultCurrency} onChange={e => set('defaultCurrency', e.target.value)}>
                  {['AED','USD','EUR','GBP','SAR','QAR','KWD','OMR'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <L htmlFor="s-bu">Default business unit</L>
                <select id="s-bu" className="select" value={cfg.defaultBU} onChange={e => set('defaultBU', e.target.value)}>
                  <option value="">None</option>
                  {cfg.businessUnits.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <L htmlFor="s-thr">Approval threshold (AED)</L>
                <input id="s-thr" className="input font-mono" type="number" min="0" value={cfg.approvalThreshold}
                  onChange={e => set('approvalThreshold', e.target.value)} placeholder="500" />
                <p className="text-sm text-ink-500 mt-1.5">Expenses above this amount are flagged for review</p>
              </div>
            </div>
          </Section>
        </motion.div>

        {/* Exchange Rates */}
        <motion.div variants={item}>
          <Section icon={Globe} title="Exchange rates" description="Rates used to convert foreign currency expenses to AED">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0 border-t border-paper-300">
              {CURRENCIES.map(cur => (
                <div key={cur} className="flex items-center gap-3 py-2.5 border-b border-paper-300">
                  <span className="font-mono text-sm text-ink-900 w-16 flex-shrink-0">1 {cur}</span>
                  <span className="text-ink-400 text-sm flex-shrink-0">=</span>
                  <input
                    className="input flex-1 font-mono text-right"
                    type="number"
                    step="0.0001"
                    min="0"
                    aria-label={`Rate for 1 ${cur} in AED`}
                    value={rates[cur] ?? DEFAULT_RATES[cur]}
                    onChange={e => setRate(cur, e.target.value)}
                    placeholder={String(DEFAULT_RATES[cur])}
                  />
                  <span className="font-mono text-sm text-ink-500 flex-shrink-0">AED</span>
                </div>
              ))}
            </div>
            <p className="text-sm text-ink-500 mt-3">
              Rates apply at the moment an expense is saved. Records already saved keep the rate they were entered with.
            </p>
          </Section>
        </motion.div>

        {/* Business Units */}
        <motion.div variants={item}>
          <Section icon={Users} title="Business units" description="Manage the business unit options available when adding expenses">
            <TagList
              items={cfg.businessUnits}
              onRemove={v => set('businessUnits', cfg.businessUnits.filter(x => x !== v))}
              onAdd={v => set('businessUnits', [...cfg.businessUnits, v])}
              placeholder="Add business unit"
            />
          </Section>
        </motion.div>

        {/* Categories */}
        <motion.div variants={item}>
          <Section icon={Tag} title="Expense categories" description="Manage the categories used to classify expenses">
            <TagList
              items={cfg.categories}
              onRemove={v => set('categories', cfg.categories.filter(x => x !== v))}
              onAdd={v => set('categories', [...cfg.categories, v])}
              placeholder="Add category"
            />
          </Section>
        </motion.div>

      </motion.div>
    </div>
  );
}
