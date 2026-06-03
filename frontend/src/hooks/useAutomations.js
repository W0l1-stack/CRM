import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { toast } from '@/store/toast.store';
import { apiErrorMessage } from '@/hooks/useAuth';

export function useAutomations() {
  return useQuery({
    queryKey: ['automations'],
    queryFn: () => api.get('/automations').then(unwrap),
  });
}

export function useAutomation(id) {
  return useQuery({
    queryKey: ['automation', id],
    queryFn: () => api.get(`/automations/${id}`).then(unwrap),
    enabled: Boolean(id),
  });
}

export function useCreateAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.post('/automations', body).then(unwrap),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['automations'] });
      toast.success('Automation created');
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Could not create automation')),
  });
}

export function useUpdateAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => api.put(`/automations/${id}`, body).then(unwrap),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['automations'] });
      if (vars?.id) qc.invalidateQueries({ queryKey: ['automation', vars.id] });
      toast.success('Automation saved');
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Could not update automation')),
  });
}

export function useDeleteAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/automations/${id}`).then(unwrap),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['automations'] });
      toast.success('Automation deleted');
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Could not delete automation')),
  });
}
