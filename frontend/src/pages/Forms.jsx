import { useNavigate, Link } from 'react-router-dom';
import { Plus, Trash2, Copy, FileText, Pencil, ExternalLink } from 'lucide-react';
import { useForms, useDeleteForm } from '@/hooks/useForms';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CardsSkeleton } from '@/components/ui/skeleton';
import EmptyState from '@/components/EmptyState';
import { toast } from '@/store/toast.store';
import { confirm } from '@/store/confirm.store';

export default function Forms() {
  const { data: forms = [], isLoading } = useForms();
  const deleteForm = useDeleteForm();
  const navigate = useNavigate();

  const publicUrl = (id) => `${window.location.origin}/form/${id}`;
  const embed = (id) => `<iframe src="${publicUrl(id)}" width="100%" height="520" frameborder="0"></iframe>`;

  const copyEmbed = (id) => {
    navigator.clipboard?.writeText(embed(id));
    toast.success('Embed code copied');
  };

  const remove = async (form) => {
    if (
      await confirm({
        title: `Delete "${form.name}"?`,
        description: 'This permanently deletes the form. Submissions already captured as contacts are kept. This cannot be undone.',
        confirmLabel: 'Delete form',
      })
    ) {
      deleteForm.mutate(form.id);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Forms</h1>
        <Button asChild>
          <Link to="/forms/new">
            <Plus className="h-4 w-4" />
            New form
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <CardsSkeleton count={3} />
      ) : forms.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Capture leads with a form"
          description="Build a form with drag-and-drop fields, embed it on any site with one line of code. Submissions auto-create a contact and can fire an automation."
          action={
            <Button asChild>
              <Link to="/forms/new">
                <Plus className="h-4 w-4" />
                New form
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {forms.map((f) => (
            <Card key={f.id} className="transition-colors hover:border-primary/40">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <Link to={`/forms/${f.id}`} className="hover:underline">
                    <CardTitle className="text-base">{f.name}</CardTitle>
                  </Link>
                  <span className="text-xs text-muted-foreground">{f.submission_count} submissions</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => window.open(publicUrl(f.id), '_blank')}>
                    <ExternalLink className="h-4 w-4" /> Open
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => copyEmbed(f.id)}>
                    <Copy className="h-4 w-4" /> Embed
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/forms/${f.id}`}>
                      <Pencil className="h-4 w-4" /> Edit
                    </Link>
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(f)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Fields: {(f.fields || []).map((fl) => fl.label || fl.name).join(', ') || '—'}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
