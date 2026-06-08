import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Clock, UserPlus, KanbanSquare, Send, Check } from 'lucide-react';
import { useAccount, useUpdateAccount } from '@/hooks/useSettings';
import { useCreateContact } from '@/hooks/useContacts';
import { useCreatePipeline } from '@/hooks/usePipelines';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TimezoneSelect, guessTimezone } from '@/components/ui/timezone-select';
import { cn } from '@/lib/utils';

const DEFAULT_STAGES = [
  { id: 'new', name: 'New Lead', order: 1 },
  { id: 'contacted', name: 'Contacted', order: 2 },
  { id: 'proposal', name: 'Proposal', order: 3 },
  { id: 'won', name: 'Won', order: 4 },
];

const flagKey = (id) => `lydia-onboarded-${id}`;

/**
 * First-run onboarding. Shown once per account: name the workspace, set a
 * timezone, add a first contact, create a pipeline, and point at campaigns.
 * Every step is skippable and the whole thing can be dismissed.
 */
export default function OnboardingWizard() {
  const navigate = useNavigate();
  const { data: account } = useAccount();
  const updateAccount = useUpdateAccount();
  const createContact = useCreateContact();
  const createPipeline = useCreatePipeline();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [biz, setBiz] = useState('');
  const [tz, setTz] = useState('');
  const [contact, setContact] = useState({ name: '', email: '' });

  useEffect(() => {
    if (!account) return;
    if (!localStorage.getItem(flagKey(account.id))) {
      setBiz(account.name || '');
      setTz(account.timezone || guessTimezone());
      setOpen(true);
    }
  }, [account]);

  if (!account) return null;

  const finish = () => {
    localStorage.setItem(flagKey(account.id), '1');
    setOpen(false);
  };

  const steps = [
    {
      icon: Building2,
      title: "What's your business name?",
      body: (
        <div className="space-y-1">
          <Label>Business / workspace name</Label>
          <Input value={biz} onChange={(e) => setBiz(e.target.value)} placeholder="Acme Co." autoFocus />
        </div>
      ),
      onNext: () => {
        if (biz.trim() && biz.trim() !== account.name) {
          updateAccount.mutate({ name: biz.trim(), timezone: tz || account.timezone });
        }
      },
    },
    {
      icon: Clock,
      title: 'What timezone are you in?',
      body: (
        <div className="space-y-1">
          <Label>Timezone</Label>
          <TimezoneSelect value={tz} onChange={setTz} />
          <p className="text-xs text-muted-foreground">Used for scheduling, reminders, and campaign send times.</p>
        </div>
      ),
      onNext: () => {
        if (tz.trim() && tz.trim() !== account.timezone) {
          updateAccount.mutate({ name: biz.trim() || account.name, timezone: tz.trim() });
        }
      },
    },
    {
      icon: UserPlus,
      title: 'Add your first contact',
      body: (
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1 sm:col-span-1">
            <Label>Name</Label>
            <Input value={contact.name} onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))} autoFocus />
          </div>
          <div className="col-span-2 space-y-1 sm:col-span-1">
            <Label>Email</Label>
            <Input type="email" value={contact.email} onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))} />
          </div>
          <p className="col-span-2 text-xs text-muted-foreground">Or import a CSV later from the Contacts page.</p>
        </div>
      ),
      onNext: () => {
        if (contact.name.trim()) {
          createContact.mutate({ name: contact.name.trim(), email: contact.email || null, tags: [] });
        }
      },
    },
    {
      icon: KanbanSquare,
      title: 'Create your first pipeline',
      body: (
        <p className="text-sm text-muted-foreground">
          We’ll set up a starter <strong>Sales Pipeline</strong> with New&nbsp;Lead → Contacted → Proposal → Won so you
          can start dragging deals between stages.
        </p>
      ),
      onNext: () => {
        createPipeline.mutate({ name: 'Sales Pipeline', stages: DEFAULT_STAGES });
      },
    },
    {
      icon: Send,
      title: "You're all set!",
      body: (
        <p className="text-sm text-muted-foreground">
          Next, try sending your first email campaign to your contacts. You can always revisit setup from Settings.
        </p>
      ),
      cta: 'Go to campaigns',
      onNext: () => navigate('/campaigns/new'),
    },
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;
  const Icon = current.icon;

  const next = () => {
    current.onNext?.();
    if (isLast) finish();
    else setStep((s) => s + 1);
  };

  return (
    <Dialog open={open} onClose={finish} className="max-w-lg">
      <div className="space-y-5">
        {/* Stepper */}
        <div className="flex items-center gap-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors',
                i < step ? 'bg-primary' : i === step ? 'bg-primary/60' : 'bg-muted'
              )}
            />
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            {isLast ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
          </div>
          <h2 className="text-lg font-semibold">{current.title}</h2>
        </div>

        <div>{current.body}</div>

        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" size="sm" onClick={finish}>
            Skip setup
          </Button>
          <div className="flex gap-2">
            {step > 0 && !isLast && (
              <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            )}
            <Button onClick={next}>{current.cta || (isLast ? 'Finish' : 'Continue')}</Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
