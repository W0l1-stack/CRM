import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Zap, Mail, MessageSquare, Tag, Clock, Plus, Trash2, GripVertical, ArrowDown,
} from 'lucide-react';
import {
  useAutomation, useCreateAutomation, useUpdateAutomation,
} from '@/hooks/useAutomations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { PageSpinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

const TRIGGERS = [
  { value: 'contact_created', label: 'Contact created' },
  { value: 'deal_moved', label: 'Deal moved' },
  { value: 'form_submitted', label: 'Form submitted' },
  { value: 'appointment_booked', label: 'Appointment booked' },
];

// Action palette — dragged or clicked onto the canvas.
const ACTION_TYPES = [
  { value: 'send_email', label: 'Send email', icon: Mail, color: 'bg-blue-100 text-blue-700' },
  { value: 'send_sms', label: 'Send SMS', icon: MessageSquare, color: 'bg-emerald-100 text-emerald-700' },
  { value: 'add_tag', label: 'Add tag', icon: Tag, color: 'bg-violet-100 text-violet-700' },
  { value: 'wait', label: 'Wait', icon: Clock, color: 'bg-amber-100 text-amber-700' },
];
const actionMeta = (type) => ACTION_TYPES.find((a) => a.value === type) || ACTION_TYPES[0];

export default function AutomationBuilder() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const { data: existing, isLoading } = useAutomation(isNew ? null : id);
  const createAutomation = useCreateAutomation();
  const updateAutomation = useUpdateAutomation();

  const [name, setName] = useState('');
  const [triggers, setTriggers] = useState(['contact_created']);
  const [isActive, setIsActive] = useState(true);
  const [actions, setActions] = useState([]);
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);

  useEffect(() => {
    if (existing) {
      setName(existing.name || '');
      // trigger_types is the source of truth; fall back to the legacy single
      // trigger_type for automations created before multi-trigger.
      const loaded = existing.trigger_types?.length
        ? existing.trigger_types
        : existing.trigger_type
          ? [existing.trigger_type]
          : [];
      setTriggers(loaded);
      setIsActive(Boolean(existing.is_active));
      setActions(Array.isArray(existing.actions) ? existing.actions : []);
    }
  }, [existing]);

  const toggleTrigger = (value) =>
    setTriggers((arr) => (arr.includes(value) ? arr.filter((t) => t !== value) : [...arr, value]));

  if (!isNew && isLoading) return <PageSpinner label="Loading automation…" />;

  const addAction = (type) => setActions((arr) => [...arr, { type, config: {} }]);
  const removeAction = (idx) => setActions((arr) => arr.filter((_, i) => i !== idx));
  const setConfig = (idx, patch) =>
    setActions((arr) => arr.map((a, i) => (i === idx ? { ...a, config: { ...a.config, ...patch } } : a)));
  const setType = (idx, type) =>
    setActions((arr) => arr.map((a, i) => (i === idx ? { type, config: {} } : a)));

  // HTML5 drag-to-reorder between action cards.
  const onDrop = (target) => {
    setOverIdx(null);
    if (dragIdx === null || dragIdx === target) return setDragIdx(null);
    setActions((arr) => {
      const next = [...arr];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(target, 0, moved);
      return next;
    });
    setDragIdx(null);
  };

  const save = () => {
    const body = { name: name.trim() || 'Untitled automation', trigger_types: triggers, is_active: isActive, trigger_config: {}, actions };
    if (isNew) {
      createAutomation.mutate(body, { onSuccess: () => navigate('/automations') });
    } else {
      updateAutomation.mutate({ id, ...body }, { onSuccess: () => navigate('/automations') });
    }
  };

  const saving = createAutomation.isPending || updateAutomation.isPending;
  const canSave = triggers.length > 0 && !saving;

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link to="/automations">
          <ArrowLeft className="h-4 w-4" /> Back to automations
        </Link>
      </Button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Automation name"
          className="max-w-sm text-lg font-semibold"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-primary" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Active
          </label>
          <Button onClick={save} disabled={!canSave}>
            {saving ? 'Saving…' : 'Save automation'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_220px]">
        {/* Canvas */}
        <div className="flex flex-col items-center">
          {/* Trigger block */}
          <Card className="w-full max-w-md border-primary/40 p-4">
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Zap className="h-4 w-4" />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {triggers.length > 1 ? 'When any of these happen' : 'When this happens'}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {TRIGGERS.map((t) => {
                const active = triggers.includes(t.value);
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => toggleTrigger(t.value)}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                      active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-input bg-background text-muted-foreground hover:bg-secondary'
                    )}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
            {triggers.length === 0 && (
              <p className="mt-2 text-xs text-destructive">Pick at least one trigger.</p>
            )}
          </Card>

          {actions.length === 0 && (
            <>
              <Connector />
              <div className="w-full max-w-md rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Add an action from the right, or click below.
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {ACTION_TYPES.map((a) => (
                    <Button key={a.value} variant="outline" size="sm" onClick={() => addAction(a.value)}>
                      <a.icon className="h-4 w-4" /> {a.label}
                    </Button>
                  ))}
                </div>
              </div>
            </>
          )}

          {actions.map((action, idx) => {
            const meta = actionMeta(action.type);
            const Icon = meta.icon;
            return (
              <div key={idx} className="flex w-full max-w-md flex-col items-center">
                <Connector />
                <Card
                  draggable
                  onDragStart={() => setDragIdx(idx)}
                  onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                  onDragOver={(e) => { e.preventDefault(); if (overIdx !== idx) setOverIdx(idx); }}
                  onDrop={() => onDrop(idx)}
                  className={cn(
                    'w-full p-4 transition-all',
                    dragIdx === idx && 'opacity-50',
                    overIdx === idx && dragIdx !== null && 'ring-2 ring-primary'
                  )}
                >
                  <div className="mb-3 flex items-center gap-2">
                    <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground" />
                    <div className={cn('flex h-7 w-7 items-center justify-center rounded-full', meta.color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <select
                      className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm font-medium"
                      value={action.type}
                      onChange={(e) => setType(idx, e.target.value)}
                    >
                      {ACTION_TYPES.map((a) => (
                        <option key={a.value} value={a.value}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                    <Button variant="ghost" size="icon" onClick={() => removeAction(idx)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <ActionConfig action={action} onChange={(patch) => setConfig(idx, patch)} />
                </Card>
              </div>
            );
          })}

          {actions.length > 0 && (
            <>
              <Connector />
              <Button variant="outline" size="sm" onClick={() => addAction('send_email')}>
                <Plus className="h-4 w-4" /> Add step
              </Button>
            </>
          )}
        </div>

        {/* Palette */}
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Steps</p>
          {ACTION_TYPES.map((a) => (
            <button
              key={a.value}
              onClick={() => addAction(a.value)}
              className="flex w-full items-center gap-2 rounded-md border bg-card p-3 text-left text-sm font-medium transition-colors hover:bg-secondary"
            >
              <div className={cn('flex h-7 w-7 items-center justify-center rounded-full', a.color)}>
                <a.icon className="h-4 w-4" />
              </div>
              {a.label}
            </button>
          ))}
          <p className="pt-2 text-xs text-muted-foreground">Click to append, or drag cards on the canvas to reorder.</p>
        </div>
      </div>
    </div>
  );
}

function Connector() {
  return (
    <div className="flex flex-col items-center py-1 text-muted-foreground">
      <div className="h-4 w-px bg-border" />
      <ArrowDown className="h-3 w-3" />
    </div>
  );
}

function ActionConfig({ action, onChange }) {
  switch (action.type) {
    case 'send_email':
      return (
        <div className="space-y-2">
          <Input placeholder="Subject" value={action.config.subject || ''} onChange={(e) => onChange({ subject: e.target.value })} />
          <Input placeholder="Body (supports {{contact.name}})" value={action.config.body || ''} onChange={(e) => onChange({ body: e.target.value })} />
        </div>
      );
    case 'send_sms':
      return (
        <Input placeholder="Message (supports {{contact.name}})" value={action.config.body || ''} onChange={(e) => onChange({ body: e.target.value })} />
      );
    case 'add_tag':
      return <Input placeholder="Tag" value={action.config.tag || ''} onChange={(e) => onChange({ tag: e.target.value })} />;
    case 'wait':
      return (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min="0"
            className="max-w-[120px]"
            placeholder="Days"
            value={action.config.days ?? ''}
            onChange={(e) => onChange({ days: Number(e.target.value) })}
          />
          <span className="text-sm text-muted-foreground">days before the next step</span>
        </div>
      );
    default:
      return null;
  }
}
