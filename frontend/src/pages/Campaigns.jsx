import { useState } from 'react';
import { Plus, Trash2, Send, Mail } from 'lucide-react';
import {
  useCampaigns,
  useCreateCampaign,
  useSendCampaign,
  useScheduleCampaign,
  useDeleteCampaign,
} from '@/hooks/useCampaigns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const statusVariant = { sent: 'default', sending: 'secondary', draft: 'outline', scheduled: 'secondary' };

export default function Campaigns() {
  const { data: campaigns = [], isLoading } = useCampaigns();
  const deleteCampaign = useDeleteCampaign();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Email Campaigns</h1>
        <Button onClick={() => setShowCreate((v) => !v)}>
          <Plus className="h-4 w-4" />
          New campaign
        </Button>
      </div>

      {showCreate && <CreateCampaignForm onDone={() => setShowCreate(false)} />}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : campaigns.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No campaigns yet. Create one to email a filtered list of contacts (unsubscribe link is added
            automatically).
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <Card key={c.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base">{c.name}</CardTitle>
                  <Badge variant={statusVariant[c.status] || 'outline'}>{c.status}</Badge>
                  {c.stats?.sent ? (
                    <span className="text-xs text-muted-foreground">{c.stats.sent} sent</span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <CampaignActions campaign={c} />
                  <Button variant="ghost" size="icon" onClick={() => deleteCampaign.mutate(c.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Subject: <span className="text-foreground">{c.subject}</span>
                {c.recipient_filter?.tag ? ` · audience: tag "${c.recipient_filter.tag}"` : ' · audience: all subscribed contacts'}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CampaignActions({ campaign }) {
  const sendCampaign = useSendCampaign();
  const scheduleCampaign = useScheduleCampaign();
  const [when, setWhen] = useState('');
  const locked = campaign.status === 'sending' || campaign.status === 'sent';

  if (locked) {
    return <span className="text-xs text-muted-foreground capitalize">{campaign.status}</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="datetime-local"
        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        value={when}
        onChange={(e) => setWhen(e.target.value)}
      />
      <Button
        variant="outline"
        size="sm"
        disabled={!when || scheduleCampaign.isPending}
        onClick={() => scheduleCampaign.mutate({ id: campaign.id, scheduled_at: new Date(when).toISOString() })}
      >
        Schedule
      </Button>
      <Button
        size="sm"
        disabled={sendCampaign.isPending}
        onClick={() => { if (window.confirm(`Send "${campaign.name}" now?`)) sendCampaign.mutate(campaign.id); }}
      >
        <Send className="h-4 w-4" /> Send
      </Button>
    </div>
  );
}

function CreateCampaignForm({ onDone }) {
  const createCampaign = useCreateCampaign();
  const [form, setForm] = useState({ name: '', subject: '', body_html: '<p>Hi {{contact.name}},</p>\n<p></p>', tag: '' });

  const submit = (e) => {
    e.preventDefault();
    createCampaign.mutate(
      {
        name: form.name,
        subject: form.subject,
        body_html: form.body_html,
        recipient_filter: form.tag ? { tag: form.tag } : {},
      },
      { onSuccess: onDone }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">New campaign</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={submit}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Input placeholder="Campaign name *" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <Input placeholder="Audience tag (blank = all)" value={form.tag} onChange={(e) => setForm((f) => ({ ...f, tag: e.target.value }))} />
          </div>
          <Input placeholder="Subject *" required value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} />
          <div className="space-y-1">
            <p className="text-sm font-medium">Body (HTML, supports {'{{contact.name}}'})</p>
            <textarea
              className="flex min-h-[160px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
              value={form.body_html}
              onChange={(e) => setForm((f) => ({ ...f, body_html: e.target.value }))}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={createCampaign.isPending}>
              {createCampaign.isPending ? 'Saving…' : 'Save draft'}
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
