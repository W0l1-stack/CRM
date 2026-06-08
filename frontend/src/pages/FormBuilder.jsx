import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Type, Mail, Phone, Hash, AlignLeft, List, CheckSquare,
  GripVertical, Trash2, Plus, Settings2, X, ArrowUp, ArrowDown,
} from 'lucide-react';
import { useForm, useCreateForm, useUpdateForm } from '@/hooks/useForms';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageSpinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

const FIELD_TYPES = [
  { value: 'text', label: 'Text', icon: Type },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'tel', label: 'Phone', icon: Phone },
  { value: 'number', label: 'Number', icon: Hash },
  { value: 'textarea', label: 'Paragraph', icon: AlignLeft },
  { value: 'select', label: 'Dropdown', icon: List },
  { value: 'checkbox', label: 'Checkbox', icon: CheckSquare },
];
const typeMeta = (t) => FIELD_TYPES.find((f) => f.value === t) || FIELD_TYPES[0];

const slug = (s) =>
  (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'field';

const DEFAULT_FIELDS = [
  { label: 'Email', name: 'email', type: 'email', required: true },
  { label: 'Phone', name: 'phone', type: 'tel', required: false },
];

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
  const [selected, setSelected] = useState(0);
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);

  useEffect(() => {
    if (existing) {
      setName(existing.name || '');
      setFields(Array.isArray(existing.fields) && existing.fields.length ? existing.fields : DEFAULT_FIELDS);
      setSettings((s) => ({ ...s, ...(existing.settings || {}) }));
    }
  }, [existing]);

  if (!isNew && isLoading) return <PageSpinner label="Loading form…" />;

  const addField = (type) => {
    // Prefill the label with the field type's name as an editable starting
    // point. It then stays put — changing the type never rewrites it.
    const next = { label: typeMeta(type).label, name: '', type, required: false };
    if (type === 'select') next.options = ['Option 1', 'Option 2'];
    setFields((arr) => {
      setSelected(arr.length);
      return [...arr, next];
    });
  };
  // The label is locked to the field type, so changing the type updates it.
  const changeType = (i, type) =>
    setFields((arr) =>
      arr.map((f, idx) => {
        if (idx !== i) return f;
        const updated = { ...f, type, label: typeMeta(type).label };
        if (type === 'select' && !(f.options && f.options.length)) updated.options = ['Option 1', 'Option 2'];
        return updated;
      })
    );
  const setField = (i, patch) => setFields((arr) => arr.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  const removeField = (i) => {
    setFields((arr) => arr.filter((_, idx) => idx !== i));
    setSelected(-1);
  };
  const moveField = (i, dir) =>
    setFields((arr) => {
      const j = i + dir;
      if (j < 0 || j >= arr.length) return arr;
      const next = [...arr];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const onDrop = (target) => {
    setOverIdx(null);
    if (dragIdx === null || dragIdx === target) return setDragIdx(null);
    setFields((arr) => {
      const next = [...arr];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(target, 0, moved);
      return next;
    });
    setDragIdx(null);
  };

  const save = () => {
    // Label is locked to the field type. Keys stay unique — existing keys are
    // preserved (so the name/email mapping survives) and new ones derive from type.
    const used = new Set();
    const cleaned = fields.map((f) => {
      const label = typeMeta(f.type).label;
      let key = (f.name || '').trim() || slug(label);
      const base = key;
      let n = 2;
      while (used.has(key)) key = `${base}_${n++}`;
      used.add(key);
      return {
        ...f,
        label,
        name: key,
        options: f.type === 'select' ? (f.options || []).map((o) => o.trim()).filter(Boolean) : undefined,
      };
    });
    if (cleaned.length === 0) return;
    const body = { name: name.trim() || 'Untitled form', fields: cleaned, settings };
    if (isNew) {
      createForm.mutate(body, { onSuccess: () => navigate('/forms') });
    } else {
      updateForm.mutate({ id, ...body }, { onSuccess: () => navigate('/forms') });
    }
  };

  const saving = createForm.isPending || updateForm.isPending;

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link to="/forms">
          <ArrowLeft className="h-4 w-4" /> Back to forms
        </Link>
      </Button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Untitled form"
          className="max-w-sm text-lg font-semibold"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save form'}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        {/* Sidebar: palette + settings */}
        <div className="space-y-4 lg:order-1">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Add field</p>
            <div className="grid grid-cols-2 gap-2">
              {FIELD_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => addField(t.value)}
                  className="flex items-center gap-2 rounded-md border bg-card p-2.5 text-left text-sm font-medium transition-colors hover:border-primary/40 hover:bg-secondary"
                >
                  <t.icon className="h-4 w-4 text-muted-foreground" /> {t.label}
                </button>
              ))}
            </div>
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Form settings</CardTitle></CardHeader>
            <CardContent className="space-y-3">
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
            </CardContent>
          </Card>
        </div>

        {/* Canvas: the form, rendered as it will appear, with inline editing */}
        <div className="lg:order-2">
          <Card className="mx-auto max-w-2xl">
            <CardHeader className="border-b">
              <CardTitle>{name || 'Untitled form'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4">
              {fields.length === 0 && (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Add fields from the left to start building your form.
                </div>
              )}
              {fields.map((field, idx) => (
                <FieldRow
                  key={idx}
                  field={field}
                  index={idx}
                  count={fields.length}
                  open={selected === idx}
                  dragging={dragIdx === idx}
                  over={overIdx === idx && dragIdx !== null}
                  onSelect={() => setSelected(selected === idx ? -1 : idx)}
                  onChange={(patch) => setField(idx, patch)}
                  onChangeType={(t) => changeType(idx, t)}
                  onRemove={() => removeField(idx)}
                  onMove={(dir) => moveField(idx, dir)}
                  onDragStart={() => setDragIdx(idx)}
                  onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                  onDragOver={(e) => { e.preventDefault(); if (overIdx !== idx) setOverIdx(idx); }}
                  onDrop={() => onDrop(idx)}
                />
              ))}
              <div className="pt-2">
                <Button className="w-full" disabled>{settings.submit_label || 'Submit'}</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function FieldRow({
  field, index, count, open, dragging, over,
  onSelect, onChange, onChangeType, onRemove, onMove,
  onDragStart, onDragEnd, onDragOver, onDrop,
}) {
  const meta = typeMeta(field.type);
  const displayLabel = field.label || meta.label;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        'group rounded-lg border p-3 transition-all',
        open ? 'border-primary/50 bg-secondary/30' : 'border-transparent hover:border-border hover:bg-secondary/20',
        dragging && 'opacity-50',
        over && 'ring-2 ring-primary'
      )}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="mt-1 h-4 w-4 shrink-0 cursor-grab text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        {/* Rendered preview of the field as the visitor will see it */}
        <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
          <FieldPreview field={field} label={displayLabel} />
        </button>
        <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => onMove(-1)} disabled={index === 0}>
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => onMove(1)} disabled={index === count - 1}>
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className={cn('h-8 w-8', open && 'text-primary')} onClick={onSelect}>
            <Settings2 className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {open && (
        <div className="mt-3 space-y-3 border-t pt-3">
          <div className="space-y-1">
            <Label>Field type</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={field.type}
              onChange={(e) => onChangeType(e.target.value)}
            >
              {FIELD_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground">The label shown to visitors matches the field type.</p>
          </div>

          {field.type !== 'checkbox' && (
            <div className="space-y-1">
              <Label>Placeholder</Label>
              <Input value={field.placeholder || ''} onChange={(e) => onChange({ placeholder: e.target.value })} />
            </div>
          )}

          {field.type === 'select' && (
            <OptionsEditor options={field.options || []} onChange={(options) => onChange({ options })} />
          )}

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={field.required}
                onChange={(e) => onChange({ required: e.target.checked })}
              />
              Required
            </label>
            <span className="text-xs text-muted-foreground">field key: {field.name || slug(field.label || field.type)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function OptionsEditor({ options, onChange }) {
  const setOption = (i, value) => onChange(options.map((o, idx) => (idx === i ? value : o)));
  const addOption = () => onChange([...options, `Option ${options.length + 1}`]);
  const removeOption = (i) => onChange(options.filter((_, idx) => idx !== i));
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= options.length) return;
    const next = [...options];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <Label>Dropdown options</Label>
      <div className="space-y-2">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-1">
            <Input value={opt} onChange={(e) => setOption(i, e.target.value)} placeholder={`Option ${i + 1}`} />
            <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={() => move(i, -1)} disabled={i === 0}>
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={() => move(i, 1)} disabled={i === options.length - 1}>
              <ArrowDown className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={() => removeOption(i)} disabled={options.length <= 1}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={addOption}>
        <Plus className="h-4 w-4" /> Add option
      </Button>
    </div>
  );
}

// FieldPreview renders the field exactly as the public form will (read-only),
// so the canvas doubles as a live preview.
function FieldPreview({ field, label }) {
  if (field.type === 'checkbox') {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" disabled className="h-4 w-4" />
        <span>{label}{field.required && <span className="text-destructive"> *</span>}</span>
      </label>
    );
  }
  return (
    <div className="space-y-1">
      <span className="text-sm font-medium">
        {label}{field.required && <span className="text-destructive"> *</span>}
      </span>
      {field.type === 'textarea' ? (
        <textarea disabled placeholder={field.placeholder} className="flex min-h-[70px] w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm" />
      ) : field.type === 'select' ? (
        <select disabled className="flex h-10 w-full rounded-md border border-input bg-muted/30 px-3 text-sm">
          {(field.options || []).map((o, j) => <option key={j}>{o}</option>)}
        </select>
      ) : (
        <input
          disabled
          placeholder={field.placeholder}
          type={field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : 'text'}
          className="flex h-10 w-full rounded-md border border-input bg-muted/30 px-3 text-sm"
        />
      )}
    </div>
  );
}
