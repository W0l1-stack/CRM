import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Inline spinner. Use inside buttons or alongside text. */
export function Spinner({ className }) {
  return <Loader2 className={cn('h-4 w-4 animate-spin', className)} />;
}

/** Centered spinner for full-panel loading states. */
export function PageSpinner({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
