import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/lib/api/client';

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
      void queryClient.invalidateQueries({ queryKey: ['items'] });
      void queryClient.invalidateQueries({ queryKey: ['accounts'] });
      void queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}
