import { Users, KanbanSquare, DollarSign } from 'lucide-react';
import { useContacts } from '@/hooks/useContacts';
import { useDeals } from '@/hooks/useDeals';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Dashboard() {
  const { data: contacts = [] } = useContacts();
  const { data: deals = [] } = useDeals();

  const pipelineValue = deals.reduce((sum, d) => sum + Number(d.value || 0), 0);

  const stats = [
    { label: 'Contacts', value: contacts.length, icon: Users },
    { label: 'Open deals', value: deals.length, icon: KanbanSquare },
    { label: 'Pipeline value', value: `$${pipelineValue.toLocaleString()}`, icon: DollarSign },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
