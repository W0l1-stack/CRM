import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useToastStore } from '@/store/toast.store';
import { cn } from '@/lib/utils';

const ICONS = {
  success: CheckCircle2,
  destructive: AlertCircle,
  default: Info,
};

const VARIANTS = {
  success: 'border-green-200 bg-green-50 text-green-900',
  destructive: 'border-destructive/30 bg-destructive/10 text-destructive',
  default: 'border-border bg-card text-card-foreground',
};

/**
 * Mount once near the app root. Renders the toast stack bottom-right with a
 * fade/slide-in. Reads from the toast store; fire toasts via the `toast` helper.
 */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((t) => {
        const Icon = ICONS[t.variant] || Info;
        return (
          <div
            key={t.id}
            role="status"
            className={cn(
              'pointer-events-auto flex items-start gap-3 rounded-lg border p-4 shadow-md',
              'animate-fade-in-up',
              VARIANTS[t.variant] || VARIANTS.default
            )}
          >
            <Icon className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="flex-1 text-sm">
              {t.title && <p className="font-medium">{t.title}</p>}
              <p className={cn(t.title && 'text-muted-foreground')}>{t.message}</p>
              {t.action && (
                <button
                  className="mt-2 text-sm font-semibold underline underline-offset-2 hover:opacity-80"
                  onClick={() => {
                    t.action.onClick?.();
                    dismiss(t.id);
                  }}
                >
                  {t.action.label}
                </button>
              )}
            </div>
            <button
              className="shrink-0 opacity-60 transition-opacity hover:opacity-100"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
