import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { toast } from '@/store/toast.store';
import { apiErrorMessage } from '@/hooks/useAuth';

export function usePipelines() {
  return useQuery({
    queryKey: ['pipelines'],
    queryFn: () => api.get('/pipelines').then(unwrap),
  });
}

export function useCreatePipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.post('/pipelines', body).then(unwrap),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pipelines'] });
      toast.success('Pipeline created');
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Could not create pipeline')),
  });
}

export function useUpdatePipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => api.put(`/pipelines/${id}`, body).then(unwrap),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pipelines'] });
      toast.success('Pipeline saved');
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Could not update pipeline')),
  });
}

export function useDeletePipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/pipelines/${id}`).then(unwrap),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pipelines'] });
      qc.invalidateQueries({ queryKey: ['deals'] });
      toast.success('Pipeline deleted');
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Could not delete pipeline')),
  });
}
