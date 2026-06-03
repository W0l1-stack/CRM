import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { KanbanSquare } from 'lucide-react';
import { usePipelines, useCreatePipeline } from '@/hooks/usePipelines';
import { useDeals, useCreateDeal, useUpdateDeal } from '@/hooks/useDeals';
import { useContacts } from '@/hooks/useContacts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageSpinner } from '@/components/ui/spinner';
import EmptyState from '@/components/EmptyState';
import { cn } from '@/lib/utils';

const DEFAULT_STAGES = [
  { id: 'new', name: 'New Lead', order: 1 },
  { id: 'contacted', name: 'Contacted', order: 2 },
  { id: 'proposal', name: 'Proposal', order: 3 },
  { id: 'won', name: 'Won', order: 4 },
];

export default function Pipeline() {
  const { data: pipelines = [], isLoading } = usePipelines();
  const createPipeline = useCreatePipeline();

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

  return <Board pipeline={pipelines[0]} />;
}

function Board({ pipeline }) {
  const qc = useQueryClient();
  const { data: deals = [] } = useDeals({ pipelineId: pipeline.id });
  const updateDeal = useUpdateDeal();
  const stages = [...(pipeline.stages || [])].sort((a, b) => a.order - b.order);
  const [dragId, setDragId] = useState(null);
  const [overStage, setOverStage] = useState(null);

  const dealsKey = ['deals', { pipelineId: pipeline.id }];

  const onDrop = (stageId, dealId) => {
    setOverStage(null);
    setDragId(null);
    const deal = deals.find((d) => d.id === dealId);
    if (!deal || deal.stage_id === stageId) return;

    // Optimistically move the card so the board feels instant; React Query
    // reconciles on success and the hook rolls back via invalidation on error.
    qc.setQueryData(dealsKey, (prev = []) =>
      prev.map((d) => (d.id === dealId ? { ...d, stage_id: stageId } : d))
    );

    updateDeal.mutate({
      id: deal.id,
      pipeline_id: deal.pipeline_id,
      contact_id: deal.contact_id,
      assigned_to: deal.assigned_to,
      name: deal.name,
      value: deal.value,
      stage_id: stageId,
      probability: deal.probability,
      close_date: deal.close_date,
      notes: deal.notes,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{pipeline.name}</h1>
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
              onDrop={(e) => onDrop(stage.id, e.dataTransfer.getData('dealId'))}
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
                    className={cn(
                      'cursor-grab p-3 transition-all active:cursor-grabbing hover:shadow-md',
                      dragId === deal.id && 'opacity-50'
                    )}
                  >
                    <p className="text-sm font-medium">{deal.name}</p>
                    <p className="text-xs text-muted-foreground">${Number(deal.value || 0).toLocaleString()}</p>
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
    </div>
  );
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
          className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
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
