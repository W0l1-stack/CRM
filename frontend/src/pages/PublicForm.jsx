import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { api, unwrap } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// Map a (possibly semantic or legacy) field type to a concrete input kind.
const inputFor = (type) => {
  switch (type) {
    case 'email': return 'email';
    case 'phone': case 'tel': return 'tel';
    case 'number': return 'number';
    case 'date': return 'date';
    case 'paragraph': case 'textarea': return 'textarea';
    case 'dropdown': case 'select': return 'select';
    case 'radio': return 'radio';
    case 'multiselect': return 'multiselect';
    case 'checkbox': return 'checkbox';
    default: return 'text';
  }
};

export default function PublicForm() {
  const { id } = useParams();
  const [form, setForm] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [values, setValues] = useState({});
  const [done, setDone] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get(`/public/forms/${id}`).then(unwrap).then(setForm).catch(() => setNotFound(true));
  }, [id]);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await api.post(`/public/forms/${id}/submit`, { values }).then(unwrap);
      const settings = res.settings || {};
      if (settings.redirect_url) {
        window.location.href = settings.redirect_url;
        return;
      }
      setDone(settings.thank_you_message || 'Thanks! Your submission was received.');
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Could not submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (notFound) return <Centered>This form is unavailable.</Centered>;
  if (!form) return <Centered>Loading…</Centered>;
  if (done) {
    return (
      <Centered>
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <CheckCircle2 className="h-10 w-10 text-primary" />
            <p>{done}</p>
          </CardContent>
        </Card>
      </Centered>
    );
  }

  const setVal = (name, val) => setValues((v) => ({ ...v, [name]: val }));

  return (
    <Centered>
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>{form.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid grid-cols-2 gap-4" onSubmit={submit}>
            {(form.fields || []).map((f) => (
              <div key={f.name} className={cn(f.width !== 'half' && 'col-span-2')}>
                <FormFieldInput field={f} value={values[f.name]} onChange={(val) => setVal(f.name, val)} />
              </div>
            ))}
            {error && <p className="col-span-2 text-sm text-destructive">{error}</p>}
            <Button type="submit" className="col-span-2 w-full" disabled={submitting}>
              {submitting ? 'Submitting…' : (form.settings?.submit_label || 'Submit')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </Centered>
  );
}

function FormFieldInput({ field: f, value, onChange }) {
  const kind = inputFor(f.type);
  const label = f.label || f.name;
  const req = f.required;

  if (kind === 'checkbox') {
    return (
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 accent-primary"
          required={req}
          checked={value === 'yes'}
          onChange={(e) => onChange(e.target.checked ? 'yes' : '')}
        />
        <span>{label}{req && <span className="text-destructive"> *</span>}</span>
      </label>
    );
  }

  return (
    <div className="space-y-1">
      <Label htmlFor={f.name}>{label}{req && <span className="text-destructive"> *</span>}</Label>
      {kind === 'textarea' ? (
        <textarea
          id={f.name}
          required={req}
          placeholder={f.placeholder}
          className="flex min-h-[90px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : kind === 'select' ? (
        <select
          id={f.name}
          required={req}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select…</option>
          {(f.options || []).map((o, i) => <option key={i} value={o}>{o}</option>)}
        </select>
      ) : kind === 'radio' ? (
        <div className="space-y-1.5 pt-1">
          {(f.options || []).map((o, i) => (
            <label key={i} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={f.name}
                className="h-4 w-4 accent-primary"
                required={req}
                checked={value === o}
                onChange={() => onChange(o)}
              />
              {o}
            </label>
          ))}
        </div>
      ) : kind === 'multiselect' ? (
        <div className="space-y-1.5 pt-1">
          {(f.options || []).map((o, i) => {
            const arr = (value || '').split(',').map((s) => s.trim()).filter(Boolean);
            const checked = arr.includes(o);
            return (
              <label key={i} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={checked}
                  onChange={(e) => {
                    const next = e.target.checked ? [...arr, o] : arr.filter((x) => x !== o);
                    onChange(next.join(', '));
                  }}
                />
                {o}
              </label>
            );
          })}
        </div>
      ) : (
        <Input
          id={f.name}
          type={kind}
          required={req}
          placeholder={f.placeholder}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

function Centered({ children }) {
  return <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">{children}</div>;
}
