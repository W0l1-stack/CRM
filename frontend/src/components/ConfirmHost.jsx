import { useConfirmStore } from '@/store/confirm.store';
import { ConfirmDialog } from '@/components/ui/dialog';

/**
 * Mount once near the app root (next to <Toaster />). Renders the active
 * confirmation prompt from the confirm store. Fire prompts via `confirm()`.
 */
export function ConfirmHost() {
  const request = useConfirmStore((s) => s.request);
  const close = useConfirmStore((s) => s.close);

  if (!request) return null;
  const { opts } = request;

  return (
    <ConfirmDialog
      open
      onClose={() => close(false)}
      onConfirm={() => close(true)}
      title={opts.title}
      description={opts.description}
      confirmLabel={opts.confirmLabel}
      cancelLabel={opts.cancelLabel}
      variant={opts.variant}
    />
  );
}
