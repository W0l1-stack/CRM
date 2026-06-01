import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';

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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pipelines'] }),
  });
}
