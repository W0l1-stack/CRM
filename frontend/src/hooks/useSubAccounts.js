import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { toast } from '@/store/toast.store';
import { apiErrorMessage } from '@/hooks/useAuth';

const STASH_KEY = 'lydia-agency-stash';

export function useSubAccounts() {
  return useQuery({
    queryKey: ['sub-accounts'],
    queryFn: () => api.get('/sub-accounts').then(unwrap),
  });
}

export function useCreateSubAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.post('/sub-accounts', body).then(unwrap),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sub-accounts'] });
      toast.success('Sub-account created');
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Could not create sub-account')),
  });
}

/**
 * Switches the active session into a sub-account. The current (agency) session
 * is stashed so the operator can return to it, then the new session replaces it
 * and the app reloads at the dashboard inside the client workspace.
 */
export function useSwitchSubAccount() {
  return useMutation({
    mutationFn: (id) => api.post(`/sub-accounts/${id}/switch`).then(unwrap),
    onSuccess: (result) => {
      const { user, accessToken, refreshToken } = useAuthStore.getState();
      // Stash the agency session so we can come back.
      localStorage.setItem(STASH_KEY, JSON.stringify({ user, accessToken, refreshToken }));
      useAuthStore.getState().setSession(result);
      window.location.assign('/');
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Could not switch account')),
  });
}

/** Reads the stashed agency session (if the user switched into a sub-account). */
export function getAgencyStash() {
  try {
    return JSON.parse(localStorage.getItem(STASH_KEY) || 'null');
  } catch {
    return null;
  }
}

/** Restores the stashed agency session and returns to the agency dashboard. */
export function returnToAgency() {
  const stash = getAgencyStash();
  if (!stash) return;
  useAuthStore.getState().setSession({
    user: stash.user,
    tokens: { access_token: stash.accessToken, refresh_token: stash.refreshToken },
  });
  localStorage.removeItem(STASH_KEY);
  window.location.assign('/agency');
}
