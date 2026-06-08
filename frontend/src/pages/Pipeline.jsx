import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { KanbanSquare, Plus, Settings2, Trash2, GripVertical, ArrowUp, ArrowDown, X } from 'lucide-react';
import { usePipelines, useCreatePipeline, useUpdatePipeline, useDeletePipeline } from '@/hooks/usePipelines';
import { useDeals, useCreateDeal, useUpdateDeal, useDeleteDeal } from '@/hooks/useDeals';
import { useContacts } from '@/hooks/useContacts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog } from '@/components/ui/dialog';
import { PageSpinner } from '@/components/ui/spinner';
import EmptyState from '@/components/EmptyState';
import { confirm } from '@/store/confirm.store';
import { cn } from '@/lib/utils';

const DEFAULT_STAGES = [
  { id: 'new', name: 'New Lead', order: 1 },
  { id: 'contacted', name: 'Contacted', order: 2 },
  { id: 'proposal', name: 'Proposal', order: 3 },
  { id: 'won', name: 'Won', order: 4 },
];

const selectClass = 'flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm';
const newStageId = () => `s_${Math.random().toString(36).slice(2, 8)}`;

export default function Pipeline() {
  const { data: pipelines = [], isLoading } = usePipelines();
  const createPipeline = useCreatePipeline();
  const [selectedId, setSelectedId] = useState(null);

  if (isLoading) return <PageSpinner label="Loading pipeline…" />;

  if (pipelines.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Pipeline</h1>
        <EmptyState
          icon={KanbanSquare}
          title="Create a pipeline to organize deals"
          description="A pipeline groups your deals into stages like New Lead → Proposal → Won so nothing falls through the cracks."
          action={
            <Button
              disabled={createPipeline.isPending}
              onClick={() => createPipeline.mutate({ name: 'Sales Pipeline', stages: DEFAULT_STAGES })}
            >
              {createPipeline.isPending ? 'Creating…' : 'Create Sales Pipeline'}
            </Button>
          }
        />
      </div>
    );
  }

  const pipeline = pipelines.find((p) => p.id === selectedId) || pipelines[0];
  return <Board key={pipeline.id} pipeline={pipeline} pipelines={pipelines} onSelect={setSelectedId} />;
}

function Board({ pipeline, pipelines, onSelect }) {
  const qc = useQueryClient();
  const { data: deals = [] } = useDeals({ pipelineId: pipeline.id });
  const { data: contacts = [] } = useContacts();
  const updateDeal = useUpdateDeal();
  const createPipeline = useCreatePipeline();
  const deletePipeline = useDeletePipeline();
  const stages = [...(pipeline.stages || [])].sort((a, b) => a.order - b.order);
  const [dragId, setDragId] = useState(null);
  const [overStage, setOverStage] = useState(null);
  const [editingDeal, setEditingDeal] = useState(null);
  const [managingStages, setManagingStages] = useState(false);

  const dealsKey = ['deals', { pipelineId: pipeline.id }];

  const moveDeal = (stageId, dealId) => {
    setOverStage(null);
    setDragId(null);
    const deal = deals.find((d) => d.id === dealId);
    if (!deal || deal.stage_id === stageId) return;

    // Optimistically move the card so the board feels instant; the hook
    // reconciles on success and rolls back via invalidation on error.
    qc.setQueryData(dealsKey, (prev = []) =>
      prev.map((d) => (d.id === dealId ? { ...d, stage_id: stageId } : d))
    );
    updateDeal.mutate({ ...dealPayload(deal), stage_id: stageId });
  };

  const addPipeline = () => {
    createPipeline.mutate(
      { name: `Pipeline ${pipelines.length + 1}`, stages: DEFAULT_STAGES },
      { onSuccess: (p) => onSelect(p.id) }
    );
  };

  const removePipeline = async () => {
    if (
      await confirm({
        title: `Delete "${pipeline.name}"?`,
        description: `This permanently deletes the pipeline and all ${deals.length} deal(s) in it. This cannot be undone.`,
        confirmLabel: 'Delete pipeline',
      })
    ) {
      deletePipeline.mutate(pipeline.id, { onSuccess: () => onSelect(null) });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <KanbanSquare className="h-5 w-5 text-primary" />
          {pipelines.length > 1 ? (
            <select
              className={selectClass}
              value={pipeline.id}
              onChange={(e) => onSelect(e.target.value)}
            >
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          ) : (
            <h1 className="text-2xl font-semibold">{pipeline.name}</h1>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setManagingStages(true)}>
            <Settings2 className="h-4 w-4" /> Manage stages
          </Button>
          <Button variant="outline" size="sm" onClick={addPipeline} disabled={createPipeline.isPending}>
            <Plus className="h-4 w-4" /> New pipeline
          </Button>
          <Button variant="ghost" size="icon" onClick={removePipeline} title="Delete pipeline">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <NewDealForm pipeline={pipeline} firstStageId={stages[0]?.id} />

      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => {
          const stageDeals = deals.filter((d) => d.stage_id === stage.id);
          const total = stageDeals.reduce((sum, d) => sum + Number(d.value || 0), 0);
          return (
            <div
              key={stage.id}
              className={cn(
                'flex w-72 shrink-0 flex-col rounded-lg border-2 border-transparent bg-muted/50 p-3 transition-colors',
                overStage === stage.id && 'border-primary/50 bg-primary/5'
              )}
              onDragOver={(e) => {
                e.preventDefault();
                if (overStage !== stage.id) setOverStage(stage.id);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) setOverStage(null);
              }}
              onDrop={(e) => moveDeal(stage.id, e.dataTransfer.getData('dealId'))}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="font-medium">{stage.name}</span>
                <span className="text-xs text-muted-foreground">
                  {stageDeals.length} · ${total.toLocaleString()}
                </span>
              </div>
              <div className="space-y-2">
                {stageDeals.map((deal) => (
                  <Card
                    key={deal.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('dealId', deal.id);
                      e.dataTransfer.effectAllowed = 'move';
                      setDragId(deal.id);
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverStage(null);
                    }}
                    onClick={() => setEditingDeal(deal)}
                    className={cn(
                      'cursor-pointer p-3 transition-all hover:shadow-md hover:border-primary/40',
                      dragId === deal.id && 'opacity-50'
                    )}
                  >
                    <p className="text-sm font-medium">{deal.name}</p>
                    <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>${Number(deal.value || 0).toLocaleString()}</span>
                      <span>{deal.probability}%</span>
                    </div>
                  </Card>
                ))}
                {stageDeals.length === 0 && (
                  <div className="rounded-md border border-dashed py-6 text-center text-xs text-muted-foreground">
                    Drop deals here
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {editingDeal && (
        <DealEditDialog
          deal={editingDeal}
          stages={stages}
          contacts={contacts}
          onClose={() => setEditingDeal(null)}
        />
      )}
      {managingStages && (
        <StageManagerDialog pipeline={pipeline} deals={deals} onClose={() => setManagingStages(false)} />
      )}
    </div>
  );
}

// dealPayload extracts the full set of editable fields the update endpoint
// expects (it replaces the record, so every field must be sent).
function dealPayload(deal) {
  return {
    id: deal.id,
    pipeline_id: deal.pipeline_id,
    contact_id: deal.contact_id,
    assigned_to: deal.assigned_to,
    name: deal.name,
    value: deal.value,
    stage_id: deal.stage_id,
    probability: deal.probability,
    close_date: deal.close_date,
    notes: deal.notes,
  };
}

function NewDealForm({ pipeline, firstStageId }) {
  const { data: contacts = [] } = useContacts();
  const createDeal = useCreateDeal();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', value: '', contact_id: '' });

  const submit = (e) => {
    e.preventDefault();
    if (!form.contact_id || !firstStageId) return;
    createDeal.mutate(
      {
        pipeline_id: pipeline.id,
        contact_id: form.contact_id,
        name: form.name,
        value: Number(form.value) || 0,
        stage_id: firstStageId,
        probability: 50,
      },
      { onSuccess: () => { setForm({ name: '', value: '', contact_id: '' }); setOpen(false); } }
    );
  };

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)} disabled={contacts.length === 0}>
        {contacts.length === 0 ? 'Add a contact first' : 'New deal'}
      </Button>
    );
  }

  return (
    <Card className="p-4">
      <form className="grid grid-cols-1 gap-3 md:grid-cols-4" onSubmit={submit}>
        <Input
          placeholder="Deal name *"
          required
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <Input
          placeholder="Value"
          type="number"
          value={form.value}
          onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
        />
        <select
          required
          value={form.contact_id}
          onChange={(e) => setForm((f) => ({ ...f, contact_id: e.target.value }))}
          className={selectClass}
        >
          <option value="">Select contact…</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <Button type="submit" disabled={createDeal.isPending}>
            {createDeal.isPending ? 'Saving…' : 'Add'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

function DealEditDialog({ deal, stages, contacts, onClose }) {
  const updateDeal = useUpdateDeal();
  const deleteDeal = useDeleteDeal();
  const [form, setForm] = useState({
    name: deal.name || '',
    value: deal.value ?? 0,
    contact_id: deal.contact_id || '',
    stage_id: deal.stage_id || stages[0]?.id || '',
    probability: deal.probability ?? 50,
    close_date: deal.close_date ? deal.close_date.slice(0, 10) : '',
    notes: deal.notes || '',
  });
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const save = (e) => {
    e.preventDefault();
    updateDeal.mutate(
      {
        id: deal.id,
        pipeline_id: deal.pipeline_id,
        contact_id: form.contact_id,
        assigned_to: deal.assigned_to,
        name: form.name.trim() || 'Untitled deal',
        value: Number(form.value) || 0,
        stage_id: form.stage_id,
        probability: Number(form.probability) || 0,
        close_date: form.close_date ? new Date(`${form.close_date}T00:00:00Z`).toISOString() : null,
        notes: form.notes || null,
      },
      { onSuccess: onClose }
    );
  };

  const remove = async () => {
    if (
      await confirm({
        title: `Delete "${deal.name}"?`,
        description: 'This permanently deletes the deal. This cannot be undone.',
        confirmLabel: 'Delete deal',
      })
    ) {
      deleteDeal.mutate(deal.id, { onSuccess: onClose });
    }
  };

  return (
    <Dialog open onClose={onClose} title="Edit deal" className="max-w-lg">
      <form className="space-y-3" onSubmit={save}>
        <div className="space-y-1">
          <Label>Name</Label>
          <Input value={form.name} onChange={(e) => set({ name: e.target.value })} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Value</Label>
            <Input type="number" value={form.value} onChange={(e) => set({ value: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Probability (%)</Label>
            <Input type="number" min="0" max="100" value={form.probability} onChange={(e) => set({ probability: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Stage</Label>
            <select className={cn(selectClass, 'w-full')} value={form.stage_id} onChange={(e) => set({ stage_id: e.target.value })}>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Close date</Label>
            <Input type="date" value={form.close_date} onChange={(e) => set({ close_date: e.target.value })} />
          </div>
        </div>
        <div className="space-y-1">
          <Label>Contact</Label>
          <select className={cn(selectClass, 'w-full')} value={form.contact_id} onChange={(e) => set({ contact_id: e.target.value })} required>
            <option value="">Select contact…</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label>Notes</Label>
          <textarea
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={form.notes}
            onChange={(e) => set({ notes: e.target.value })}
          />
        </div>
        <div className="flex items-center justify-between border-t pt-3">
          <Button type="button" variant="ghost" className="text-destructive" onClick={remove}>
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={updateDeal.isPending}>
              {updateDeal.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}

function StageManagerDialog({ pipeline, deals, onClose }) {
  const updatePipeline = useUpdatePipeline();
  const [name, setName] = useState(pipeline.name);
  const [stages, setStages] = useState(
    [...(pipeline.stages || [])].sort((a, b) => a.order - b.order)
  );

  const dealCount = (stageId) => deals.filter((d) => d.stage_id === stageId).length;

  const renameStage = (i, value) => setStages((arr) => arr.map((s, idx) => (idx === i ? { ...s, name: value } : s)));
  const move = (i, dir) =>
    setStages((arr) => {
      const j = i + dir;
      if (j < 0 || j >= arr.length) return arr;
      const next = [...arr];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const addStage = () => setStages((arr) => [...arr, { id: newStageId(), name: 'New stage', order: arr.length + 1 }]);
  const removeStage = (i) => setStages((arr) => arr.filter((_, idx) => idx !== i));

  const save = () => {
    const cleaned = stages
      .filter((s) => s.name.trim())
      .map((s, idx) => ({ id: s.id, name: s.name.trim(), order: idx + 1 }));
    if (cleaned.length === 0) return;
    updatePipeline.mutate({ id: pipeline.id, name: name.trim() || pipeline.name, stages: cleaned }, { onSuccess: onClose });
  };

  return (
    <Dialog open onClose={onClose} title="Manage stages" className="max-w-lg">
      <div className="space-y-4">
        <div className="space-y-1">
          <Label>Pipeline name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>Stages</Label>
          {stages.map((stage, i) => {
            const count = dealCount(stage.id);
            return (
              <div key={stage.id} className="flex items-center gap-2 rounded-md border p-2">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <Input
                  className="flex-1"
                  value={stage.name}
                  onChange={(e) => renameStage(i, e.target.value)}
                />
                <div className="flex items-center">
                  <Button type="button" variant="ghost" size="icon" onClick={() => move(i, -1)} disabled={i === 0}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" onClick={() => move(i, 1)} disabled={i === stages.length - 1}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeStage(i)}
                    disabled={count > 0 || stages.length <= 1}
                    title={count > 0 ? `Move the ${count} deal(s) out of this stage first` : 'Remove stage'}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
          <Button type="button" variant="outline" size="sm" onClick={addStage}>
            <Plus className="h-4 w-4" /> Add stage
          </Button>
        </div>

        <div className="flex justify-end gap-2 border-t pt-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={save} disabled={updatePipeline.isPending}>
            {updatePipeline.isPending ? 'Saving…' : 'Save stages'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
