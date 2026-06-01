import { useState } from 'react';
import { usePipelines, useCreatePipeline } from '@/hooks/usePipelines';
import { useDeals, useCreateDeal, useUpdateDeal } from '@/hooks/useDeals';
import { useContacts } from '@/hooks/useContacts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const DEFAULT_STAGES = [
  { id: 'new', name: 'New Lead', order: 1 },
  { id: 'contacted', name: 'Contacted', order: 2 },
  { id: 'proposal', name: 'Proposal', order: 3 },
  { id: 'won', name: 'Won', order: 4 },
];

export default function Pipeline() {
  const { data: pipelines = [], isLoading } = usePipelines();
  const createPipeline = useCreatePipeline();

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  if (pipelines.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <h1 className="text-2xl font-semibold">Pipeline</h1>
        <p className="text-sm text-muted-foreground">No pipeline yet. Create a default sales pipeline to start.</p>
        <Button
          disabled={createPipeline.isPending}
          onClick={() => createPipeline.mutate({ name: 'Sales Pipeline', stages: DEFAULT_STAGES })}
        >
          {createPipeline.isPending ? 'Creating…' : 'Create Sales Pipeline'}
        </Button>
      </div>
    );
  }

  return <Board pipeline={pipelines[0]} />;
}

function Board({ pipeline }) {
  const { data: deals = [] } = useDeals({ pipelineId: pipeline.id });
  const updateDeal = useUpdateDeal();
  const stages = [...(pipeline.stages || [])].sort((a, b) => a.order - b.order);

  const onDrop = (stageId, dealId) => {
    const deal = deals.find((d) => d.id === dealId);
    if (!deal || deal.stage_id === stageId) return;
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
              className="flex w-72 shrink-0 flex-col rounded-lg bg-muted/50 p-3"
              onDragOver={(e) => e.preventDefault()}
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
                    onDragStart={(e) => e.dataTransfer.setData('dealId', deal.id)}
                    className="cursor-grab p-3 active:cursor-grabbing"
                  >
                    <p className="text-sm font-medium">{deal.name}</p>
                    <p className="text-xs text-muted-foreground">${Number(deal.value || 0).toLocaleString()}</p>
                  </Card>
                ))}
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
