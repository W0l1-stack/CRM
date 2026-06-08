import { NavLink } from 'react-router-dom';
import { Users, KanbanSquare, MessageSquare, LayoutDashboard, Zap, CalendarDays, FileText, Mail, CreditCard, Settings as SettingsIcon, Building2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store/ui.store';
import { usePermissions } from '@/hooks/usePermissions';

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/contacts', label: 'Contacts', icon: Users },
  { to: '/pipeline', label: 'Pipeline', icon: KanbanSquare },
  { to: '/conversations', label: 'Conversations', icon: MessageSquare },
  { to: '/campaigns', label: 'Campaigns', icon: Mail },
  { to: '/automations', label: 'Automations', icon: Zap },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/forms', label: 'Forms', icon: FileText },
  { to: '/billing', label: 'Billing', icon: CreditCard },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

export default function Sidebar() {
  const open = useUIStore((s) => s.sidebarOpen);
  const setOpen = useUIStore((s) => s.setSidebarOpen);
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const { isOwner } = usePermissions();
  // Agency (sub-accounts) is owner-only.
  const items = isOwner ? [...nav, { to: '/agency', label: 'Agency', icon: Building2 }] : nav;

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 animate-fade-in md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r bg-card transition-transform duration-200',
          'md:static md:z-auto md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
          collapsed && 'md:hidden' // desktop collapse
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary font-bold text-primary-foreground">
            L
          </div>
          <span className="text-lg font-semibold">Lydia CRM</span>
          <button
            className="ml-auto rounded-md p-1 text-muted-foreground hover:bg-secondary md:hidden"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
