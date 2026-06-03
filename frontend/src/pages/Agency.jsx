import { useState } from 'react';
import { Building2, Plus, Users, ArrowRightCircle, Copy } from 'lucide-react';
import { useSubAccounts, useCreateSubAccount, useSwitchSubAccount } from '@/hooks/useSubAccounts';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CardsSkeleton } from '@/components/ui/skeleton';
import EmptyState from '@/components/EmptyState';
import { toast } from '@/store/toast.store';

export default function Agency() {
  const { isOwner } = usePermissions();
  const { data: subs = [], isLoading } = useSubAccounts();
  const switchTo = useSwitchSubAccount();
  const [showCreate, setShowCreate] = useState(false);
  const [created, setCreated] = useState(null);

  if (!isOwner) {
    return (
      <EmptyState
        icon={Building2}
        title="Owner access required"
        description="Only the agency owner can manage sub-accounts."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Agency</h1>
          <p className="text-sm text-muted-foreground">Create and manage isolated client workspaces.</p>
        </div>
        <Button onClick={() => setShowCreate((v) => !v)}>
          <Plus className="h-4 w-4" />
          New sub-account
        </Button>
      </div>

      {showCreate && (
        <CreateSubAccount
          onCreated={(res) => {
            setCreated(res);
            setShowCreate(false);
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {created && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="space-y-2 p-4 text-sm">
            <p className="font-medium text-green-900">Sub-account “{created.account.name}” created.</p>
            <p>
              Owner login: <strong>{created.owner_email}</strong> · temporary password:{' '}
              <code className="rounded bg-white px-1">{created.temporary_password}</code>
              <Button
                variant="ghost"
                size="icon"
                className="ml-1 h-6 w-6"
                onClick={() => {
                  navigator.clipboard?.writeText(created.temporary_password);
                  toast.success('Password copied');
                }}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </p>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <CardsSkeleton count={3} />
      ) : subs.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No sub-accounts yet"
          description="Create a workspace for each client. Each one is fully isolated — separate contacts, deals, automations, and settings."
          action={
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" />
              New sub-account
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subs.map((s) => (
            <Card key={s.id} className="transition-all hover:border-primary/40 hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base">{s.name}</CardTitle>
                <Badge variant="secondary" className="capitalize">{s.plan}</Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-4 w-4" /> {s.contact_count} contacts
                  </span>
                  <span>{s.user_count} users</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={switchTo.isPending}
                  onClick={() => switchTo.mutate(s.id)}
                >
                  <ArrowRightCircle className="h-4 w-4" />
                  Open workspace
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateSubAccount({ onCreated, onCancel }) {
  const create = useCreateSubAccount();
  const [form, setForm] = useState({ name: '', owner_name: '', owner_email: '' });

  const submit = (e) => {
    e.preventDefault();
    create.mutate(form, { onSuccess: (res) => onCreated(res) });
  };

  const field = (key) => ({
    value: form[key],
    onChange: (e) => setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">New sub-account</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid grid-cols-1 gap-3 sm:grid-cols-3" onSubmit={submit}>
          <div className="space-y-1">
            <Label>Workspace name *</Label>
            <Input required placeholder="Client Co." {...field('name')} />
          </div>
          <div className="space-y-1">
            <Label>Owner name *</Label>
            <Input required placeholder="Jane Doe" {...field('owner_name')} />
          </div>
          <div className="space-y-1">
            <Label>Owner email *</Label>
            <Input required type="email" placeholder="jane@client.co" {...field('owner_email')} />
          </div>
          <div className="flex gap-2 sm:col-span-3">
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Creating…' : 'Create sub-account'}
            </Button>
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
