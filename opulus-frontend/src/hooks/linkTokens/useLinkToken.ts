import { LinkTokenResponse } from '@opulus/core/dto';
import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/lib/api/client';

import { linkTokenKeys } from './queryKeys';

/**
 * Update-mode flavors. `reconnect` repairs a broken connection; `add-accounts`
 * also lets the user share accounts that appeared at the institution since
 * they linked it (the "new accounts available" prompt).
 */
export type UpdateMode = 'reconnect' | 'add-accounts';

/**
 * Hook to fetch a Plaid Link token.
 * - No `itemId` => new-item flow.
 * - `itemId` + `mode` => update-mode flow for that item.
 */
export function useLinkToken(itemId?: string, mode: UpdateMode = 'reconnect') {
  return useQuery<LinkTokenResponse['data'], Error>({
    queryKey: linkTokenKeys.forItem(itemId, mode),
    queryFn: async () => {
      const response = await apiClient.post<LinkTokenResponse>(
        `/api/link-tokens${itemId ? '/update' : ''}`,
        itemId ? { itemId, mode } : undefined
      );
      return response.data.data;
    },
    retry: 2,
    staleTime: 0, // Link tokens are single-use, don't cache
    gcTime: 0, // Don't keep in cache after unmount
  });
}
