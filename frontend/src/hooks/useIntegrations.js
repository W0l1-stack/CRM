import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { toast } from '@/store/toast.store';
import { apiErrorMessage } from '@/hooks/useAuth';

/**
 * Real connection state for the platform integrations (email, SMS, Google
 * Calendar). Reports the account's own provider when connected, else the
 * server-managed fallback.
 */
export function useIntegrationsStatus() {
  return useQuery({
    queryKey: ['integrations-status'],
    queryFn: () => api.get('/integrations/status').then(unwrap),
    staleTime: 30_000,
  });
}

/** Supported providers + their required credential fields, for the Connect form. */
export function useIntegrationCatalog() {
  return useQuery({
    queryKey: ['integration-catalog'],
    queryFn: () => api.get('/integrations/catalog').then(unwrap),
    staleTime: 5 * 60_000,
  });
}

export function useConnectIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.post('/integrations/connections', body).then(unwrap),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integrations-status'] });
      toast.success('Connected');
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Could not connect')),
  });
}

export function useDisconnectIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (kind) => api.delete(`/integrations/connections/${kind}`).then(unwrap),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integrations-status'] });
      toast.success('Disconnected');
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Could not disconnect')),
  });
}
