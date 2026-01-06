import { LoginRequest, LoginResponse } from '@opulus/core';
import { useMutation } from '@tanstack/react-query';

import { apiClient } from '@/lib/api/client';

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
