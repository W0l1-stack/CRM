import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { toast } from '@/store/toast.store';
import { apiErrorMessage } from '@/hooks/useAuth';

export function useCampaigns() {
  return useQuery({
    queryKey: ['campaigns'],
    queryFn: () => api.get('/campaigns').then(unwrap),
  });
}

export function useCampaign(id) {
  return useQuery({
    queryKey: ['campaign', id],
    queryFn: () => api.get(`/campaigns/${id}`).then(unwrap),
    enabled: Boolean(id),
  });
}

export function useCampaignRecipients(id) {
  return useQuery({
    queryKey: ['campaign-recipients', id],
    queryFn: () => api.get(`/campaigns/${id}/recipients`).then(unwrap),
    enabled: Boolean(id),
  });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.post('/campaigns', body).then(unwrap),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campaign saved as draft');
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Could not save campaign')),
  });
}

export function useSendCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.post(`/campaigns/${id}/send`).then(unwrap),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campaign is sending');
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Could not send campaign')),
  });
}

export function useScheduleCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, scheduled_at }) => api.post(`/campaigns/${id}/schedule`, { scheduled_at }).then(unwrap),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campaign scheduled');
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Could not schedule campaign')),
  });
}

export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/campaigns/${id}`).then(unwrap),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campaign deleted');
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Could not delete campaign')),
  });
}
