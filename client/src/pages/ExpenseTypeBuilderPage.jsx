import { useState, useEffect } from 'react';
import {
  Plus, Trash2, GripVertical, Settings2, Lock, ChevronDown,
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
      <div className="p-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setEditing(null)} className="w-8 h-8 rounded-lg hover:bg-paper-200 flex items-center justify-center text-ink-500">
            <X className="w-4 h-4" />
          </button>
          <h1 className="text-xl font-bold text-ink-900">
            {editing === 'new' ? 'Create Custom Expense Type' : 'Edit Expense Type'}
          </h1>
        </div>

        <div className="space-y-6">
          {/* Basic info */}
          <div className="card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-ink-700">Basic Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Type Name</label>
                <input className="input" value={form.name} onChange={e => handleNameChange(e.target.value)} placeholder="e.g. Hotel Accommodation" />
              </div>
              <div>
                <label className="label">Slug (unique ID)</label>
                <input className="input font-mono" value={form.slug}
                  onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') }))}
                  placeholder="hotel-accommodation" disabled={slugLocked} />
                {slugLocked && <p className="text-xs text-ink-400 mt-1">Slug cannot be changed after creation</p>}
              </div>
              <div>
                <label className="label">Description</label>
                <input className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Short description for users" />
              </div>
            </div>
          </div>

          {/* Icon + Color */}
          <div className="card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-ink-700">Icon & Color</h2>
            <div className="flex items-center gap-4 mb-2">
              <div className="w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: form.color + '1a' }}>
                <SelectedIcon className="w-7 h-7" style={{ color: form.color }} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-ink-700 mb-1">Preview</p>
                <p className="text-xs text-ink-400">{form.name || 'Type name'}</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-ink-500 mb-2">Icon</p>
              <div className="flex flex-wrap gap-2">
                {ICON_OPTIONS.map(({ key, Icon }) => (
                  <button key={key} onClick={() => setForm(f => ({ ...f, icon: key }))}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${form.icon === key ? 'ring-2 ring-offset-1' : 'border border-paper-400 hover:border-paper-500'}`}
                    style={form.icon === key ? { ringColor: form.color, backgroundColor: form.color + '1a' } : {}}>
                    <Icon className="w-4 h-4" style={form.icon === key ? { color: form.color } : { color: '#6b7280' }} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-ink-500 mb-2">Color</p>
              <div className="flex gap-2 flex-wrap">
                {COLOR_OPTIONS.map(c => (
                  <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                    className={`w-7 h-7 rounded-full transition-transform ${form.color === c ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : 'hover:scale-110'}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
          </div>

          {/* AI Hints */}
          <div className="card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-ink-700">AI Extraction Hints</h2>
            <p className="text-xs text-ink-500">Tell the AI what kind of document this is so it extracts the right fields.</p>
            <textarea className="input resize-none" rows={3} value={form.ai_hints}
              onChange={e => setForm(f => ({ ...f, ai_hints: e.target.value }))}
              placeholder="e.g. Hotel invoice or booking confirmation. Look for check-in/check-out dates, room type, and number of nights." />
          </div>

          {/* Fields */}
          <div className="card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink-700">Form Fields</h2>
              <p className="text-xs text-ink-400">Standard fields (vendor, amount, date) are always included</p>
            </div>

            <div className="space-y-3">
              {form.fields.map((field, idx) => (
                <div key={field.key} className="border border-paper-400 rounded-lg p-3 space-y-3 bg-paper-100">
                  <div className="flex items-start gap-2">
                    <div className="flex flex-col gap-1 pt-1 flex-shrink-0">
                      <button onClick={() => moveField(idx, -1)} className="text-ink-300 hover:text-ink-500 disabled:opacity-20" disabled={idx === 0}>
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                      </button>
                      <button onClick={() => moveField(idx, 1)} className="text-ink-300 hover:text-ink-500 disabled:opacity-20" disabled={idx === form.fields.length - 1}>
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </button>
                    </div>
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-medium text-ink-500 block mb-1">Field Label</label>
                        <input className="input text-sm py-1.5" value={field.label}
                          onChange={e => updateField(idx, { label: e.target.value })} placeholder="e.g. Project Code" />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-ink-500 block mb-1">Field Type</label>
                        <div className="relative">
                          <select className="input appearance-none pr-8 text-sm py-1.5 cursor-pointer"
                            value={field.type} onChange={e => updateField(idx, { type: e.target.value, options: [] })}>
                            {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-400 pointer-events-none" />
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-ink-500 block mb-1">Placeholder (optional)</label>
                        <input className="input text-sm py-1.5" value={field.placeholder}
                          onChange={e => updateField(idx, { placeholder: e.target.value })} placeholder="Hint text..." />
                      </div>
                      <div className="flex items-end pb-1">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input type="checkbox" checked={field.required}
                            onChange={e => updateField(idx, { required: e.target.checked })}
                            className="w-3.5 h-3.5 rounded accent-brand-600" />
                          <span className="text-sm text-ink-600">Required</span>
                        </label>
                      </div>
                    </div>
                    <button onClick={() => removeField(idx)} className="text-ink-200 hover:text-red-400 flex-shrink-0 mt-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {field.type === 'select' && (
                    <div className="ml-5">
                      <p className="text-[11px] font-medium text-ink-500 mb-1">Dropdown Options</p>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {field.options.map(opt => (
                          <span key={opt} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-paper-400 rounded text-xs text-ink-700">
                            {opt}
                            <button onClick={() => updateField(idx, { options: field.options.filter(o => o !== opt) })}
                              className="text-ink-300 hover:text-red-400"><X className="w-2.5 h-2.5" /></button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input className="input text-sm py-1 flex-1" value={field._optionInput}
                          onChange={e => updateField(idx, { _optionInput: e.target.value })}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOption(idx); }}}
                          placeholder="Add option..." />
                        <button onClick={() => addOption(idx)} className="btn-secondary text-xs px-2.5 py-1 flex-shrink-0">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button onClick={addField} className="flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700 font-medium">
              <Plus className="w-4 h-4" /> Add field
            </button>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setEditing(null)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {saving
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</>
                : <><Save className="w-4 h-4" /> {editing === 'new' ? 'Create Type' : 'Save Changes'}</>
              }
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Type List ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-ink-900 tracking-tight">Expense Types</h1>
          <p className="text-sm text-ink-400 mt-0.5 font-medium">Manage the types of expenses your team can submit</p>
        </div>
        <button onClick={startCreate} className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> New Type
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-ink-400 text-sm">
          <div className="w-4 h-4 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
          Loading…
        </div>
      ) : (
        <div className="card overflow-hidden divide-y divide-paper-300">
          {types.map(type => {
            const IconComp = ICON_MAP[type.icon] || Receipt;
            return (
              <div key={type.id} className="px-4 py-3 flex items-center gap-3 hover:bg-paper-100 transition-colors">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: type.color + '18' }}>
                  <IconComp className="w-[18px] h-[18px]" style={{ color: type.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-ink-800 text-sm font-semibold">{type.name}</p>
                    {type.is_builtin ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-paper-300 border border-paper-400 rounded text-ink-400 text-[10px]">
                        <Lock className="w-2.5 h-2.5" /> Built-in
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 bg-brand-100 border border-brand-200 rounded text-brand-700 text-[10px]">Custom</span>
                    )}
                  </div>
                  <p className="text-ink-400 text-xs truncate">{type.description || `${type.fields_schema?.length || 0} fields`}</p>
                </div>
                {!type.is_builtin && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => startEdit(type)} className="p-1.5 text-ink-300 hover:text-ink-700 transition-colors rounded" title="Edit">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setConfirm({ id: type.id, name: type.name })}
                      className="p-1.5 text-ink-300 hover:text-amber-500 transition-colors rounded" title="Archive">
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                {type.is_builtin && (
                  <Settings2 className="w-3.5 h-3.5 text-ink-300" />
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="card p-4 text-xs text-ink-500 space-y-1.5">
        <p className="text-ink-700 font-semibold mb-2">About custom types</p>
        <p>Built-in types (Petrol, Shipping, General) have specialized forms and cannot be removed.</p>
        <p>Custom types use a dynamic form built from your field definitions, with AI extraction powered by your hints.</p>
      </div>

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
