import { useState } from 'react';
import { Plus, Trash2, Copy, FileText } from 'lucide-react';
import { useForms, useCreateForm, useDeleteForm } from '@/hooks/useForms';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const selectClass = 'flex h-10 rounded-md border border-input bg-background px-2 text-sm';
const FIELD_TYPES = ['text', 'email', 'tel', 'textarea'];

export default function Forms() {
  const { data: forms = [], isLoading } = useForms();
  const deleteForm = useDeleteForm();
  const [showCreate, setShowCreate] = useState(false);

  const publicUrl = (id) => `${window.location.origin}/form/${id}`;
  const embed = (id) => `<iframe src="${publicUrl(id)}" width="100%" height="520" frameborder="0"></iframe>`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Forms</h1>
        <Button onClick={() => setShowCreate((v) => !v)}>
          <Plus className="h-4 w-4" />
          New form
        </Button>
      </div>

      {showCreate && <CreateFormForm onDone={() => setShowCreate(false)} />}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : forms.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No forms yet. Create one to capture leads — submissions auto-create contacts and fire the
            <span className="font-medium"> form_submitted </span> automation trigger.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {forms.map((f) => (
            <Card key={f.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base">{f.name}</CardTitle>
                  <span className="text-xs text-muted-foreground">{f.submission_count} submissions</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => window.open(publicUrl(f.id), '_blank')}>
                    Open
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => navigator.clipboard?.writeText(embed(f.id))}>
                    <Copy className="h-4 w-4" /> Embed
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteForm.mutate(f.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Fields: {(f.fields || []).map((fl) => fl.label || fl.name).join(', ') || '—'}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateFormForm({ onDone }) {
  const createForm = useCreateForm();
  const [name, setName] = useState('');
  const [thankYou, setThankYou] = useState('Thanks! We’ll be in touch.');
  const [fields, setFields] = useState([
    { label: 'Name', name: 'name', type: 'text', required: true },
    { label: 'Email', name: 'email', type: 'email', required: true },
  ]);

  const setField = (i, patch) => setFields((arr) => arr.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));

  const submit = (e) => {
    e.preventDefault();
    createForm.mutate(
      { name, fields, settings: { thank_you_message: thankYou } },
      { onSuccess: onDone }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">New form</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={submit}>
          <Input placeholder="Form name *" required value={name} onChange={(e) => setName(e.target.value)} />

          <div className="space-y-2">
            <p className="text-sm font-medium">Fields</p>
            {fields.map((field, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 rounded-md border p-2">
                <Input
                  placeholder="Label"
                  className="max-w-[160px]"
                  value={field.label}
                  onChange={(e) => setField(i, { label: e.target.value })}
                />
                <Input
                  placeholder="field_name"
                  className="max-w-[160px]"
                  value={field.name}
                  onChange={(e) => setField(i, { name: e.target.value })}
                />
                <select className={selectClass} value={field.type} onChange={(e) => setField(i, { type: e.target.value })}>
                  {FIELD_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(e) => setField(i, { required: e.target.checked })}
                  />
                  required
                </label>
                <Button type="button" variant="ghost" size="icon" onClick={() => setFields((arr) => arr.filter((_, idx) => idx !== i))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFields((arr) => [...arr, { label: '', name: '', type: 'text', required: false }])}
            >
              <Plus className="h-4 w-4" /> Add field
            </Button>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">Thank-you message</p>
            <Input value={thankYou} onChange={(e) => setThankYou(e.target.value)} />
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={createForm.isPending}>
              {createForm.isPending ? 'Saving…' : 'Save form'}
            </Button>
            <Button type="button" variant="ghost" onClick={onDone}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
