import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';

export function useAppointmentTypes() {
  return useQuery({
    queryKey: ['appointment-types'],
    queryFn: () => api.get('/appointment-types').then(unwrap),
  });
}

export function useCreateAppointmentType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.post('/appointment-types', body).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['appointment-types'] }),
  });
}

export function useDeleteAppointmentType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/appointment-types/${id}`).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['appointment-types'] }),
  });
}

export function useAppointments() {
  return useQuery({
    queryKey: ['appointments'],
    queryFn: () => api.get('/appointments').then(unwrap),
  });
}

export function useUpdateAppointmentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }) => api.put(`/appointments/${id}/status`, { status }).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['appointments'] }),
  });
}
