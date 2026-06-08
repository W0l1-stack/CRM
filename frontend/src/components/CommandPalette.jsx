import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  Search, Users, KanbanSquare, MessageSquare, Mail, Zap, CalendarDays,
  FileText, CreditCard, Settings as SettingsIcon, LayoutDashboard, Plus, User,
} from 'lucide-react';
import { useUIStore } from '@/store/ui.store';
import { useContacts } from '@/hooks/useContacts';
import { cn } from '@/lib/utils';

const PAGES = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard, keywords: 'home overview' },
  { label: 'Contacts', to: '/contacts', icon: Users, keywords: 'people leads' },
  { label: 'Pipeline', to: '/pipeline', icon: KanbanSquare, keywords: 'deals kanban' },
  { label: 'Conversations', to: '/conversations', icon: MessageSquare, keywords: 'inbox messages sms email' },
  { label: 'Campaigns', to: '/campaigns', icon: Mail, keywords: 'email marketing blast' },
  { label: 'Automations', to: '/automations', icon: Zap, keywords: 'workflow trigger' },
  { label: 'Calendar', to: '/calendar', icon: CalendarDays, keywords: 'appointments booking' },
  { label: 'Forms', to: '/forms', icon: FileText, keywords: 'lead capture' },
  { label: 'Billing', to: '/billing', icon: CreditCard, keywords: 'plan subscription' },
  { label: 'Settings', to: '/settings', icon: SettingsIcon, keywords: 'account team profile' },
];

const ACTIONS = [
  { label: 'New contact', to: '/contacts?new=1', icon: Plus, keywords: 'add create person' },
  { label: 'New campaign', to: '/campaigns/new', icon: Plus, keywords: 'add create email' },
  { label: 'New form', to: '/forms/new', icon: Plus, keywords: 'add create lead capture' },
  { label: 'New automation', to: '/automations?new=1', icon: Plus, keywords: 'add create workflow' },
];

/**
 * Cmd+K command palette: jump to any page, run a quick action, or search
 * contacts by name/email/company. Arrow keys navigate, Enter selects, Esc closes.
 */
export default function CommandPalette() {
  const open = useUIStore((s) => s.commandOpen);
  const setOpen = useUIStore((s) => s.setCommandOpen);
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);

  // Only fetch contacts while the palette is open and a query is typed.
  const { data: contacts = [] } = useContacts({ search: open && query ? query : '' });

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (item) =>
      !q || item.label.toLowerCase().includes(q) || (item.keywords || '').includes(q);

    const pages = PAGES.filter(match).map((p) => ({ ...p, group: 'Pages', run: () => navigate(p.to) }));
    const actions = ACTIONS.filter(match).map((a) => ({ ...a, group: 'Actions', run: () => navigate(a.to) }));
    const people = q
      ? contacts.slice(0, 6).map((c) => ({
          label: c.name,
          sublabel: c.email || c.company,
          icon: User,
          group: 'Contacts',
          run: () => navigate(`/contacts/${c.id}`),
        }))
      : [];

    return [...actions, ...pages, ...people];
  }, [query, contacts, navigate]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  useEffect(() => setActive(0), [query]);

  if (!open) return null;

  const close = () => setOpen(false);
  const choose = (item) => {
    item.run();
    close();
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[active]) choose(results[active]);
    } else if (e.key === 'Escape') {
      close();
    }
  };

  let lastGroup = null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-start justify-center p-4 pt-[12vh]">
      <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={close} aria-hidden />
      <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-lg border bg-card shadow-xl animate-scale-in">
        <div className="flex items-center gap-2 border-b px-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search pages, actions, contacts…"
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">esc</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto py-2">
          {results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No results.</p>
          ) : (
            results.map((item, i) => {
              const showGroup = item.group !== lastGroup;
              lastGroup = item.group;
              const Icon = item.icon;
              return (
                <div key={`${item.group}-${item.label}-${i}`}>
                  {showGroup && (
                    <p className="px-4 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {item.group}
                    </p>
                  )}
                  <button
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(item)}
                    className={cn(
                      'flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors',
                      active === i ? 'bg-secondary' : 'hover:bg-secondary/60'
                    )}
                  >
                    {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
                    <span className="flex-1">{item.label}</span>
                    {item.sublabel && <span className="text-xs text-muted-foreground">{item.sublabel}</span>}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
