import { useNavigate } from 'react-router-dom';
import { LogOut, Menu, PanelLeft, Search, CornerUpLeft } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { useUIStore } from '@/store/ui.store';
import { Button } from '@/components/ui/button';
import { getAgencyStash, returnToAgency } from '@/hooks/useSubAccounts';

export default function Topbar() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const toggleSidebarCollapsed = useUIStore((s) => s.toggleSidebarCollapsed);
  const toggleCommand = useUIStore((s) => s.toggleCommand);
  const inSubAccount = Boolean(getAgencyStash());

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="flex h-16 items-center justify-between gap-4 border-b bg-card px-4 md:px-6">
      <div className="flex items-center gap-2">
        {/* Mobile: open the drawer */}
        <button
          className="rounded-md p-2 text-muted-foreground hover:bg-secondary md:hidden"
          onClick={toggleSidebar}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        {/* Desktop: collapse/expand the sidebar */}
        <button
          className="hidden rounded-md p-2 text-muted-foreground hover:bg-secondary md:inline-flex"
          onClick={toggleSidebarCollapsed}
          aria-label="Toggle sidebar"
        >
          <PanelLeft className="h-5 w-5" />
        </button>
        {inSubAccount && (
          <Button variant="outline" size="sm" onClick={returnToAgency}>
            <CornerUpLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Return to agency</span>
          </Button>
        )}
        <button
          onClick={toggleCommand}
          className="flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary"
        >
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">Search…</span>
          <kbd className="hidden rounded border bg-muted px-1.5 text-[10px] font-medium sm:inline">⌘K</kbd>
        </button>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden text-sm text-muted-foreground sm:inline">{user?.email}</span>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Logout</span>
        </Button>
      </div>
    </header>
  );
}
