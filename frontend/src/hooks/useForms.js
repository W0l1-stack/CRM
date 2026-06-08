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

export function useForm(id) {
  return useQuery({
    queryKey: ['form', id],
    queryFn: () => api.get(`/forms/${id}`).then(unwrap),
    enabled: Boolean(id),
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

export function useUpdateForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => api.put(`/forms/${id}`, body).then(unwrap),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['forms'] });
      if (vars?.id) qc.invalidateQueries({ queryKey: ['form', vars.id] });
      toast.success('Form saved');
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Could not update form')),
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
