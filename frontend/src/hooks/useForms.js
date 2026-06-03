import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { toast } from '@/store/toast.store';
import { apiErrorMessage } from '@/hooks/useAuth';

export function useForms() {
  return useQuery({
    queryKey: ['forms'],
    queryFn: () => api.get('/forms').then(unwrap),
  });
}

export function useCreateForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.post('/forms', body).then(unwrap),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['forms'] });
      toast.success('Form created');
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Could not create form')),
  });
}

export function useDeleteForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/forms/${id}`).then(unwrap),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['forms'] });
      toast.success('Form deleted');
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Could not delete form')),
  });
}
