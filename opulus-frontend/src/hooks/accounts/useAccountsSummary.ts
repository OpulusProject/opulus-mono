import type { AccountType, AccountsSummaryResponse } from '@opulus/core/dto';
import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/lib/api/client';

import { accountKeys } from './queryKeys';

const getAccountsSummaryApi = async (
  types?: AccountType[]
): Promise<AccountsSummaryResponse['data']> => {
  const response = await apiClient.get<AccountsSummaryResponse>(
    '/api/accounts/summary',
    {
      params: types?.length ? { type: types } : undefined,
      // Repeat the parameter (?type=credit&type=loan), not type[]=credit.
      paramsSerializer: { indexes: null },
    }
  );
  return response.data.data;
};

/**
 * Hook to fetch what the authenticated user's accounts add up to. The server
 * adds them up, so the client only displays the totals.
 *
 * @param types - Only accounts of these types (all accounts if omitted)
 * @returns TanStack Query result with `totals` per currency and `byType`
 */
export function useAccountsSummary(types?: AccountType[]) {
  return useQuery<AccountsSummaryResponse['data'], Error>({
    queryKey: accountKeys.summary(types),
    queryFn: () => getAccountsSummaryApi(types),
    retry: 1,
    staleTime: 2 * 60 * 1000, // Consider data fresh for 2 minutes
  });
}
