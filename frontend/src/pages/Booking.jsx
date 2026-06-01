import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { CalendarCheck } from 'lucide-react';
import { api, unwrap } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function Booking() {
  const { typeId } = useParams();
  const [type, setType] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [slots, setSlots] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [booked, setBooked] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .get(`/public/appointment-types/${typeId}`)
      .then(unwrap)
      .then(setType)
      .catch(() => setNotFound(true));
  }, [typeId]);

  useEffect(() => {
    if (!typeId || !date) return;
    setSelected(null);
    api
      .get(`/public/appointment-types/${typeId}/slots`, { params: { date } })
      .then(unwrap)
      .then((d) => setSlots(d.slots || []))
      .catch(() => setSlots([]));
  }, [typeId, date]);

  const submit = async (e) => {
    e.preventDefault();
    if (!selected) {
      setError('Please pick a time slot.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const appt = await api
        .post(`/public/appointment-types/${typeId}/book`, { ...form, starts_at: selected })
        .then(unwrap);
      setBooked(appt);
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Could not book. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (notFound) {
    return <Centered>This booking page is unavailable.</Centered>;
  }
  if (!type) {
    return <Centered>Loading…</Centered>;
  }
  if (booked) {
    return (
      <Centered>
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-primary" /> You're booked!
            </CardTitle>
            <CardDescription>
              {type.name} on {dayjs(booked.starts_at).format('dddd, MMM D [at] h:mm A')}.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            A confirmation will be sent to {form.email}.
          </CardContent>
        </Card>
      </Centered>
    );
  }

  return (
    <Centered>
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>{type.name}</CardTitle>
          <CardDescription>{type.duration_minutes}-minute meeting · pick a time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Date</Label>
                <Input type="date" value={date} min={dayjs().format('YYYY-MM-DD')} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {slots.length === 0 ? (
                  <p className="col-span-3 text-sm text-muted-foreground">No open slots for this day.</p>
                ) : (
                  slots.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSelected(s)}
                      className={cn(
                        'rounded-md border px-2 py-1.5 text-sm transition-colors',
                        selected === s ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-secondary'
                      )}
                    >
                      {dayjs(s).format('h:mm A')}
                    </button>
                  ))
                )}
              </div>
            </div>

            <form className="space-y-3" onSubmit={submit}>
              <div className="space-y-1">
                <Label htmlFor="name">Name</Label>
                <Input id="name" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="phone">Phone (optional)</Label>
                <Input id="phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Booking…' : selected ? `Book ${dayjs(selected).format('h:mm A')}` : 'Select a time'}
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </Centered>
  );
}

function Centered({ children }) {
  return <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">{children}</div>;
}
