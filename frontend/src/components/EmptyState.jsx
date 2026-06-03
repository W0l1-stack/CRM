import { cn } from '@/lib/utils';

/**
 * Intentional empty state for pages with no data yet. Renders an icon, a
 * headline, a short description, and optional primary/secondary actions so a
 * fresh account never looks broken.
 *
 * <EmptyState
 *   icon={Users}
 *   title="No contacts yet"
 *   description="Add your first contact or import a CSV to get started."
 *   action={<Button>Add contact</Button>}
 * />
 */
export default function EmptyState({ icon: Icon, title, description, action, secondaryAction, className }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed bg-card/50 px-6 py-16 text-center',
        className
      )}
    >
      {Icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
          <Icon className="h-6 w-6" />
        </div>
      )}
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {(action || secondaryAction) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
