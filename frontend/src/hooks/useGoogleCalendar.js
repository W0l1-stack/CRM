import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { toast } from '@/store/toast.store';
import { apiErrorMessage } from '@/hooks/useAuth';

export function useGoogleStatus() {
  return useQuery({
    queryKey: ['google-status'],
    queryFn: () => api.get('/integrations/google/status').then(unwrap),
  });
}

/** Fetches the consent URL on demand and redirects the browser to Google. */
export function useConnectGoogle() {
  return useMutation({
    mutationFn: () => api.get('/integrations/google/auth-url').then(unwrap),
    onSuccess: (data) => {
      if (data?.url) window.location.href = data.url;
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Google Calendar is not configured on this server')),
  });
}

export function useDisconnectGoogle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete('/integrations/google').then(unwrap),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['google-status'] });
      toast.success('Google Calendar disconnected');
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Could not disconnect')),
  });
}
