import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserPlus, Trash2, Mail, MessageSquare, CalendarDays, CreditCard, CheckCircle2, ArrowRight } from 'lucide-react';
import {
  useMe, useUpdateMe, useAccount, useUpdateAccount,
  useTeam, useInviteMember, useChangeRole, useRemoveMember,
} from '@/hooks/useSettings';
import { apiErrorMessage } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TimezoneSelect } from '@/components/ui/timezone-select';
import { cn } from '@/lib/utils';

const selectClass = 'flex h-9 rounded-md border border-input bg-background px-2 text-sm';

const TABS = [
  { key: 'account', label: 'Account' },
  { key: 'team', label: 'Team' },
  { key: 'integrations', label: 'Integrations' },
  { key: 'billing', label: 'Billing' },
];

export default function Settings() {
  const [tab, setTab] = useState('account');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              tab === t.key
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'account' && (
        <div className="space-y-6">
          <ProfileCard />
          <WorkspaceCard />
        </div>
      )}
      {tab === 'team' && <TeamCard />}
      {tab === 'integrations' && <IntegrationsCard />}
      {tab === 'billing' && <BillingSummary />}
    </div>
  );
}

function ProfileCard() {
  const { data: me } = useMe();
  const updateMe = useUpdateMe();
  const [form, setForm] = useState({ name: '', timezone: '' });
  useEffect(() => { if (me) setForm({ name: me.name || '', timezone: me.timezone || 'UTC' }); }, [me]);

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Your profile</CardTitle></CardHeader>
      <CardContent>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => { e.preventDefault(); updateMe.mutate(form); }}
        >
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>Timezone</Label>
            <TimezoneSelect
              className="w-56"
              value={form.timezone}
              onChange={(tz) => setForm((f) => ({ ...f, timezone: tz }))}
            />
          </div>
          <Button type="submit" disabled={updateMe.isPending}>{updateMe.isPending ? 'Saving…' : 'Save'}</Button>
          {me?.email && <span className="text-sm text-muted-foreground">· {me.email}</span>}
        </form>
      </CardContent>
    </Card>
  );
}

function WorkspaceCard() {
  const { data: account } = useAccount();
  const updateAccount = useUpdateAccount();
  const [form, setForm] = useState({ name: '', timezone: '' });
  useEffect(() => { if (account) setForm({ name: account.name || '', timezone: account.timezone || 'UTC' }); }, [account]);

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Workspace</CardTitle></CardHeader>
      <CardContent>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => { e.preventDefault(); updateAccount.mutate(form); }}
        >
          <div className="space-y-1">
            <Label>Workspace name</Label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>Timezone</Label>
            <TimezoneSelect
              className="w-56"
              value={form.timezone}
              onChange={(tz) => setForm((f) => ({ ...f, timezone: tz }))}
            />
          </div>
          <Button type="submit" disabled={updateAccount.isPending}>{updateAccount.isPending ? 'Saving…' : 'Save'}</Button>
          {account?.plan && <Badge variant="secondary" className="capitalize">{account.plan}</Badge>}
        </form>
        {updateAccount.isError && <p className="mt-2 text-sm text-destructive">{apiErrorMessage(updateAccount.error)}</p>}
      </CardContent>
    </Card>
  );
}

function TeamCard() {
  const { data: team = [] } = useTeam();
  const invite = useInviteMember();
  const changeRole = useChangeRole();
  const removeMember = useRemoveMember();
  const [form, setForm] = useState({ name: '', email: '', role: 'member' });
  const [tempPw, setTempPw] = useState(null);

  const submit = (e) => {
    e.preventDefault();
    invite.mutate(form, {
      onSuccess: (res) => {
        setTempPw({ email: res.user.email, pw: res.temporary_password });
        setForm({ name: '', email: '', role: 'member' });
      },
    });
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Team members</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <form className="flex flex-wrap items-end gap-2" onSubmit={submit}>
          <Input placeholder="Name" className="max-w-[160px]" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <Input placeholder="Email" type="email" className="max-w-[200px]" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          <select className={selectClass} value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
            <option value="member">member</option>
            <option value="admin">admin</option>
          </select>
          <Button type="submit" disabled={invite.isPending}>
            <UserPlus className="h-4 w-4" /> Invite
          </Button>
        </form>
        {invite.isError && <p className="text-sm text-destructive">{apiErrorMessage(invite.error)}</p>}
        {tempPw && (
          <p className="rounded-md bg-secondary p-3 text-sm">
            Invited <strong>{tempPw.email}</strong>. Share this temporary password: <code>{tempPw.pw}</code>
          </p>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {team.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">
                  {m.name} {!m.is_active && <Badge variant="secondary">inactive</Badge>}
                </TableCell>
                <TableCell className="text-muted-foreground">{m.email}</TableCell>
                <TableCell>
                  <select
                    className={selectClass}
                    value={m.role}
                    onChange={(e) => changeRole.mutate({ id: m.id, role: e.target.value })}
                  >
                    <option value="owner">owner</option>
                    <option value="admin">admin</option>
                    <option value="member">member</option>
                  </select>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => removeMember.mutate(m.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {changeRole.isError && <p className="text-sm text-destructive">{apiErrorMessage(changeRole.error)}</p>}
        {removeMember.isError && <p className="text-sm text-destructive">{apiErrorMessage(removeMember.error)}</p>}
      </CardContent>
    </Card>
  );
}

function IntegrationsCard() {
  const integrations = [
    { icon: Mail, name: 'Email (Resend)', desc: 'Outbound email and campaigns are delivered through Resend.', status: 'Managed' },
    { icon: MessageSquare, name: 'SMS (Twilio)', desc: 'Two-way SMS is delivered through Twilio.', status: 'Managed' },
    { icon: CalendarDays, name: 'Google Calendar', desc: 'Connect your calendar to sync availability and block booked slots.', status: 'Configure', to: '/calendar' },
  ];
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Integrations</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {integrations.map((it) => (
          <div key={it.name} className="flex items-center justify-between rounded-md border p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-secondary">
                <it.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium">{it.name}</p>
                <p className="text-sm text-muted-foreground">{it.desc}</p>
              </div>
            </div>
            {it.status === 'Managed' ? (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="h-3 w-3" /> Active
              </Badge>
            ) : (
              <Button asChild variant="outline" size="sm">
                <Link to={it.to}>Configure <ArrowRight className="h-3 w-3" /></Link>
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function BillingSummary() {
  const { data: account } = useAccount();
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Billing</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">Current plan:</span>
          <Badge variant="secondary" className="capitalize">{account?.plan || 'trial'}</Badge>
        </div>
        <Button asChild>
          <Link to="/billing">Manage plan & usage <ArrowRight className="h-4 w-4" /></Link>
        </Button>
      </CardContent>
    </Card>
  );
}
