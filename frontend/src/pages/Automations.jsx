import { useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Plus, Trash2, Zap, Pencil } from 'lucide-react';
import {
  useAutomations,
  useUpdateAutomation,
  useDeleteAutomation,
} from '@/hooks/useAutomations';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CardsSkeleton } from '@/components/ui/skeleton';
import EmptyState from '@/components/EmptyState';

export default function Automations() {
  const navigate = useNavigate();
  const { data: automations = [], isLoading } = useAutomations();
  const updateAutomation = useUpdateAutomation();
  const deleteAutomation = useDeleteAutomation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Command palette / ⌘N deep-link opens the visual builder.
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      searchParams.delete('new');
      setSearchParams(searchParams, { replace: true });
      navigate('/automations/new');
    }
  }, [searchParams, setSearchParams, navigate]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Automations</h1>
        <Button asChild>
          <Link to="/automations/new">
            <Plus className="h-4 w-4" />
            New automation
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <CardsSkeleton count={3} />
      ) : automations.length === 0 ? (
        <EmptyState
          icon={Zap}
          title="Automations follow up for you"
          description="Build a workflow like “when a contact is created, wait 2 days then send a follow-up email.” Set it once and it runs automatically."
          action={
            <Button asChild>
              <Link to="/automations/new">
                <Plus className="h-4 w-4" />
                New automation
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {automations.map((a) => (
            <Card key={a.id} className="transition-colors hover:border-primary/40">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  <Link to={`/automations/${a.id}`} className="hover:underline">
                    <CardTitle className="text-base">{a.name}</CardTitle>
                  </Link>
                  <Badge variant={a.is_active ? 'default' : 'secondary'}>
                    {a.is_active ? 'Active' : 'Paused'}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateAutomation.mutate({ ...a, is_active: !a.is_active })}
                  >
                    {a.is_active ? 'Pause' : 'Activate'}
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/automations/${a.id}`}>
                      <Pencil className="h-4 w-4" /> Edit
                    </Link>
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteAutomation.mutate(a.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                When{' '}
                <span className="font-medium text-foreground">
                  {(a.trigger_types?.length ? a.trigger_types : a.trigger_type ? [a.trigger_type] : []).join(', ') || '—'}
                </span>{' '}
                →{' '}
                {(a.actions || []).map((act, i) => (
                  <Badge key={i} variant="outline" className="ml-1">
                    {act.type}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
