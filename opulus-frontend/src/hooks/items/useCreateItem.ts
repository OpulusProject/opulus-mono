import { CreateItemRequest, CreateItemResponse } from '@opulus/core/dto';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';

import { apiClient } from '@/lib/api/client';

/**
 * Exchange a Plaid Link public_token for an access token and persist the Item.
 * Backend short-circuits with HTTP 409 when the Link metadata matches an
 * Item the user has already linked; we surface that as `duplicate: true`
 * instead of a thrown error so callers can toast cleanly.
 */
export function useCreateItem() {
  const queryClient = useQueryClient();

  return useMutation<CreateItemResponse, Error, CreateItemRequest>({
    mutationFn: async (input) => {
      try {
        const response = await apiClient.post<CreateItemResponse>(
          '/api/items',
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
      void queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}
