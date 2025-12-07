import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

// TODO: Move these types to a shared types package or generate from backend schema
export interface SessionResponse {
  data: {
    user: {
      id: string;
      email: string;
      name: string;
      emailVerified: boolean;
      image: string | null;
    };
    session: {
      id: string;
      expiresAt: string;
    };
  };
}

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
