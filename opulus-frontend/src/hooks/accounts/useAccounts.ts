import { AccountType, AccountsResponse } from '@opulus/core/dto';
import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/lib/api/client';

const getAccountsApi = async (
  types?: AccountType[]
): Promise<AccountsResponse['data']> => {
  const response = await apiClient.get<AccountsResponse>('/api/accounts', {
    params: types?.length ? { type: types } : undefined,
    // Repeat the parameter (?type=credit&type=loan), not type[]=credit.
    paramsSerializer: { indexes: null },
  });
  return response.data.data;
};

/**
 * Hook to fetch the authenticated user's accounts across all connections
 *
 * @param types - Only accounts of these types (all accounts if omitted)
 * @returns TanStack Query result with accounts, each with the connection it belongs to
 */
export function useAccounts(types?: AccountType[]) {
  return useQuery<AccountsResponse['data'], Error>({
    queryKey: ['accounts', types ?? 'all'],
    queryFn: () => getAccountsApi(types),
    retry: 1,
    staleTime: 2 * 60 * 1000, // Consider data fresh for 2 minutes
  });
}
