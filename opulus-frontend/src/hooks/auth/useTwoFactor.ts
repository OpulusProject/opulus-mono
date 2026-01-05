import { useMutation } from '@tanstack/react-query';

import { apiClient } from '@/lib/api/client';

export interface EnableTwoFactorRequest {
  password: string;
  issuer?: string;
}

export interface EnableTwoFactorResponse {
  totpURI: string;
  backupCodes: string[];
}

export interface VerifyTotpRequest {
  code: string;
  trustDevice?: boolean;
}

export interface VerifyTotpResponse {
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

const enableTwoFactorApi = async (
  data: EnableTwoFactorRequest
): Promise<EnableTwoFactorResponse> => {
  const response = await apiClient.post<EnableTwoFactorResponse>(
    '/api/auth/two-factor/enable',
    data
  );
  return response.data;
};

const verifyTotpApi = async (
  data: VerifyTotpRequest
): Promise<VerifyTotpResponse> => {
  const response = await apiClient.post<VerifyTotpResponse>(
    '/api/auth/two-factor/verify-totp',
    data
  );
  return response.data;
};

/**
 * Hook to enable two-factor authentication
 * Returns TOTP URI and backup codes
 */
export function useEnableTwoFactor() {
  return useMutation<EnableTwoFactorResponse, Error, EnableTwoFactorRequest>({
    mutationFn: enableTwoFactorApi,
  });
}

/**
 * Hook to verify TOTP code during sign-in
 * Returns user and session on success
 */
export function useVerifyTotp() {
  return useMutation<VerifyTotpResponse, Error, VerifyTotpRequest>({
    mutationFn: verifyTotpApi,
  });
}
