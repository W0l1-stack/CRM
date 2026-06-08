import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Zap, Mail, MessageSquare, Tag, Clock, GitBranch, Plus, Trash2, GripVertical, ArrowDown,
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

// Leaf actions a step (or branch case) can perform.
const LEAF_TYPES = [
  { value: 'send_email', label: 'Send email', icon: Mail, color: 'bg-blue-100 text-blue-700' },
  { value: 'send_sms', label: 'Send SMS', icon: MessageSquare, color: 'bg-emerald-100 text-emerald-700' },
  { value: 'add_tag', label: 'Add tag', icon: Tag, color: 'bg-violet-100 text-violet-700' },
  { value: 'wait', label: 'Wait', icon: Clock, color: 'bg-amber-100 text-amber-700' },
];
const BRANCH_TYPE = { value: 'branch', label: 'Branch (if / then)', icon: GitBranch, color: 'bg-rose-100 text-rose-700' };
const PALETTE = [...LEAF_TYPES, BRANCH_TYPE];
const actionMeta = (type) => [...LEAF_TYPES, BRANCH_TYPE].find((a) => a.value === type) || LEAF_TYPES[0];

const CONDITION_FIELDS = [
  { value: 'tags', label: 'Tag' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'company', label: 'Company' },
  { value: 'source', label: 'Source' },
  { value: 'name', label: 'Name' },
];
const OPERATORS = [
  { value: 'has_tag', label: 'has tag' },
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'does not equal' },
  { value: 'contains', label: 'contains' },
  { value: 'not_empty', label: 'is set' },
  { value: 'empty', label: 'is empty' },
];
const noValueOp = (op) => op === 'not_empty' || op === 'empty';

const newCase = () => ({ label: '', field: 'tags', op: 'has_tag', value: '', actions: [] });
const newAction = (type) =>
  type === 'branch' ? { type, config: { cases: [newCase()], default: [] } } : { type, config: {} };

const selectClass = 'flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm';

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

  const addAction = (type) => setActions((arr) => [...arr, newAction(type)]);
  const removeAction = (idx) => setActions((arr) => arr.filter((_, i) => i !== idx));
  const patchAction = (idx, next) => setActions((arr) => arr.map((a, i) => (i === idx ? next : a)));

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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_240px]">
        {/* Canvas */}
        <div className="flex flex-col items-center">
          {/* Trigger block */}
          <Card className="w-full max-w-xl border-primary/40 p-4">
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
            {triggers.length === 0 && <p className="mt-2 text-xs text-destructive">Pick at least one trigger.</p>}
          </Card>

          {actions.length === 0 && (
            <>
              <Connector />
              <div className="w-full max-w-xl rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Add a step from the right to begin.
              </div>
            </>
          )}

          {actions.map((action, idx) => (
            <div key={idx} className="flex w-full max-w-xl flex-col items-center">
              <Connector />
              <div
                className="w-full"
                draggable={action.type !== 'branch'}
                onDragStart={() => setDragIdx(idx)}
                onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                onDragOver={(e) => { e.preventDefault(); if (overIdx !== idx) setOverIdx(idx); }}
                onDrop={() => onDrop(idx)}
              >
                {action.type === 'branch' ? (
                  <BranchCard
                    action={action}
                    dragging={dragIdx === idx}
                    over={overIdx === idx && dragIdx !== null}
                    onChange={(next) => patchAction(idx, next)}
                    onRemove={() => removeAction(idx)}
                  />
                ) : (
                  <ActionCard
                    action={action}
                    dragging={dragIdx === idx}
                    over={overIdx === idx && dragIdx !== null}
                    onChange={(next) => patchAction(idx, next)}
                    onRemove={() => removeAction(idx)}
                  />
                )}
              </div>
            </div>
          ))}

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
          {PALETTE.map((a) => (
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
          <p className="pt-2 text-xs text-muted-foreground">
            A branch routes the contact down the first matching path, or the “otherwise” path.
          </p>
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

// A single leaf step card with a type selector and its config.
function ActionCard({ action, dragging, over, onChange, onRemove }) {
  const meta = actionMeta(action.type);
  const Icon = meta.icon;
  return (
    <Card className={cn('w-full p-4 transition-all', dragging && 'opacity-50', over && 'ring-2 ring-primary')}>
      <div className="mb-3 flex items-center gap-2">
        <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground" />
        <div className={cn('flex h-7 w-7 items-center justify-center rounded-full', meta.color)}>
          <Icon className="h-4 w-4" />
        </div>
        <select
          className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm font-medium"
          value={action.type}
          onChange={(e) => onChange(newAction(e.target.value))}
        >
          {LEAF_TYPES.map((a) => (
            <option key={a.value} value={a.value}>{a.label}</option>
          ))}
        </select>
        <Button variant="ghost" size="icon" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <ActionConfig action={action} onChange={(patch) => onChange({ ...action, config: { ...action.config, ...patch } })} />
    </Card>
  );
}

// Branch card: multiple condition cases, each with its own nested actions, plus
// an "otherwise" default path. Stored as config.cases[] and config.default[].
function BranchCard({ action, dragging, over, onChange, onRemove }) {
  const cfg = action.config || {};
  const cases = Array.isArray(cfg.cases) ? cfg.cases : [];
  const def = Array.isArray(cfg.default) ? cfg.default : [];

  const setConfig = (patch) => onChange({ ...action, config: { ...cfg, ...patch } });
  const setCase = (i, patch) => setConfig({ cases: cases.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) });
  const addCase = () => setConfig({ cases: [...cases, newCase()] });
  const removeCase = (i) => setConfig({ cases: cases.filter((_, idx) => idx !== i) });

  return (
    <Card className={cn('w-full border-rose-200 p-4 transition-all', dragging && 'opacity-50', over && 'ring-2 ring-primary')}>
      <div className="mb-3 flex items-center gap-2">
        <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground" />
        <div className={cn('flex h-7 w-7 items-center justify-center rounded-full', BRANCH_TYPE.color)}>
          <GitBranch className="h-4 w-4" />
        </div>
        <span className="flex-1 text-sm font-medium">Branch — route by condition</span>
        <Button variant="ghost" size="icon" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-3">
        {cases.map((c, i) => (
          <div key={i} className="rounded-lg border bg-muted/30 p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
                {i === 0 ? 'If' : 'Else if'}
              </span>
              <Input
                className="h-8 flex-1"
                placeholder="Path label (optional)"
                value={c.label || ''}
                onChange={(e) => setCase(i, { label: e.target.value })}
              />
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeCase(i)} disabled={cases.length <= 1}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <ConditionEditor condition={c} onChange={(patch) => setCase(i, patch)} />
            <div className="mt-3 border-l-2 border-rose-200 pl-3">
              <NestedActions
                actions={c.actions || []}
                onChange={(actions) => setCase(i, { actions })}
              />
            </div>
          </div>
        ))}

        <Button type="button" variant="outline" size="sm" onClick={addCase}>
          <Plus className="h-4 w-4" /> Add condition
        </Button>

        <div className="rounded-lg border bg-muted/30 p-3">
          <span className="mb-2 inline-block rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
            Otherwise
          </span>
          <div className="border-l-2 border-border pl-3">
            <NestedActions actions={def} onChange={(actions) => setConfig({ default: actions })} />
          </div>
        </div>
      </div>
    </Card>
  );
}

function ConditionEditor({ condition, onChange }) {
  const op = condition.op || 'has_tag';
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <select className={selectClass} value={condition.field || 'tags'} onChange={(e) => onChange({ field: e.target.value })}>
        {CONDITION_FIELDS.map((f) => (
          <option key={f.value} value={f.value}>{f.label}</option>
        ))}
      </select>
      <select className={selectClass} value={op} onChange={(e) => onChange({ op: e.target.value })}>
        {OPERATORS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {!noValueOp(op) && (
        <Input
          className="h-9"
          placeholder={op === 'has_tag' ? 'tag name' : 'value'}
          value={condition.value || ''}
          onChange={(e) => onChange({ value: e.target.value })}
        />
      )}
    </div>
  );
}

// Nested leaf-action list used inside branch cases (no nested branches).
function NestedActions({ actions, onChange }) {
  const add = (type) => onChange([...actions, newAction(type)]);
  const remove = (i) => onChange(actions.filter((_, idx) => idx !== i));
  const update = (i, next) => onChange(actions.map((a, idx) => (idx === i ? next : a)));

  return (
    <div className="space-y-2">
      {actions.map((a, i) => {
        const meta = actionMeta(a.type);
        const Icon = meta.icon;
        return (
          <div key={i} className="rounded-md border bg-background p-2">
            <div className="mb-2 flex items-center gap-2">
              <div className={cn('flex h-6 w-6 items-center justify-center rounded-full', meta.color)}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <select
                className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm"
                value={a.type}
                onChange={(e) => update(i, newAction(e.target.value))}
              >
                {LEAF_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(i)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <ActionConfig action={a} onChange={(patch) => update(i, { ...a, config: { ...a.config, ...patch } })} />
          </div>
        );
      })}
      <div className="flex flex-wrap gap-1">
        {LEAF_TYPES.map((t) => (
          <Button key={t.value} type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => add(t.value)}>
            <Plus className="h-3 w-3" /> {t.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function ActionConfig({ action, onChange }) {
  switch (action.type) {
    case 'send_email':
      return (
        <div className="space-y-2">
          <Input placeholder="Subject" value={action.config?.subject || ''} onChange={(e) => onChange({ subject: e.target.value })} />
          <Input placeholder="Body (supports {{contact.name}})" value={action.config?.body || ''} onChange={(e) => onChange({ body: e.target.value })} />
        </div>
      );
    case 'send_sms':
      return (
        <Input placeholder="Message (supports {{contact.name}})" value={action.config?.body || ''} onChange={(e) => onChange({ body: e.target.value })} />
      );
    case 'add_tag':
      return <Input placeholder="Tag" value={action.config?.tag || ''} onChange={(e) => onChange({ tag: e.target.value })} />;
    case 'wait':
      return (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min="0"
            className="max-w-[120px]"
            placeholder="Days"
            value={action.config?.days ?? ''}
            onChange={(e) => onChange({ days: Number(e.target.value) })}
          />
          <span className="text-sm text-muted-foreground">days before the next step</span>
        </div>
      );
    default:
      return null;
  }
}
