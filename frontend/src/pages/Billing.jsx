import { useSearchParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import { useBillingStatus, useCheckout, usePortal } from '@/hooks/useBilling';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const PLANS = [
  { id: 'starter', name: 'Starter', price: '$49', features: ['3 users', '2,000 contacts', '5,000 emails/mo', '500 SMS/mo'] },
  { id: 'pro', name: 'Pro', price: '$99', features: ['Unlimited users', 'Unlimited contacts', '25,000 emails/mo', '2,500 SMS/mo'] },
];

export default function Billing() {
  const { data: status, isLoading } = useBillingStatus();
  const checkout = useCheckout();
  const portal = usePortal();
  const [params] = useSearchParams();
  const banner = params.get('status');

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const plan = status?.plan || 'trial';
  const hasSub = status?.has_subscription;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Billing</h1>

      {banner === 'success' && (
        <Card className="border-primary"><CardContent className="p-4 text-sm">Payment successful — your plan is being activated.</CardContent></Card>
      )}
      {banner === 'cancel' && (
        <Card><CardContent className="p-4 text-sm text-muted-foreground">Checkout canceled. No changes were made.</CardContent></Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Current plan <Badge variant={plan === 'trial' ? 'secondary' : 'default'} className="capitalize">{plan}</Badge>
          </CardTitle>
          {plan === 'trial' && (
            <CardDescription>
              {status?.trial_days_left > 0
                ? `${status.trial_days_left} days left in your free trial.`
                : 'Your free trial has ended — upgrade to keep using Lydia.'}
            </CardDescription>
          )}
        </CardHeader>
        {hasSub && (
          <CardContent>
            <Button variant="outline" onClick={() => portal.mutate()} disabled={portal.isPending}>
              {portal.isPending ? 'Opening…' : 'Manage billing'}
            </Button>
          </CardContent>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {PLANS.map((p) => (
          <Card key={p.id}>
            <CardHeader>
              <CardTitle>{p.name}</CardTitle>
              <CardDescription>
                <span className="text-2xl font-bold text-foreground">{p.price}</span> / month
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="space-y-1 text-sm text-muted-foreground">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" /> {f}
                  </li>
                ))}
              </ul>
              <Button
                className="w-full"
                disabled={checkout.isPending || (plan === p.id && hasSub)}
                onClick={() => checkout.mutate(p.id)}
              >
                {plan === p.id && hasSub ? 'Current plan' : `Upgrade to ${p.name}`}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {checkout.isError && (
        <p className="text-sm text-destructive">
          {checkout.error?.response?.data?.error?.message || 'Could not start checkout (is billing configured?).'}
        </p>
      )}
    </div>
  );
}
