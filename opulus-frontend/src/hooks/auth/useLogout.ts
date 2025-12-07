import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { apiClient } from '@/lib/api/client';

const logoutApi = async (): Promise<void> => {
  await apiClient.post('/api/auth/sign-out');
};

// Hook wraps the API function with TanStack Query
export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation<void, Error, void>({
    mutationFn: logoutApi,
    onSuccess: () => {
      // Invalidate and clear session query
      queryClient.invalidateQueries({ queryKey: ['session'] });
      queryClient.removeQueries({ queryKey: ['session'] });

      // Redirect to login page
      navigate({ to: '/login', replace: true });
    },
  });
}
