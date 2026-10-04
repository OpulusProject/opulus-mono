import { LinkTokenResponse } from '@opulus/core';
import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/lib/api/client';

/**
 * Update-mode flavors backed by Plaid's Link update mode:
 * - `reconnect`: default update mode — repair auth errors.
 * - `add-accounts`: update mode with `update.account_selection_enabled: true`
 *   so the user can add additional accounts to an existing Item.
 */
export type UpdateMode = 'reconnect' | 'add-accounts';

/**
 * Hook to fetch a Plaid Link token.
 * - No `itemId` => new-item flow.
 * - `itemId` + `mode` => update-mode flow for that item.
 */
export function useLinkToken(itemId?: string, mode: UpdateMode = 'reconnect') {
  return useQuery<LinkTokenResponse['data'], Error>({
    queryKey: ['plaid', 'linkToken', itemId ?? 'new', mode],
    queryFn: async () => {
      const response = await apiClient.post<LinkTokenResponse>(
        `/api/plaid/link-token${itemId ? '/update' : ''}`,
        itemId ? { itemId, addAccounts: mode === 'add-accounts' } : undefined
      );
      return response.data.data;
    },
    retry: 2,
    staleTime: 0, // Link tokens are single-use, don't cache
    gcTime: 0, // Don't keep in cache after unmount
  });
}
