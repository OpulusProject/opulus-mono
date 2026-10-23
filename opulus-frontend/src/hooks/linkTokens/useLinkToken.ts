import { LinkTokenResponse } from '@opulus/core/dto';
import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/lib/api/client';

import { linkTokenKeys } from './queryKeys';

/**
 * Update-mode flavors. `reconnect` repairs a broken connection; `add-accounts`
 * opens Link's account selection, where the user chooses which of the
 * institution's accounts to share: checking one adds it (including accounts
 * that appeared since they linked it, the "new accounts available" prompt), and
 * unchecking one removes it. It is the "Manage accounts" session.
 */
export type UpdateMode = 'reconnect' | 'add-accounts';

/**
 * Hook to fetch a Plaid Link token.
 * - No `itemId` => new-item flow.
 * - `itemId` + `mode` => update-mode flow for that item.
 * - `enabled: false` => do not ask for one (when Link is resuming with a token
 *   it already has, after an OAuth bank sent the user back).
 */
export function useLinkToken(
  itemId?: string,
  mode: UpdateMode = 'reconnect',
  options: { enabled?: boolean } = {}
) {
  return useQuery<LinkTokenResponse['data'], Error>({
    queryKey: linkTokenKeys.forItem(itemId, mode),
    queryFn: async () => {
      const response = await apiClient.post<LinkTokenResponse>(
        `/api/link-tokens${itemId ? '/update' : ''}`,
        itemId ? { itemId, mode } : undefined
      );
      return response.data.data;
    },
    enabled: options.enabled ?? true,
    retry: 2,
    staleTime: 0, // Link tokens are single-use, don't cache
    gcTime: 0, // Don't keep in cache after unmount
  });
}
