import { useState } from 'react';
import dayjs from 'dayjs';
import { Plus, Trash2, Copy, CalendarClock } from 'lucide-react';
import {
  useAppointmentTypes,
  useCreateAppointmentType,
  useDeleteAppointmentType,
  useAppointments,
  useUpdateAppointmentStatus,
} from '@/hooks/useAppointments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const selectClass = 'flex h-9 rounded-md border border-input bg-background px-2 text-sm';

export default function Calendar() {
  const { data: types = [] } = useAppointmentTypes();
  const { data: appointments = [] } = useAppointments();
  const createType = useCreateAppointmentType();
  const deleteType = useDeleteAppointmentType();
  const updateStatus = useUpdateAppointmentStatus();
  const [form, setForm] = useState({ name: '', duration_minutes: 30 });

  const submit = (e) => {
    e.preventDefault();
    createType.mutate(
      { name: form.name, duration_minutes: Number(form.duration_minutes) || 30 },
      { onSuccess: () => setForm({ name: '', duration_minutes: 30 }) }
    );
  };

  const bookingUrl = (id) => `${window.location.origin}/book/${id}`;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Calendar</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appointment types</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="flex flex-wrap gap-2" onSubmit={submit}>
            <Input
              placeholder="Name (e.g. 30-min Discovery Call) *"
              required
              className="max-w-xs"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Input
              type="number"
              placeholder="Minutes"
              className="max-w-[120px]"
              value={form.duration_minutes}
              onChange={(e) => setForm((f) => ({ ...f, duration_minutes: e.target.value }))}
            />
            <Button type="submit" disabled={createType.isPending}>
              <Plus className="h-4 w-4" />
              Add type
            </Button>
          </form>

          {types.length === 0 ? (
            <p className="text-sm text-muted-foreground">No appointment types yet.</p>
          ) : (
            <div className="space-y-2">
              {types.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.duration_minutes} min</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigator.clipboard?.writeText(bookingUrl(t.id))}
                      title={bookingUrl(t.id)}
                    >
                      <Copy className="h-4 w-4" />
                      Copy booking link
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteType.mutate(t.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="h-4 w-4" /> Upcoming appointments
          </CardTitle>
        </CardHeader>
        <CardContent>
          {appointments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No appointments booked yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Update</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {appointments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{dayjs(a.starts_at).format('MMM D, YYYY h:mm A')}</TableCell>
                    <TableCell>
                      <Badge variant={a.status === 'cancelled' ? 'destructive' : 'secondary'}>{a.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <select
                        className={selectClass}
                        value={a.status}
                        onChange={(e) => updateStatus.mutate({ id: a.id, status: e.target.value })}
                      >
                        <option value="scheduled">scheduled</option>
                        <option value="completed">completed</option>
                        <option value="cancelled">cancelled</option>
                        <option value="no_show">no_show</option>
                      </select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
