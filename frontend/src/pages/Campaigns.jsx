import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, Send, Mail, BarChart3, Pencil } from 'lucide-react';
import {
  useCampaigns,
  useSendCampaign,
  useScheduleCampaign,
  useDeleteCampaign,
} from '@/hooks/useCampaigns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CardsSkeleton } from '@/components/ui/skeleton';
import EmptyState from '@/components/EmptyState';
import { confirm } from '@/store/confirm.store';

const statusVariant = { sent: 'default', sending: 'secondary', draft: 'outline', scheduled: 'secondary' };

export default function Campaigns() {
  const { data: campaigns = [], isLoading } = useCampaigns();
  const deleteCampaign = useDeleteCampaign();

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
        <h1 className="text-2xl font-semibold">Email Campaigns</h1>
        <Button asChild>
          <Link to="/campaigns/new">
            <Plus className="h-4 w-4" />
            New campaign
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <CardsSkeleton count={3} />
      ) : campaigns.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="Send your first campaign"
          description="Compose an email with drag-and-drop blocks, pick a smart-list audience, and track opens and clicks. An unsubscribe link is added automatically."
          action={
            <Button asChild>
              <Link to="/campaigns/new">
                <Plus className="h-4 w-4" />
                New campaign
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <Card key={c.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  <Link to={`/campaigns/${c.id}`} className="hover:underline">
                    <CardTitle className="text-base">{c.name}</CardTitle>
                  </Link>
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
