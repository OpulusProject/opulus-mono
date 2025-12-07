import { useMutation } from '@tanstack/react-query';

import { apiClient } from '@/lib/api/client';

// TODO: Move these types to a shared types package or generate from backend schema
export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginResponse {
  user: {
    id: string;
    email: string;
    name: string | null;
    emailVerified: boolean;
  };
  session: {
    id: string;
    token: string;
    expiresAt: string;
  };
}

const loginApi = async (credentials: LoginRequest): Promise<LoginResponse> => {
  const response = await apiClient.post<LoginResponse>(
    '/api/auth/sign-in/email',
    credentials
  );
  return response.data;
};

// Hook wraps the API function with TanStack Query
export function useLogin() {
  return useMutation<LoginResponse, Error, LoginRequest>({
    mutationFn: loginApi,
  });
}
