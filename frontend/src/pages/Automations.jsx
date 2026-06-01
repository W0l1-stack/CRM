import { useState } from 'react';
import { Plus, Trash2, Zap } from 'lucide-react';
import {
  useAutomations,
  useCreateAutomation,
  useUpdateAutomation,
  useDeleteAutomation,
} from '@/hooks/useAutomations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const TRIGGERS = [
  { value: 'contact_created', label: 'Contact created' },
  { value: 'deal_moved', label: 'Deal moved' },
  { value: 'form_submitted', label: 'Form submitted' },
  { value: 'appointment_booked', label: 'Appointment booked' },
];

const ACTION_TYPES = [
  { value: 'send_email', label: 'Send email' },
  { value: 'send_sms', label: 'Send SMS' },
  { value: 'add_tag', label: 'Add tag' },
  { value: 'wait', label: 'Wait' },
];

const selectClass =
  'flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm';

export default function Automations() {
  const { data: automations = [], isLoading } = useAutomations();
  const updateAutomation = useUpdateAutomation();
  const deleteAutomation = useDeleteAutomation();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Automations</h1>
        <Button onClick={() => setShowCreate((v) => !v)}>
          <Plus className="h-4 w-4" />
          New automation
        </Button>
      </div>

      {showCreate && <CreateAutomationForm onDone={() => setShowCreate(false)} />}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : automations.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No automations yet. Create one to run actions when something happens.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {automations.map((a) => (
            <Card key={a.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base">{a.name}</CardTitle>
                  <Badge variant={a.is_active ? 'default' : 'secondary'}>
                    {a.is_active ? 'Active' : 'Paused'}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateAutomation.mutate({ ...a, is_active: !a.is_active })}
                  >
                    {a.is_active ? 'Pause' : 'Activate'}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteAutomation.mutate(a.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                When <span className="font-medium text-foreground">{a.trigger_type}</span> →{' '}
                {(a.actions || []).map((act, i) => (
                  <Badge key={i} variant="outline" className="ml-1">
                    {act.type}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateAutomationForm({ onDone }) {
  const createAutomation = useCreateAutomation();
  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState('contact_created');
  const [actions, setActions] = useState([{ type: 'send_email', config: {} }]);

  const setAction = (idx, patch) =>
    setActions((arr) => arr.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  const setConfig = (idx, patch) =>
    setActions((arr) => arr.map((a, i) => (i === idx ? { ...a, config: { ...a.config, ...patch } } : a)));

  const submit = (e) => {
    e.preventDefault();
    createAutomation.mutate(
      { name, trigger_type: trigger, is_active: true, trigger_config: {}, actions },
      { onSuccess: onDone }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">New automation</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={submit}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Input placeholder="Automation name *" required value={name} onChange={(e) => setName(e.target.value)} />
            <select className={selectClass} value={trigger} onChange={(e) => setTrigger(e.target.value)}>
              {TRIGGERS.map((t) => (
                <option key={t.value} value={t.value}>
                  When: {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Actions</p>
            {actions.map((action, idx) => (
              <div key={idx} className="flex flex-wrap items-center gap-2 rounded-md border p-2">
                <select
                  className={selectClass}
                  value={action.type}
                  onChange={(e) => setAction(idx, { type: e.target.value, config: {} })}
                >
                  {ACTION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>

                {action.type === 'send_email' && (
                  <>
                    <Input
                      placeholder="Subject"
                      className="max-w-[200px]"
                      value={action.config.subject || ''}
                      onChange={(e) => setConfig(idx, { subject: e.target.value })}
                    />
                    <Input
                      placeholder="Body (supports {{contact.name}})"
                      className="flex-1"
                      value={action.config.body || ''}
                      onChange={(e) => setConfig(idx, { body: e.target.value })}
                    />
                  </>
                )}
                {action.type === 'send_sms' && (
                  <Input
                    placeholder="Message (supports {{contact.name}})"
                    className="flex-1"
                    value={action.config.body || ''}
                    onChange={(e) => setConfig(idx, { body: e.target.value })}
                  />
                )}
                {action.type === 'add_tag' && (
                  <Input
                    placeholder="Tag"
                    className="max-w-[200px]"
                    value={action.config.tag || ''}
                    onChange={(e) => setConfig(idx, { tag: e.target.value })}
                  />
                )}
                {action.type === 'wait' && (
                  <Input
                    placeholder="Days"
                    type="number"
                    className="max-w-[120px]"
                    value={action.config.days || ''}
                    onChange={(e) => setConfig(idx, { days: Number(e.target.value) })}
                  />
                )}

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setActions((arr) => arr.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setActions((arr) => [...arr, { type: 'send_email', config: {} }])}
            >
              <Plus className="h-4 w-4" />
              Add action
            </Button>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={createAutomation.isPending}>
              {createAutomation.isPending ? 'Saving…' : 'Save automation'}
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
