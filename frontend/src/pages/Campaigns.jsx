import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Trash2, Send, Mail, MessageSquare, GitBranch, BarChart3, Pencil } from 'lucide-react';
import {
  useCampaigns,
  useSendCampaign,
  useScheduleCampaign,
  useDeleteCampaign,
} from '@/hooks/useCampaigns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { CardsSkeleton } from '@/components/ui/skeleton';
import EmptyState from '@/components/EmptyState';
import { confirm } from '@/store/confirm.store';
import { cn } from '@/lib/utils';

const statusVariant = { sent: 'default', sending: 'secondary', draft: 'outline', scheduled: 'secondary' };

function TypePicker({ onClose }) {
  const navigate = useNavigate();
  const types = [
    { value: 'email', label: 'Email Campaign', icon: Mail, tag: 'Popular', desc: 'Compose a rich email with drag-and-drop blocks and track opens & clicks.', color: 'border-blue-300 bg-blue-50 text-blue-700' },
    { value: 'sms', label: 'SMS Campaign', icon: MessageSquare, tag: 'Fast', desc: 'Send a text message straight to your contacts’ phones.', color: 'border-emerald-300 bg-emerald-50 text-emerald-700' },
    { value: 'journey', label: 'Journey', icon: GitBranch, tag: 'Automated', desc: 'Enroll your audience into a multi-step automation (waits, branches, replies).', color: 'border-cyan-300 bg-cyan-50 text-cyan-700' },
  ];
  return (
    <Dialog open onClose={onClose} title="Create a new campaign" description="Pick the type of campaign you want to send.">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {types.map((t) => (
          <button
            key={t.value}
            onClick={() => navigate(`/campaigns/new?type=${t.value}`)}
            className="group flex flex-col gap-2 rounded-lg border p-4 text-left transition-all hover:border-primary hover:shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className={cn('flex h-10 w-10 items-center justify-center rounded-md border', t.color)}>
                <t.icon className="h-5 w-5" />
              </div>
              <Badge variant="secondary">{t.tag}</Badge>
            </div>
            <p className="font-semibold">{t.label}</p>
            <p className="text-sm text-muted-foreground">{t.desc}</p>
          </button>
        ))}
      </div>
    </Dialog>
  );
}

export default function Campaigns() {
  const { data: campaigns = [], isLoading } = useCampaigns();
  const deleteCampaign = useDeleteCampaign();
  const [picking, setPicking] = useState(false);

  const remove = async (c) => {
    if (
      await confirm({
        title: `Delete "${c.name}"?`,
        description: 'This permanently deletes the campaign and its report. This cannot be undone.',
        confirmLabel: 'Delete campaign',
      })
    ) {
      deleteCampaign.mutate(c.id);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Campaigns</h1>
        <Button onClick={() => setPicking(true)}>
          <Plus className="h-4 w-4" />
          New campaign
        </Button>
      </div>

      {picking && <TypePicker onClose={() => setPicking(false)} />}

      {isLoading ? (
        <CardsSkeleton count={3} />
      ) : campaigns.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="Send your first campaign"
          description="Send an email (drag-and-drop blocks, open/click tracking) or an SMS blast to a tagged audience."
          action={
            <Button onClick={() => setPicking(true)}>
              <Plus className="h-4 w-4" />
              New campaign
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <Card key={c.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-2">
                  {c.channel === 'sms' ? <MessageSquare className="h-4 w-4 text-emerald-600" /> : c.channel === 'journey' ? <GitBranch className="h-4 w-4 text-cyan-600" /> : <Mail className="h-4 w-4 text-primary" />}
                  <Link to={`/campaigns/${c.id}`} className="hover:underline">
                    <CardTitle className="text-base">{c.name}</CardTitle>
                  </Link>
                  <Badge variant="outline" className="uppercase">{c.channel || 'email'}</Badge>
                  <Badge variant={statusVariant[c.status] || 'outline'}>{c.status}</Badge>
                  {c.stats?.sent ? (
                    <span className="text-xs text-muted-foreground">
                      {c.stats.sent} sent · {c.stats.opens || 0} opens · {c.stats.clicks || 0} clicks
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <CampaignActions campaign={c} />
                  {c.status === 'draft' && (
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/campaigns/${c.id}/edit`}>
                        <Pencil className="h-4 w-4" /> Edit
                      </Link>
                    </Button>
                  )}
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/campaigns/${c.id}`}>
                      <BarChart3 className="h-4 w-4" /> Report
                    </Link>
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(c)}>
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
    return <span className="text-xs capitalize text-muted-foreground">{campaign.status}</span>;
  }

  const send = async () => {
    if (await confirm({ title: `Send "${campaign.name}" now?`, description: 'Recipients will receive this email shortly.', confirmLabel: 'Send now', variant: 'default' })) {
      sendCampaign.mutate(campaign.id);
    }
  };

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
      <Button size="sm" disabled={sendCampaign.isPending} onClick={send}>
        <Send className="h-4 w-4" /> Send
      </Button>
    </div>
  );
}
