import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { api, unwrap } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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

  return (
    <Centered>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{form.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            {(form.fields || []).map((f) => {
              const setVal = (val) => setValues((v) => ({ ...v, [f.name]: val }));
              if (f.type === 'checkbox') {
                return (
                  <label key={f.name} className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 accent-primary"
                      required={f.required}
                      checked={values[f.name] === 'yes'}
                      onChange={(e) => setVal(e.target.checked ? 'yes' : '')}
                    />
                    <span>
                      {f.label || f.name}
                      {f.required && <span className="text-destructive"> *</span>}
                    </span>
                  </label>
                );
              }
              return (
                <div key={f.name} className="space-y-1">
                  <Label htmlFor={f.name}>
                    {f.label || f.name}
                    {f.required && <span className="text-destructive"> *</span>}
                  </Label>
                  {f.type === 'textarea' ? (
                    <textarea
                      id={f.name}
                      required={f.required}
                      placeholder={f.placeholder}
                      className="flex min-h-[90px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={values[f.name] || ''}
                      onChange={(e) => setVal(e.target.value)}
                    />
                  ) : f.type === 'select' ? (
                    <select
                      id={f.name}
                      required={f.required}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={values[f.name] || ''}
                      onChange={(e) => setVal(e.target.value)}
                    >
                      <option value="">Select…</option>
                      {(f.options || []).map((o, i) => (
                        <option key={i} value={o}>{o}</option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      id={f.name}
                      type={f.type === 'email' ? 'email' : f.type === 'tel' ? 'tel' : f.type === 'number' ? 'number' : 'text'}
                      required={f.required}
                      placeholder={f.placeholder}
                      value={values[f.name] || ''}
                      onChange={(e) => setVal(e.target.value)}
                    />
                  )}
                </div>
              );
            })}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Submitting…' : (form.settings?.submit_label || 'Submit')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </Centered>
  );
}

function Centered({ children }) {
  return <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">{children}</div>;
}
