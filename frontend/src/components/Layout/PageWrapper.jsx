import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import CommandPalette from '@/components/CommandPalette';
import ShortcutsHelp from '@/components/ShortcutsHelp';
import OnboardingWizard from '@/components/OnboardingWizard';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

/** App shell for authenticated pages: sidebar + topbar + routed content. */
export default function PageWrapper() {
  useKeyboardShortcuts();
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-auto bg-muted/30 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
      <CommandPalette />
      <ShortcutsHelp />
      <OnboardingWizard />
    </div>
  );
}
