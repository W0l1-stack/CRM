import { Link } from 'react-router-dom';
import { Users, KanbanSquare, DollarSign, Mail, Plus, Upload, Send, ArrowRight } from 'lucide-react';
import dayjs from 'dayjs';
import { useContacts } from '@/hooks/useContacts';
import { useDeals } from '@/hooks/useDeals';
import { useCampaigns } from '@/hooks/useCampaigns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  const { data: contacts = [], isLoading: contactsLoading } = useContacts();
  const { data: deals = [], isLoading: dealsLoading } = useDeals();
  const { data: campaigns = [] } = useCampaigns();

  const loading = contactsLoading || dealsLoading;
  const pipelineValue = deals.reduce((sum, d) => sum + Number(d.value || 0), 0);

  const stats = [
    { label: 'Contacts', value: contacts.length, icon: Users, to: '/contacts' },
    { label: 'Open deals', value: deals.length, icon: KanbanSquare, to: '/pipeline' },
    { label: 'Pipeline value', value: `$${pipelineValue.toLocaleString()}`, icon: DollarSign, to: '/pipeline' },
    { label: 'Campaigns', value: campaigns.length, icon: Mail, to: '/campaigns' },
  ];

  const recentContacts = [...contacts]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/contacts">
              <Plus className="h-4 w-4" /> Add contact
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/campaigns">
              <Send className="h-4 w-4" /> New campaign
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, to }) => (
          <Link key={label} to={to} className="block">
            <Card className="transition-all hover:border-primary/40 hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <div className="text-2xl font-bold">{value}</div>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Recent contacts</CardTitle>
          <Link to="/contacts" className="flex items-center gap-1 text-sm text-primary hover:underline">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : recentContacts.length === 0 ? (
            <div className="flex flex-col items-start gap-3 py-4">
              <p className="text-sm text-muted-foreground">No contacts yet. Add your first one to get started.</p>
              <div className="flex gap-2">
                <Button asChild size="sm">
                  <Link to="/contacts">
                    <Plus className="h-4 w-4" /> Add contact
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/contacts">
                    <Upload className="h-4 w-4" /> Import CSV
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <ul className="divide-y">
              {recentContacts.map((c) => (
                <li key={c.id}>
                  <Link
                    to={`/contacts/${c.id}`}
                    className={cn(
                      'flex items-center justify-between rounded-md px-2 py-2.5 text-sm transition-colors hover:bg-muted/50'
                    )}
                  >
                    <span className="font-medium">{c.name}</span>
                    <span className="text-muted-foreground">{c.email || c.company || dayjs(c.created_at).format('MMM D')}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
