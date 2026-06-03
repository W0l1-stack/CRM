import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { toast } from '@/store/toast.store';
import { apiErrorMessage } from '@/hooks/useAuth';

export function useDeals({ pipelineId } = {}) {
  return useQuery({
    queryKey: ['deals', { pipelineId }],
    queryFn: () =>
      api.get('/deals', { params: { pipeline_id: pipelineId || undefined } }).then(unwrap),
  });
}

export function useCreateDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.post('/deals', body).then(unwrap),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals'] });
      toast.success('Deal created');
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Could not create deal')),
  });
}

export function useUpdateDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => api.put(`/deals/${id}`, body).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals'] }),
    onError: (e) => toast.error(apiErrorMessage(e, 'Could not update deal')),
  });
}

export function useDeleteDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/deals/${id}`).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals'] }),
    onError: (e) => toast.error(apiErrorMessage(e, 'Could not delete deal')),
  });
}
