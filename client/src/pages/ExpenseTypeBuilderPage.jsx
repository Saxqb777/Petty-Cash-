import { useState, useEffect } from 'react';
import {
  Plus, Trash2, Lock, ChevronDown, ChevronUp,
  Fuel, Ship, LayoutGrid, Receipt, Briefcase, Car, Plane,
  Coffee, Package, Zap, Home, ShoppingBag, Truck, FileSpreadsheet,
  Save, X, Edit2, Archive
} from 'lucide-react';
import { api } from '../utils/api';
import { useToast } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';

const ICON_OPTIONS = [
  { key: 'receipt', Icon: Receipt, label: 'Receipt' },
  { key: 'briefcase', Icon: Briefcase, label: 'Briefcase' },
  { key: 'car', Icon: Car, label: 'Car' },
  { key: 'plane', Icon: Plane, label: 'Plane' },
  { key: 'coffee', Icon: Coffee, label: 'Coffee' },
  { key: 'package', Icon: Package, label: 'Package' },
  { key: 'zap', Icon: Zap, label: 'Utilities' },
  { key: 'home', Icon: Home, label: 'Home' },
  { key: 'shopping', Icon: ShoppingBag, label: 'Shopping' },
  { key: 'truck', Icon: Truck, label: 'Truck' },
  { key: 'spreadsheet', Icon: FileSpreadsheet, label: 'Document' },
  { key: 'fuel', Icon: Fuel, label: 'Fuel' },
  { key: 'ship', Icon: Ship, label: 'Ship' },
  { key: 'grid', Icon: LayoutGrid, label: 'Grid' },
];

const COLOR_OPTIONS = [
  '#62833A', '#f97316', '#3b82f6', '#8b5cf6', '#ec4899',
  '#14b8a6', '#f59e0b', '#ef4444', '#6366f1', '#10b981',
];

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'currency', label: 'Amount + Currency' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Dropdown' },
  { value: 'textarea', label: 'Long Text' },
];

const ICON_MAP = {
  fuel: Fuel, ship: Ship, grid: LayoutGrid, receipt: Receipt,
  briefcase: Briefcase, car: Car, plane: Plane, coffee: Coffee,
  package: Package, spreadsheet: FileSpreadsheet, zap: Zap,
  home: Home, shopping: ShoppingBag, truck: Truck
};

const newField = () => ({
  key: `field_${Date.now()}`,
  label: '',
  type: 'text',
  required: false,
  placeholder: '',
  options: [],
  _optionInput: '',
});

const slugify = (name) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/* Readable form label. `.label` stays reserved for micro-labels. */
function L({ children, htmlFor }) {
  return <label htmlFor={htmlFor} className="block text-sm font-bold text-ink-700 mb-1.5">{children}</label>;
}

function Section({ title, note, children }) {
  return (
    <section className="border-t-2 border-ink-900 pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <h2 className="text-lg w-wide text-ink-900">{title}</h2>
        {note && <p className="text-sm text-ink-500">{note}</p>}
      </div>
      {children}
    </section>
  );
}

export default function ExpenseTypeBuilderPage() {
  const { showToast } = useToast();
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null = list, 'new' = create form, id = edit form
  const [confirm, setConfirm] = useState(null);

  const [form, setForm] = useState({
    name: '', slug: '', icon: 'receipt', color: '#62833A',
    description: '', ai_hints: '', fields: [newField()]
  });
  const [slugLocked, setSlugLocked] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.getExpenseTypes()
      .then(data => { setTypes(data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(load, []);

  const startCreate = () => {
    setForm({ name: '', slug: '', icon: 'receipt', color: '#62833A', description: '', ai_hints: '', fields: [newField()] });
    setSlugLocked(false);
    setEditing('new');
  };

  const startEdit = (type) => {
    const fields = (type.fields_schema || []).map(f => ({
      ...f,
      _optionInput: '',
      key: f.key || `field_${Date.now()}`,
    }));
    setForm({
      name: type.name, slug: type.slug, icon: type.icon, color: type.color,
      description: type.description || '', ai_hints: type.ai_hints || '',
      fields: fields.length ? fields : [newField()],
    });
    setSlugLocked(true);
    setEditing(type.id);
  };

  const handleNameChange = (name) => {
    setForm(f => ({
      ...f,
      name,
      slug: f.slug && slugLocked ? f.slug : slugify(name)
    }));
  };

  const addField = () => setForm(f => ({ ...f, fields: [...f.fields, newField()] }));
  const removeField = (idx) => setForm(f => ({ ...f, fields: f.fields.filter((_, i) => i !== idx) }));
  const updateField = (idx, patch) => setForm(f => ({
    ...f,
    fields: f.fields.map((field, i) => i === idx ? { ...field, ...patch } : field)
  }));

  const addOption = (idx) => {
    const field = form.fields[idx];
    const val = (field._optionInput || '').trim();
    if (!val || field.options.includes(val)) return;
    updateField(idx, { options: [...field.options, val], _optionInput: '' });
  };

  const moveField = (idx, dir) => {
    const fields = [...form.fields];
    const target = idx + dir;
    if (target < 0 || target >= fields.length) return;
    [fields[idx], fields[target]] = [fields[target], fields[idx]];
    setForm(f => ({ ...f, fields }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { showToast('Type name is required', 'error'); return; }
    if (!form.slug.trim()) { showToast('Slug is required', 'error'); return; }
    if (form.fields.some(f => !f.label.trim())) { showToast('All fields must have a label', 'error'); return; }

    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      icon: form.icon,
      color: form.color,
      description: form.description.trim() || null,
      ai_hints: form.ai_hints.trim() || null,
      fields_schema: form.fields.map(({ _optionInput, ...f }) => ({
        ...f,
        key: f.key.startsWith('field_') ? slugify(f.label) || f.key : f.key,
      })),
    };

    setSaving(true);
    try {
      if (editing === 'new') {
        await api.createExpenseType(payload);
        showToast('Expense type created', 'success');
      } else {
        await api.updateExpenseType(editing, payload);
        showToast('Expense type updated', 'success');
      }
      load();
      setEditing(null);
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (id) => {
    try {
      await api.deleteExpenseType(id);
      showToast('Type archived', 'success');
      load();
    } catch (e) {
      showToast(e.message, 'error');
    }
    setConfirm(null);
  };

  // ── Edit / Create Form ──────────────────────────────────────────────────────
  if (editing !== null) {
    const SelectedIcon = ICON_MAP[form.icon] || Receipt;
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setEditing(null)}
            aria-label="Close editor"
            className="w-9 h-9 border-2 border-ink-900 bg-white flex items-center justify-center text-ink-900 hover:bg-paper-100 transition-colors duration-[120ms] flex-shrink-0"
          >
            <X className="w-4 h-4" strokeWidth={2.5} />
          </button>
          <h1 className="text-2xl w-wider text-ink-900">
            {editing === 'new' ? 'New expense type' : 'Edit expense type'}
          </h1>
        </div>

        <div className="space-y-7">
          {/* Basic info */}
          <Section title="Basics">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <L htmlFor="t-name">Type name</L>
                <input id="t-name" className="input" value={form.name} onChange={e => handleNameChange(e.target.value)} placeholder="e.g. Hotel Accommodation" />
              </div>
              <div>
                <L htmlFor="t-slug">Slug</L>
                <input id="t-slug" className="input font-mono" value={form.slug}
                  onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') }))}
                  placeholder="hotel-accommodation" disabled={slugLocked} />
                <p className="text-sm text-ink-500 mt-1.5">
                  {slugLocked ? 'Fixed once the type exists' : 'Unique id, generated from the name'}
                </p>
              </div>
              <div>
                <L htmlFor="t-desc">Description</L>
                <input id="t-desc" className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Short description for users" />
              </div>
            </div>
          </Section>

          {/* Icon + Color */}
          <Section title="Mark">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 border-2 border-ink-900 bg-white flex items-center justify-center flex-shrink-0">
                <SelectedIcon className="w-7 h-7" strokeWidth={2} style={{ color: form.color }} />
              </div>
              <div className="min-w-0">
                <p className="label mb-1">Preview</p>
                <p className="text-sm font-bold text-ink-900 truncate">{form.name || 'Type name'}</p>
              </div>
            </div>

            <p className="label">Icon</p>
            <div className="flex flex-wrap gap-2 mb-5">
              {ICON_OPTIONS.map(({ key, Icon, label }) => {
                const on = form.icon === key;
                return (
                  <button key={key} onClick={() => setForm(f => ({ ...f, icon: key }))}
                    aria-label={label} aria-pressed={on} title={label}
                    className={`w-10 h-10 flex items-center justify-center transition-colors duration-[120ms] ${
                      on ? 'border-2 border-ink-900 bg-paper-200' : 'border border-paper-400 bg-white hover:border-ink-900'
                    }`}>
                    <Icon className="w-4 h-4" strokeWidth={2} style={{ color: on ? form.color : '#57575F' }} />
                  </button>
                );
              })}
            </div>

            <p className="label">Colour</p>
            <div className="flex gap-2 flex-wrap">
              {COLOR_OPTIONS.map(c => (
                <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                  aria-label={`Colour ${c}`} aria-pressed={form.color === c} title={c}
                  className={`w-9 h-9 transition-colors duration-[120ms] ${form.color === c ? 'border-2 border-ink-900' : 'border border-paper-400'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </Section>

          {/* AI Hints */}
          <Section title="Extraction hints" note="Optional">
            <p className="text-sm text-ink-500 mb-3">Tell the AI what kind of document this is so it extracts the right fields.</p>
            <textarea className="textarea resize-none" rows={3} value={form.ai_hints}
              aria-label="AI extraction hints"
              onChange={e => setForm(f => ({ ...f, ai_hints: e.target.value }))}
              placeholder="e.g. Hotel invoice or booking confirmation. Look for check-in and check-out dates, room type, and number of nights." />
          </Section>

          {/* Fields */}
          <Section title="Form fields" note="Vendor, amount and date are always included">
            <div className="border-t border-paper-300">
              {form.fields.map((field, idx) => (
                <div key={field.key} className="border-b border-paper-300 py-4">
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center gap-1 pt-1 flex-shrink-0">
                      <span className="font-mono text-xs text-ink-400">{String(idx + 1).padStart(2, '0')}</span>
                      <button onClick={() => moveField(idx, -1)} aria-label="Move field up"
                        className="text-ink-500 hover:text-ink-900 disabled:opacity-25 transition-colors duration-[120ms]" disabled={idx === 0}>
                        <ChevronUp className="w-4 h-4" strokeWidth={2.5} />
                      </button>
                      <button onClick={() => moveField(idx, 1)} aria-label="Move field down"
                        className="text-ink-500 hover:text-ink-900 disabled:opacity-25 transition-colors duration-[120ms]" disabled={idx === form.fields.length - 1}>
                        <ChevronDown className="w-4 h-4" strokeWidth={2.5} />
                      </button>
                    </div>

                    <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <L>Field label</L>
                        <input className="input" value={field.label}
                          onChange={e => updateField(idx, { label: e.target.value })} placeholder="e.g. Project Code" />
                      </div>
                      <div>
                        <L>Field type</L>
                        <div className="relative">
                          <select className="select"
                            aria-label="Field type"
                            value={field.type} onChange={e => updateField(idx, { type: e.target.value, options: [] })}>
                            {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-500 pointer-events-none" strokeWidth={2} />
                        </div>
                      </div>
                      <div>
                        <L>Placeholder</L>
                        <input className="input" value={field.placeholder}
                          onChange={e => updateField(idx, { placeholder: e.target.value })} placeholder="Hint text" />
                      </div>
                      <div className="flex items-end pb-2.5">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input type="checkbox" checked={field.required}
                            onChange={e => updateField(idx, { required: e.target.checked })}
                            className="w-4 h-4 accent-blue-600" />
                          <span className="text-sm text-ink-700 font-bold">Required</span>
                        </label>
                      </div>
                    </div>

                    <button onClick={() => removeField(idx)} aria-label="Remove field" title="Remove field"
                      className="w-9 h-9 border-2 border-paper-400 text-ink-500 flex items-center justify-center hover:border-flare-700 hover:text-flare-700 transition-colors duration-[120ms] flex-shrink-0 mt-6">
                      <Trash2 className="w-4 h-4" strokeWidth={2} />
                    </button>
                  </div>

                  {field.type === 'select' && (
                    <div className="mt-3 ml-0 sm:ml-9 border-l-2 border-paper-300 pl-3">
                      <p className="label">Dropdown options</p>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {field.options.map(opt => (
                          <span key={opt} className="inline-flex items-center gap-2 pl-2.5 pr-1.5 py-0.5 bg-white border-2 border-ink-900 text-sm text-ink-900">
                            {opt}
                            <button onClick={() => updateField(idx, { options: field.options.filter(o => o !== opt) })}
                              aria-label={`Remove option ${opt}`}
                              className="text-ink-500 hover:text-flare-700 transition-colors duration-[120ms]"><X className="w-3 h-3" strokeWidth={2.5} /></button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input className="input flex-1" value={field._optionInput}
                          aria-label="New dropdown option"
                          onChange={e => updateField(idx, { _optionInput: e.target.value })}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOption(idx); }}}
                          placeholder="Add option" />
                        <button onClick={() => addOption(idx)} className="btn-ghost btn-sm flex-shrink-0" aria-label="Add option">
                          <Plus className="w-3.5 h-3.5" strokeWidth={2.5} /> Add
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button onClick={addField} className="btn-quiet btn-sm mt-4">
              <Plus className="w-3.5 h-3.5" strokeWidth={2.5} /> Add field
            </button>
          </Section>

          <div className="flex flex-wrap gap-3 border-t-2 border-ink-900 pt-5">
            <button onClick={() => setEditing(null)} className="btn-ghost">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
              {saving
                ? <><span className="w-2.5 h-2.5 bg-current animate-pulse" /> Saving</>
                : <><Save className="w-4 h-4" strokeWidth={2.5} /> {editing === 'new' ? 'Create type' : 'Save changes'}</>
              }
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Type List ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl w-wider text-ink-900">Expense types</h1>
          <p className="text-sm text-ink-500 mt-1">Manage the types of expenses your team can submit</p>
        </div>
        <button onClick={startCreate} className="btn-primary">
          <Plus className="w-4 h-4" strokeWidth={2.5} /> New type
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          <div className="skeleton h-16 w-full" />
          <div className="skeleton h-16 w-full" />
          <div className="skeleton h-16 w-full" />
        </div>
      ) : (
        <div className="plate">
          {types.map(type => {
            const IconComp = ICON_MAP[type.icon] || Receipt;
            const builtin = !!type.is_builtin;
            return (
              <div key={type.id} className="px-3 py-3 flex flex-wrap items-center gap-3 border-b border-paper-300 last:border-b-0 hover:bg-blue-50 transition-colors duration-[120ms]">
                <div className={`w-10 h-10 flex items-center justify-center flex-shrink-0 ${builtin ? 'bg-ink-900' : 'border-2 border-ink-900 bg-white'}`}>
                  <IconComp
                    className="w-[18px] h-[18px]"
                    strokeWidth={2}
                    style={{ color: builtin ? '#EDECE8' : type.color }}
                  />
                </div>
                <div className="flex-1 min-w-[10rem]">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-ink-900 text-sm font-bold">{type.name}</p>
                    {builtin ? (
                      <span className="tag-muted"><Lock className="w-2.5 h-2.5" strokeWidth={2.5} /> Built in</span>
                    ) : (
                      <span className="tag-blue">Custom</span>
                    )}
                  </div>
                  <p className="text-sm text-ink-500 truncate">
                    {type.description || `${type.fields_schema?.length || 0} fields`}
                  </p>
                </div>
                {!builtin && (
                  <div className="flex items-center gap-2 ml-auto">
                    <button onClick={() => startEdit(type)} title="Edit" aria-label={`Edit ${type.name}`}
                      className="w-9 h-9 border-2 border-paper-400 text-ink-500 flex items-center justify-center hover:border-ink-900 hover:text-ink-900 transition-colors duration-[120ms]">
                      <Edit2 className="w-3.5 h-3.5" strokeWidth={2} />
                    </button>
                    <button onClick={() => setConfirm({ id: type.id, name: type.name })} title="Archive" aria-label={`Archive ${type.name}`}
                      className="w-9 h-9 border-2 border-paper-400 text-ink-500 flex items-center justify-center hover:border-flare-700 hover:text-flare-700 transition-colors duration-[120ms]">
                      <Archive className="w-3.5 h-3.5" strokeWidth={2} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {types.length === 0 && (
            <p className="px-3 py-6 text-sm text-ink-500">No expense types yet.</p>
          )}
        </div>
      )}

      <section>
        <p className="label border-b-2 border-ink-900 pb-2 mb-3">About custom types</p>
        <p className="text-sm text-ink-500 mb-1.5">Built-in types (Petrol, Shipping, General) have specialised forms and cannot be removed.</p>
        <p className="text-sm text-ink-500">Custom types use a dynamic form built from your field definitions, with AI extraction powered by your hints.</p>
      </section>

      <ConfirmDialog
        open={!!confirm}
        title="Archive expense type"
        message={`Archive "${confirm?.name}"? It won't appear in the Add Expense flow but existing records are preserved.`}
        variant="danger"
        onConfirm={() => handleArchive(confirm.id)}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
