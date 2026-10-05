import { LinkTokenResponse } from '@opulus/core';
import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/lib/api/client';

/**
 * Update-mode flavors. Reserved for distinguishing future entry points
 * (e.g. a "new accounts available" nudge driven by Plaid's webhook signal)
 * from standard reconnect. All flavors currently resolve to a plain update-
 * mode Link token server-side.
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
        `/api/link-tokens${itemId ? '/update' : ''}`,
        itemId ? { itemId } : undefined
      );
      return response.data.data;
    },
    retry: 2,
    staleTime: 0, // Link tokens are single-use, don't cache
    gcTime: 0, // Don't keep in cache after unmount
  });
}
