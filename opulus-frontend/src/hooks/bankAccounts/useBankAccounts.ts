import { BankAccountType, BankAccountsResponse } from '@opulus/core';
import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/lib/api/client';

const getBankAccountsApi = async (
  types?: BankAccountType[]
): Promise<BankAccountsResponse['data']> => {
  const response = await apiClient.get<BankAccountsResponse>(
    '/api/bank-accounts',
    {
      params: types?.length ? { type: types } : undefined,
      // Repeat the parameter (?type=credit&type=loan), not type[]=credit.
      paramsSerializer: { indexes: null },
    }
  );
  return response.data.data;
};

/**
 * Hook to fetch the authenticated user's bank accounts across all connections
 *
 * @param types - Only accounts of these types (all accounts if omitted)
 * @returns TanStack Query result with accounts, each with the connection it belongs to
 */
export function useBankAccounts(types?: BankAccountType[]) {
  return useQuery<BankAccountsResponse['data'], Error>({
    queryKey: ['bank-accounts', types ?? 'all'],
    queryFn: () => getBankAccountsApi(types),
    retry: 1,
    staleTime: 2 * 60 * 1000, // Consider data fresh for 2 minutes
  });
}
