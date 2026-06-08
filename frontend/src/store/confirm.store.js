import { create } from 'zustand';

/**
 * Global confirmation prompt for destructive actions. Mirrors the toast store:
 * <ConfirmHost /> (mounted once in the app shell) renders the dialog, and any
 * code calls `confirm({...})` which resolves to true/false.
 *
 * Usage:
 *   if (await confirm({ title: 'Delete deal?', description: '…', confirmLabel: 'Delete' })) {
 *     deleteDeal.mutate(id);
 *   }
 */
export const useConfirmStore = create((set, get) => ({
  request: null, // { opts, resolve }

  open: (opts) =>
    new Promise((resolve) => {
      // If a prompt is already open, resolve it false before replacing.
      get().request?.resolve(false);
      set({ request: { opts, resolve } });
    }),

  close: (result) => {
    const current = get().request;
    if (current) current.resolve(result);
    set({ request: null });
  },
}));

/** Imperative API for non-component code (mutation callbacks, handlers). */
export const confirm = (opts) => useConfirmStore.getState().open(opts);
