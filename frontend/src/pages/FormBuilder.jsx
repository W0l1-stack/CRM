import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, User, Mail, Phone, Building2, MapPin, Briefcase, Globe,
  Type, AlignLeft, Hash, Calendar, List, CircleDot, ListChecks, CheckSquare,
  GripVertical, Trash2, Plus, Pencil, X,
} from 'lucide-react';
import { useForm, useCreateForm, useUpdateForm } from '@/hooks/useForms';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { PageSpinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

const CATALOG = {
  'Contact fields': [
    { type: 'name', label: 'Name', input: 'text', key: 'name', icon: User },
    { type: 'email', label: 'Email', input: 'email', key: 'email', icon: Mail },
    { type: 'phone', label: 'Phone', input: 'tel', key: 'phone', icon: Phone },
    { type: 'company', label: 'Company', input: 'text', key: 'company', icon: Building2 },
    { type: 'address', label: 'Address', input: 'text', key: 'address', icon: MapPin },
    { type: 'job_title', label: 'Job title', input: 'text', key: 'job_title', icon: Briefcase },
    { type: 'website', label: 'Website', input: 'text', key: 'website', icon: Globe },
  ],
  'Basic fields': [
    { type: 'single_line', label: 'Single line', input: 'text', icon: Type },
    { type: 'paragraph', label: 'Paragraph', input: 'textarea', icon: AlignLeft },
    { type: 'number', label: 'Number', input: 'number', icon: Hash },
    { type: 'date', label: 'Date', input: 'date', icon: Calendar },
    { type: 'dropdown', label: 'Dropdown', input: 'select', icon: List, options: true },
    { type: 'radio', label: 'Radio', input: 'radio', icon: CircleDot, options: true },
    { type: 'multiselect', label: 'Multi-select', input: 'multiselect', icon: ListChecks, options: true },
    { type: 'checkbox', label: 'Checkbox', input: 'checkbox', icon: CheckSquare },
  ],
};
const BY_TYPE = Object.fromEntries(Object.values(CATALOG).flat().map((f) => [f.type, f]));
const metaFor = (type) => {
  if (BY_TYPE[type]) return BY_TYPE[type];
  const alias = { text: 'single_line', tel: 'phone', textarea: 'paragraph', select: 'dropdown' }[type];
  return BY_TYPE[alias] || { type, label: type, input: 'text', icon: Type };
};
const inputFor = (type) => metaFor(type).input || 'text';
const hasOptions = (type) => ['dropdown', 'select', 'radio', 'multiselect'].includes(type);
const slug = (s) =>
  (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'field';

const DEFAULT_FIELDS = [
  { type: 'name', label: 'Name', name: 'name', required: true, width: 'half' },
  { type: 'email', label: 'Email', name: 'email', required: true, width: 'half' },
  { type: 'phone', label: 'Phone', name: 'phone', required: false, width: 'full' },
];
const defaultField = (type) => {
  const c = metaFor(type);
  const f = { type, label: c.label, name: c.key || '', required: false, width: 'full' };
  if (c.options) f.options = ['Option 1', 'Option 2'];
  return f;
};

const TYPE_MIME = 'application/x-field-type';
const INDEX_MIME = 'application/x-field-index';

export default function FormBuilder() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const { data: existing, isLoading } = useForm(isNew ? null : id);
  const createForm = useCreateForm();
  const updateForm = useUpdateForm();

  const [name, setName] = useState('');
  const [fields, setFields] = useState(DEFAULT_FIELDS);
  const [settings, setSettings] = useState({
    submit_label: 'Submit',
    thank_you_message: 'Thanks! We’ll be in touch.',
    redirect_url: '',
  });
  const [tab, setTab] = useState('edit');
  const [editing, setEditing] = useState(null);
  const [overIdx, setOverIdx] = useState(null);

  useEffect(() => {
    if (existing) {
      setName(existing.name || '');
      setFields(Array.isArray(existing.fields) && existing.fields.length ? existing.fields : DEFAULT_FIELDS);
      setSettings((s) => ({ ...s, ...(existing.settings || {}) }));
    }
  }, [existing]);

  if (!isNew && isLoading) return <PageSpinner label="Loading form…" />;

  const insertAt = (idx, field) => setFields((arr) => { const n = [...arr]; n.splice(idx, 0, field); return n; });
  const append = (field) => setFields((arr) => [...arr, field]);
  const setField = (i, patch) => setFields((arr) => arr.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  const removeField = (i) => setFields((arr) => arr.filter((_, idx) => idx !== i));
  const moveField = (from, to) =>
    setFields((arr) => {
      if (from === to) return arr;
      const n = [...arr];
      const [moved] = n.splice(from, 1);
      n.splice(to > from ? to - 1 : to, 0, moved);
      return n;
    });

  const onDropField = (targetIdx) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    setOverIdx(null);
    const type = e.dataTransfer.getData(TYPE_MIME);
    const fromIdx = e.dataTransfer.getData(INDEX_MIME);
    if (type) insertAt(targetIdx, defaultField(type));
    else if (fromIdx !== '') moveField(Number(fromIdx), targetIdx);
  };
  const onDropEnd = (e) => {
    e.preventDefault();
    setOverIdx(null);
    const type = e.dataTransfer.getData(TYPE_MIME);
    const fromIdx = e.dataTransfer.getData(INDEX_MIME);
    if (type) append(defaultField(type));
    else if (fromIdx !== '') moveField(Number(fromIdx), fields.length);
  };

  const save = () => {
    const used = new Set();
    const cleaned = fields.map((f) => {
      const c = metaFor(f.type);
      const label = (f.label || '').trim() || c.label || 'Field';
      let key = (f.name || '').trim() || c.key || slug(label);
      const base = key;
      let n = 2;
      while (used.has(key)) key = `${base}_${n++}`;
      used.add(key);
      return {
        type: f.type, label, name: key,
        required: Boolean(f.required),
        placeholder: f.placeholder || undefined,
        width: f.width === 'half' ? 'half' : 'full',
        options: hasOptions(f.type) ? (f.options || []).map((o) => o.trim()).filter(Boolean) : undefined,
      };
    });
    if (cleaned.length === 0) return;
    const body = { name: name.trim() || 'Untitled form', fields: cleaned, settings };
    if (isNew) createForm.mutate(body, { onSuccess: () => navigate('/forms') });
    else updateForm.mutate({ id, ...body }, { onSuccess: () => navigate('/forms') });
  };

  const saving = createForm.isPending || updateForm.isPending;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link to="/forms"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Form</p>
              <Badge variant="secondary">Draft</Badge>
            </div>
            <Input
              placeholder="Untitled form"
              className="h-8 border-0 px-0 text-xl font-semibold shadow-none focus-visible:ring-0"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-md border bg-muted/40 p-0.5">
            {['edit', 'preview'].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'rounded px-4 py-1.5 text-sm font-medium capitalize transition-colors',
                  tab === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t}
              </button>
            ))}
          </div>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save form'}</Button>
        </div>
      </div>

      {tab === 'preview' ? (
        <PreviewForm name={name} fields={fields} settings={settings} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr]">
          {/* Palette */}
          <div className="space-y-5">
            <p className="text-sm font-semibold">Form elements</p>
            {Object.entries(CATALOG).map(([group, items]) => (
              <div key={group}>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{group}</p>
                <div className="space-y-1.5">
                  {items.map((it) => (
                    <div
                      key={it.type}
                      draggable
                      onDragStart={(e) => { e.dataTransfer.setData(TYPE_MIME, it.type); e.dataTransfer.effectAllowed = 'copy'; }}
                      onDoubleClick={() => append(defaultField(it.type))}
                      title="Drag onto the form (or double-click to add)"
                      className="flex cursor-grab items-center gap-2.5 rounded-lg border bg-card px-3 py-2 text-sm font-medium shadow-sm transition-all hover:-translate-y-px hover:border-primary/50 hover:shadow active:cursor-grabbing"
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground/60" />
                      <it.icon className="h-4 w-4 text-primary" />
                      {it.label}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground">Drag elements onto the form. Double-click to append.</p>
          </div>

          {/* Canvas */}
          <div className="space-y-4">
            <div
              className="rounded-xl border bg-muted/40 p-6"
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDropEnd}
            >
              {/* WYSIWYG: the actual form, fields rendered as real inputs you edit in place */}
              <Card className="mx-auto max-w-xl p-6 shadow-sm">
                <p className="mb-5 text-xl font-semibold">{name || 'Untitled form'}</p>
                {fields.length === 0 ? (
                  <div className="rounded-xl border-2 border-dashed p-14 text-center text-sm text-muted-foreground">
                    Drag a field from the left to start building your form.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {fields.map((field, idx) => (
                      <div
                        key={idx}
                        draggable
                        onDragStart={(e) => { e.dataTransfer.setData(INDEX_MIME, String(idx)); e.dataTransfer.effectAllowed = 'move'; }}
                        onDragOver={(e) => { e.preventDefault(); if (overIdx !== idx) setOverIdx(idx); }}
                        onDragLeave={() => setOverIdx((o) => (o === idx ? null : o))}
                        onDrop={onDropField(idx)}
                        onClick={() => setEditing(idx)}
                        className={cn(
                          'group relative cursor-pointer rounded-md p-2 transition-all',
                          field.width !== 'half' && 'col-span-2',
                          overIdx === idx ? 'ring-2 ring-primary' : 'hover:bg-secondary/40 hover:ring-2 hover:ring-primary/30'
                        )}
                      >
                        <div className="absolute -top-3 right-2 z-10 flex items-center gap-0.5 rounded-md border bg-card px-0.5 shadow-sm opacity-0 transition-opacity group-hover:opacity-100">
                          <span className="cursor-grab rounded p-1 text-muted-foreground hover:bg-secondary"><GripVertical className="h-3.5 w-3.5" /></span>
                          <button type="button" onClick={(e) => { e.stopPropagation(); setEditing(idx); }} className="rounded p-1 text-muted-foreground hover:bg-secondary"><Pencil className="h-3.5 w-3.5" /></button>
                          <button type="button" onClick={(e) => { e.stopPropagation(); removeField(idx); }} className="rounded p-1 text-muted-foreground hover:bg-secondary"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                        <div className="pointer-events-none">
                          <PreviewField field={field} />
                        </div>
                      </div>
                    ))}
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={onDropEnd}
                      className="col-span-2 rounded-md border-2 border-dashed py-2.5 text-center text-xs text-muted-foreground"
                    >
                      Drop a field here
                    </div>
                  </div>
                )}
                <Button className="mt-6 w-full" disabled>{settings.submit_label || 'Submit'}</Button>
              </Card>
            </div>

            <Card className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
              <div className="space-y-1">
                <Label>Submit button text</Label>
                <Input value={settings.submit_label || ''} onChange={(e) => setSettings((s) => ({ ...s, submit_label: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Thank-you message</Label>
                <Input value={settings.thank_you_message || ''} onChange={(e) => setSettings((s) => ({ ...s, thank_you_message: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Redirect URL (optional)</Label>
                <Input placeholder="https://…" value={settings.redirect_url || ''} onChange={(e) => setSettings((s) => ({ ...s, redirect_url: e.target.value }))} />
              </div>
            </Card>
          </div>
        </div>
      )}

      {editing != null && fields[editing] && (
        <FieldPropertiesDialog
          field={fields[editing]}
          meta={metaFor(fields[editing].type)}
          onChange={(patch) => setField(editing, patch)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

// PreviewForm renders the form as a visitor sees it (read-only).
function PreviewForm({ name, fields, settings }) {
  return (
    <div className="rounded-xl border bg-muted/40 p-6">
      <Card className="mx-auto max-w-xl p-6">
        <p className="mb-5 text-xl font-semibold">{name || 'Untitled form'}</p>
        <div className="grid grid-cols-2 gap-4">
          {fields.map((f, idx) => (
            <div key={idx} className={cn(f.width !== 'half' && 'col-span-2')}>
              <PreviewField field={f} />
            </div>
          ))}
          <Button className="col-span-2 w-full" disabled>{settings.submit_label || 'Submit'}</Button>
        </div>
      </Card>
    </div>
  );
}

// PreviewField renders a field as a real, interactive input. In the edit canvas
// it's wrapped in `pointer-events-none` so it stays static; the Preview tab
// renders it directly so the dropdown/checkboxes actually work.
function PreviewField({ field: f }) {
  const kind = inputFor(f.type);
  const label = f.label || metaFor(f.type).label;
  if (kind === 'checkbox') {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="h-4 w-4 accent-primary" />
        {label}{f.required && <span className="text-destructive"> *</span>}
      </label>
    );
  }
  return (
    <div className="space-y-1">
      <span className="text-sm font-medium">{label}{f.required && <span className="text-destructive"> *</span>}</span>
      {kind === 'textarea' ? (
        <textarea placeholder={f.placeholder} className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
      ) : kind === 'select' ? (
        <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" defaultValue="">
          <option value="" disabled>Select…</option>
          {(f.options || []).map((o, i) => <option key={i} value={o}>{o}</option>)}
        </select>
      ) : kind === 'radio' || kind === 'multiselect' ? (
        <div className="space-y-1 pt-1">
          {(f.options || []).map((o, i) => (
            <label key={i} className="flex items-center gap-2 text-sm">
              <input type={kind === 'radio' ? 'radio' : 'checkbox'} name={f.name} className="h-4 w-4 accent-primary" />{o}
            </label>
          ))}
        </div>
      ) : (
        <input placeholder={f.placeholder} type={kind} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
      )}
    </div>
  );
}

function FieldPropertiesDialog({ field, meta, onChange, onClose }) {
  return (
    <Dialog open onClose={onClose} title="Field properties" className="max-w-md">
      <div className="space-y-3">
        <div className="space-y-1">
          <Label>Label</Label>
          <Input value={field.label || ''} placeholder={meta.label} onChange={(e) => onChange({ label: e.target.value })} />
          <p className="text-[11px] text-muted-foreground">Type: {meta.label} · key: {field.name || slug(field.label || meta.label)}</p>
        </div>
        {meta.input !== 'checkbox' && (
          <div className="space-y-1">
            <Label>Placeholder</Label>
            <Input value={field.placeholder || ''} onChange={(e) => onChange({ placeholder: e.target.value })} />
          </div>
        )}
        {hasOptions(field.type) && <OptionsEditor options={field.options || []} onChange={(options) => onChange({ options })} />}
        <div className="space-y-1">
          <Label>Width</Label>
          <div className="flex gap-2">
            {['full', 'half'].map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => onChange({ width: w })}
                className={cn(
                  'flex-1 rounded-md border px-3 py-1.5 text-sm transition-colors',
                  (field.width || 'full') === w ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-secondary'
                )}
              >
                {w === 'full' ? 'Full width' : 'Half'}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-primary" checked={Boolean(field.required)} onChange={(e) => onChange({ required: e.target.checked })} />
          Required
        </label>
        <div className="flex justify-end pt-2">
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </Dialog>
  );
}

function OptionsEditor({ options, onChange }) {
  const setOption = (i, value) => onChange(options.map((o, idx) => (idx === i ? value : o)));
  const addOption = () => onChange([...options, `Option ${options.length + 1}`]);
  const removeOption = (i) => onChange(options.filter((_, idx) => idx !== i));
  return (
    <div className="space-y-2">
      <Label>Options</Label>
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-1">
          <Input value={opt} onChange={(e) => setOption(i, e.target.value)} placeholder={`Option ${i + 1}`} />
          <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={() => removeOption(i)} disabled={options.length <= 1}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addOption}>
        <Plus className="h-4 w-4" /> Add option
      </Button>
    </div>
  );
}
