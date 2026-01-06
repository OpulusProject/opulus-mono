import { SessionResponse } from '@opulus/core';
import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/lib/api/client';

const getSessionApi = async (): Promise<SessionResponse['data']> => {
  const response = await apiClient.get<SessionResponse>('/api/session');
  return response.data.data;
};

// Hook wraps the API function with TanStack Query
export function useSession() {
  return useQuery<SessionResponse['data'], Error>({
    queryKey: ['session'],
    queryFn: getSessionApi,
    retry: false, // Don't retry on 401/403 errors
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
  });
}
