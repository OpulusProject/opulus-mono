import { useMutation, useQueryClient } from '@tanstack/react-query';

import { accountKeys } from '@/hooks/accounts/queryKeys';
import { transactionKeys } from '@/hooks/transactions/queryKeys';
import { apiClient } from '@/lib/api/client';

import { itemKeys } from './queryKeys';

export interface DeleteItemInput {
  itemId: string;
}

/**
 * Hook to delete an item for the authenticated user
 * Disconnects the item from Plaid and deletes all accounts and transactions linked to it
 * @returns TanStack Mutation result; call mutate with the item ID to delete
 */
export function useDeleteItem() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, DeleteItemInput>({
    mutationFn: async ({ itemId }) => {
      await apiClient.delete(`/api/items/${itemId}`);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: itemKeys.all });
      void queryClient.invalidateQueries({ queryKey: accountKeys.all });
      void queryClient.invalidateQueries({ queryKey: transactionKeys.all });
    },
  });
}
