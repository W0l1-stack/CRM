import { NavLink } from 'react-router-dom';
import { Users, KanbanSquare, MessageSquare, LayoutDashboard, Zap, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/contacts', label: 'Contacts', icon: Users },
  { to: '/pipeline', label: 'Pipeline', icon: KanbanSquare },
  { to: '/conversations', label: 'Conversations', icon: MessageSquare },
  { to: '/automations', label: 'Automations', icon: Zap },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
];

export default function Sidebar() {
  return (
    <aside className="flex w-60 flex-col border-r bg-card">
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary font-bold text-primary-foreground">
          L
        </div>
        <span className="text-lg font-semibold">Lydia CRM</span>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {nav.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
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
  );
}
