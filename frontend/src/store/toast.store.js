import { create } from 'zustand';

/**
 * Lightweight toast notifications. Components fire toasts via the `toast`
 * helper; <Toaster /> (mounted once in the app shell) subscribes to this
 * store and renders them. Each toast auto-dismisses after `duration` ms
 * unless it carries an action (e.g. Undo), which keeps it on screen longer.
 */
export const useToastStore = create((set, get) => ({
  toasts: [],

  push: (toast) => {
    const id = toast.id ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const duration = toast.duration ?? (toast.action ? 6000 : 3500);
    set((s) => ({ toasts: [...s.toasts, { id, variant: 'default', ...toast }] }));
    if (duration > 0) {
      setTimeout(() => get().dismiss(id), duration);
    }
    return id;
  },

  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/**
 * Imperative API so non-component code (mutation callbacks) can fire toasts.
 * Usage: toast.success('Contact created'), toast.error('Something failed'),
 * toast.action('Contact deleted', { label: 'Undo', onClick: restore }).
 */
export const toast = {
  show: (message, opts = {}) => useToastStore.getState().push({ message, ...opts }),
  success: (message, opts = {}) => useToastStore.getState().push({ message, variant: 'success', ...opts }),
  error: (message, opts = {}) => useToastStore.getState().push({ message, variant: 'destructive', ...opts }),
  info: (message, opts = {}) => useToastStore.getState().push({ message, variant: 'default', ...opts }),
  action: (message, action, opts = {}) => useToastStore.getState().push({ message, action, ...opts }),
  dismiss: (id) => useToastStore.getState().dismiss(id),
};
