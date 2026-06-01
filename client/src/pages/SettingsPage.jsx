import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Building2, Users, Tag, DollarSign, Save, CheckCircle, Plus, X, Palette, Globe } from 'lucide-react';
import { cn } from '../lib/utils';

const STORAGE_KEY = 'agthia_settings';

const DEFAULTS = {
  companyName:   'Agthia Group',
  department:    'Finance',
  defaultCurrency: 'AED',
  defaultBU:     '',
  monthlyBudget: '',
  categories: [
    'Fuel & Transport','Parking','Customs & Clearance','Printing & Photocopy',
    'Materials & Supplies','Food & Beverages','Office Supplies',
    'Accommodation & Travel','Medical','Miscellaneous'
  ],
  businessUnits: ['AAFB','Al Foah','GMFF','BMB','Other'],
  approvalThreshold: '500',
  fiscalYearStart: '01',
};

function load() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }; }
  catch { return DEFAULTS; }
}

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
  const [cfg, setCfg] = useState(load);
  const [saved, setSaved] = useState(false);

  const set = (k, v) => setCfg(c => ({ ...c, [k]: v }));

  const save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const MONTHS = ['January','February','March','April','May','June',
    'July','August','September','October','November','December'];

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity:0,y:-8 }} animate={{ opacity:1,y:0 }} transition={{ duration:0.3 }}
        className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-900 tracking-tight">Settings</h1>
          <p className="text-sm text-slate-400 mt-0.5 font-medium">Configure your petty cash workspace</p>
        </div>
        <button onClick={save} className="btn-primary flex items-center gap-2 text-sm">
          {saved ? <><CheckCircle className="w-4 h-4" /> Saved!</> : <><Save className="w-4 h-4" /> Save Changes</>}
        </button>
      </motion.div>

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
                  {['AED','USD','EUR','GBP','SAR','QAR'].map(c => <option key={c} value={c}>{c}</option>)}
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
