import { useParams, Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { ArrowLeft, Mail, MailOpen, MousePointerClick, UserMinus, Send } from 'lucide-react';
import { useCampaign, useCampaignRecipients } from '@/hooks/useCampaigns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageSpinner } from '@/components/ui/spinner';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import EmptyState from '@/components/EmptyState';

const statusVariant = { clicked: 'default', opened: 'secondary', sent: 'outline', delivered: 'outline', bounced: 'destructive', unsubscribed: 'destructive' };

function pct(part, whole) {
  if (!whole) return '0%';
  return `${Math.round((part / whole) * 100)}%`;
}

export default function CampaignDetail() {
  const { id } = useParams();
  const { data: campaign, isLoading } = useCampaign(id);
  const { data: recipients = [], isLoading: recipientsLoading } = useCampaignRecipients(id);

  if (isLoading) return <PageSpinner label="Loading campaign…" />;
  if (!campaign) return <p className="text-sm text-destructive">Campaign not found.</p>;

  const stats = campaign.stats || {};
  const sent = Number(stats.sent || 0);
  const opens = Number(stats.opens || 0);
  const clicks = Number(stats.clicks || 0);
  const unsubs = Number(stats.unsubscribes || 0);

  const cards = [
    { label: 'Sent', value: sent, icon: Send, sub: null },
    { label: 'Opens', value: opens, icon: MailOpen, sub: pct(opens, sent) },
    { label: 'Clicks', value: clicks, icon: MousePointerClick, sub: pct(clicks, sent) },
    { label: 'Unsubscribes', value: unsubs, icon: UserMinus, sub: pct(unsubs, sent) },
  ];

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link to="/campaigns">
          <ArrowLeft className="h-4 w-4" />
          Back to campaigns
        </Link>
      </Button>

      <div className="flex flex-wrap items-center gap-2">
        <Mail className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-semibold">{campaign.name}</h1>
        <Badge variant="secondary" className="capitalize">{campaign.status}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        Subject: <span className="text-foreground">{campaign.subject}</span>
        {campaign.sent_at && ` · sent ${dayjs(campaign.sent_at).format('MMM D, YYYY h:mm A')}`}
      </p>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, sub }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{value}</div>
              {sub && <p className="text-xs text-muted-foreground">{sub} of sent</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recipients</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recipientsLoading ? (
            <TableSkeleton rows={5} cols={4} />
          ) : recipients.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Mail}
                title="No recipients yet"
                description={
                  campaign.status === 'draft'
                    ? 'Send this campaign to start tracking opens and clicks per contact.'
                    : 'Recipients appear here once the campaign has been sent.'
                }
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Opened</TableHead>
                  <TableHead>Clicked</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recipients.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      <Link to={`/contacts/${r.contact_id}`} className="hover:underline">
                        {r.contact_name || '—'}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.email}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[r.status] || 'outline'} className="capitalize">
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.opened_at ? dayjs(r.opened_at).format('MMM D, h:mm A') : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.clicked_at ? dayjs(r.clicked_at).format('MMM D, h:mm A') : '—'}
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
