import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';

export function useAutomations() {
  return useQuery({
    queryKey: ['automations'],
    queryFn: () => api.get('/automations').then(unwrap),
  });
}

export function useCreateAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.post('/automations', body).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['automations'] }),
  });
}

export function useUpdateAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => api.put(`/automations/${id}`, body).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['automations'] }),
  });
}

export function useDeleteAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/automations/${id}`).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['automations'] }),
  });
}
