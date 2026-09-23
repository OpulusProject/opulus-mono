import { LinkTokenResponse } from '@opulus/core';
import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/lib/api/client';

/**
 * Hook to fetch a Plaid Link token
 * The token is used to initialize Plaid Link on the frontend
 *
 * @returns TanStack Query result with linkToken
 */
export function useLinkToken(itemId?: string) {
  return useQuery<LinkTokenResponse['data'], Error>({
    queryKey: ['plaid', 'linkToken', itemId ?? 'new'],
    queryFn: async () => {
      const response = await apiClient.post<LinkTokenResponse>(
        `/api/plaid/link-token${itemId ? '/update' : ''}`,
        itemId ? { itemId } : undefined
      );
      return response.data.data;
    },
    retry: 2,
    staleTime: 0, // Link tokens are single-use, don't cache
    gcTime: 0, // Don't keep in cache after unmount
  });
}
