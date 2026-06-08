import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Type, Mail, Phone, Hash, AlignLeft, List, CheckSquare,
  GripVertical, Trash2, Plus, FileText,
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
  { label: 'Name', name: 'name', type: 'text', required: true },
  { label: 'Email', name: 'email', type: 'email', required: true },
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
    const meta = typeMeta(type);
    const next = { label: meta.label, name: '', type, required: false };
    if (type === 'select') next.options = ['Option 1', 'Option 2'];
    setFields((arr) => {
      setSelected(arr.length);
      return [...arr, next];
    });
  };
  const setField = (i, patch) => setFields((arr) => arr.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  const removeField = (i) =>
    setFields((arr) => arr.filter((_, idx) => idx !== i));

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
    // Ensure every field has a stable key derived from its label.
    const cleaned = fields
      .filter((f) => (f.label || '').trim())
      .map((f) => ({
        ...f,
        name: (f.name || '').trim() || slug(f.label),
        label: f.label.trim(),
        options: f.type === 'select' ? (f.options || []).filter(Boolean) : undefined,
      }));
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
          placeholder="Form name"
          className="max-w-sm text-lg font-semibold"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save form'}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        {/* Canvas: field list */}
        <div className="space-y-3">
          {fields.length === 0 && (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              Add fields from the right to start building your form.
            </div>
          )}
          {fields.map((field, idx) => {
            const meta = typeMeta(field.type);
            const Icon = meta.icon;
            const isOpen = selected === idx;
            return (
              <Card
                key={idx}
                draggable
                onDragStart={() => setDragIdx(idx)}
                onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                onDragOver={(e) => { e.preventDefault(); if (overIdx !== idx) setOverIdx(idx); }}
                onDrop={() => onDrop(idx)}
                className={cn(
                  'p-3 transition-all',
                  dragIdx === idx && 'opacity-50',
                  overIdx === idx && dragIdx !== null && 'ring-2 ring-primary'
                )}
              >
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground" />
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <button
                    type="button"
                    className="flex-1 text-left text-sm font-medium"
                    onClick={() => setSelected(isOpen ? -1 : idx)}
                  >
                    {field.label || 'Untitled field'}
                    {field.required && <span className="text-destructive"> *</span>}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">{meta.label}</span>
                  </button>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeField(idx)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {isOpen && (
                  <div className="mt-3 space-y-3 border-t pt-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Label</Label>
                        <Input value={field.label} onChange={(e) => setField(idx, { label: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <Label>Type</Label>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                          value={field.type}
                          onChange={(e) => setField(idx, { type: e.target.value, options: e.target.value === 'select' ? field.options || ['Option 1'] : undefined })}
                        >
                          {FIELD_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {field.type !== 'checkbox' && (
                      <div className="space-y-1">
                        <Label>Placeholder</Label>
                        <Input value={field.placeholder || ''} onChange={(e) => setField(idx, { placeholder: e.target.value })} />
                      </div>
                    )}
                    {field.type === 'select' && (
                      <div className="space-y-1">
                        <Label>Options (one per line)</Label>
                        <textarea
                          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={(field.options || []).join('\n')}
                          onChange={(e) => setField(idx, { options: e.target.value.split('\n') })}
                        />
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-primary"
                          checked={field.required}
                          onChange={(e) => setField(idx, { required: e.target.checked })}
                        />
                        Required
                      </label>
                      <span className="text-xs text-muted-foreground">key: {field.name || slug(field.label)}</span>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        {/* Sidebar: palette + settings + preview */}
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Add field</p>
            <div className="grid grid-cols-2 gap-2">
              {FIELD_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => addField(t.value)}
                  className="flex items-center gap-2 rounded-md border bg-card p-2 text-left text-sm font-medium transition-colors hover:bg-secondary"
                >
                  <t.icon className="h-4 w-4 text-muted-foreground" /> {t.label}
                </button>
              ))}
            </div>
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Settings</CardTitle></CardHeader>
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

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Live preview</CardTitle></CardHeader>
            <CardContent>
              <FormPreview name={name} fields={fields} submitLabel={settings.submit_label} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// FormPreview renders the form roughly as the public page will, so the builder
// shows a real result instead of a config list.
export function FormPreview({ name, fields, submitLabel }) {
  return (
    <div className="rounded-md border bg-background p-4">
      <p className="mb-3 flex items-center gap-2 font-semibold">
        <FileText className="h-4 w-4 text-primary" /> {name || 'Untitled form'}
      </p>
      <div className="space-y-3">
        {fields.map((f, i) => (
          <div key={i} className="space-y-1">
            {f.type !== 'checkbox' && (
              <label className="text-sm font-medium">
                {f.label || 'Field'}{f.required && <span className="text-destructive"> *</span>}
              </label>
            )}
            {f.type === 'textarea' ? (
              <textarea disabled placeholder={f.placeholder} className="flex min-h-[70px] w-full rounded-md border border-input bg-muted/40 px-3 py-2 text-sm" />
            ) : f.type === 'select' ? (
              <select disabled className="flex h-10 w-full rounded-md border border-input bg-muted/40 px-3 text-sm">
                {(f.options || []).map((o, j) => <option key={j}>{o}</option>)}
              </select>
            ) : f.type === 'checkbox' ? (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" disabled className="h-4 w-4" /> {f.label}{f.required && <span className="text-destructive"> *</span>}
              </label>
            ) : (
              <input disabled placeholder={f.placeholder} type={f.type === 'email' ? 'email' : f.type === 'number' ? 'number' : 'text'} className="flex h-10 w-full rounded-md border border-input bg-muted/40 px-3 text-sm" />
            )}
          </div>
        ))}
        <Button type="button" className="w-full" disabled>{submitLabel || 'Submit'}</Button>
      </div>
    </div>
  );
}
