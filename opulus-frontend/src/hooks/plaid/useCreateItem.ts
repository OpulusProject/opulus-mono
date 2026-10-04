import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';

import { apiClient } from '@/lib/api/client';

export interface CreateItemInput {
  publicToken: string;
  institutionId: string;
}

export interface CreateItemResponse {
  data: { itemId: string; duplicate: boolean };
  message?: string;
}

/**
 * Exchange a Plaid Link public_token for an access token and persist the Item.
 * Backend short-circuits with HTTP 409 when the Link metadata matches an
 * Item the user has already linked; we surface that as `duplicate: true`
 * instead of a thrown error so callers can toast cleanly.
 */
export function useCreateItem() {
  const queryClient = useQueryClient();

  return useMutation<CreateItemResponse, Error, CreateItemInput>({
    mutationFn: async (input) => {
      try {
        const response = await apiClient.post<CreateItemResponse>(
          '/api/plaid/items',
          input
        );
        return response.data;
      } catch (error) {
        if (error instanceof AxiosError && error.response?.status === 409) {
          return error.response.data as CreateItemResponse;
        }
        throw error;
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });
}
