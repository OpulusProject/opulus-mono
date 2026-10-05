import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';

import { apiClient } from '@/lib/api/client';

export interface DeleteItemInput {
  itemId: string;
}

export interface DeleteItemResponse {
  data: object;
}

/**
 * Hook to delete an item for the authenticated user
 * Deletes all accounts and transactions linked to the item
 * @returns TanStack Query result with items array (each item includes accounts)
 */
export function useDeleteItem() {
  const queryClient = useQueryClient();

  return useMutation<DeleteItemResponse, Error, DeleteItemInput>({
    mutationFn: async (input) => {
      try {
        const response = await apiClient.post<DeleteItemResponse>(
          '/api/plaid/items',
          input
        );
        return response.data;
      } catch (error) {
        if (error instanceof AxiosError && error.response?.status === 409) {
          return error.response.data as DeleteItemResponse;
        }
        throw error;
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });
}
