import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';

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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals'] }),
  });
}

export function useUpdateDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => api.put(`/deals/${id}`, body).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals'] }),
  });
}
