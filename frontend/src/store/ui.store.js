import { create } from 'zustand';

/**
 * UI-only state (not server data). Currently the mobile sidebar drawer and
 * the command palette. Server data belongs in React Query, not here.
 */
export const useUIStore = create((set) => ({
  sidebarOpen: false, // mobile drawer
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  // Desktop (md+) collapse: hides the sidebar to give pages full width.
  sidebarCollapsed: false,
  toggleSidebarCollapsed: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  commandOpen: false, // Cmd+K palette
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  toggleCommand: () => set((s) => ({ commandOpen: !s.commandOpen })),

  shortcutsOpen: false, // Cmd+? overlay
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
}));
