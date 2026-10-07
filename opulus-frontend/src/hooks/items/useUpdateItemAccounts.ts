import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/lib/api/client';

export interface UpdateItemAccountsResponse {
  data: { itemId: string; created: number; updated: number };
}

/**
 * Reconcile a persisted Item's accounts with Plaid after a Link
 * update-mode session completes (Plaid does not fire a webhook for it).
 */
export function useUpdateItemAccounts() {
  const queryClient = useQueryClient();

  return useMutation<UpdateItemAccountsResponse, Error, string>({
    mutationFn: async (itemId) => {
      const response = await apiClient.post<UpdateItemAccountsResponse>(
        `/api/items/${itemId}/update-accounts`
      );
      return response.data;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['items'] });
      void queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}
