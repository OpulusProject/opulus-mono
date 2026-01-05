import { useMutation } from '@tanstack/react-query';

import { apiClient } from '@/lib/api/client';

// TODO: Move these types to a shared types package or generate from backend schema
export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

// Login response can be either a successful login or a 2FA redirect
export type LoginResponse = TwoFactorRedirectResponse | LoginSuccessResponse;

export interface LoginSuccessResponse {
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

export interface TwoFactorRedirectResponse {
  twoFactorRedirect: true;
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
