import { useUIStore } from '@/store/ui.store';
import { Dialog } from '@/components/ui/dialog';

const SHORTCUTS = [
  { keys: ['⌘', 'K'], label: 'Open command palette / search' },
  { keys: ['⌘', 'N'], label: 'New contact' },
  { keys: ['?'], label: 'Show this help' },
  { keys: ['Esc'], label: 'Close dialogs and menus' },
];

/** Keyboard shortcut reference overlay, opened with `?`. */
export default function ShortcutsHelp() {
  const open = useUIStore((s) => s.shortcutsOpen);
  const setOpen = useUIStore((s) => s.setShortcutsOpen);

  return (
    <Dialog open={open} onClose={() => setOpen(false)} title="Keyboard shortcuts" className="max-w-md">
      <ul className="space-y-2">
        {SHORTCUTS.map((s) => (
          <li key={s.label} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{s.label}</span>
            <span className="flex gap-1">
              {s.keys.map((k) => (
                <kbd key={k} className="rounded border bg-muted px-2 py-0.5 text-xs font-medium">
                  {k}
                </kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
