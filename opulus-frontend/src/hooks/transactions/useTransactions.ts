import { TransactionsResponse } from '@opulus/core/dto';
import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/lib/api/client';

import { transactionKeys } from './queryKeys';
import {
  QUERY_SERIALIZER,
  type TransactionListParams,
  toQueryParams,
} from './transactionParams';

export const getTransactionsApi = async (
  params?: TransactionListParams
): Promise<TransactionsResponse['data']> => {
  const response = await apiClient.get<TransactionsResponse>(
    '/api/transactions',
    { params: toQueryParams(params), paramsSerializer: QUERY_SERIALIZER }
  );
  return response.data.data;
};

/**
 * Hook to fetch transactions for the authenticated user
 * Supports filtering, sorting and pagination
 *
 * @param params - Optional filters and pagination parameters
 * @returns TanStack Query result with transactions array and pagination metadata
 */
export function useTransactions(params?: TransactionListParams) {
  return useQuery<TransactionsResponse['data'], Error>({
    queryKey: transactionKeys.list(params),
    queryFn: () => getTransactionsApi(params),
    retry: 1,
    staleTime: 2 * 60 * 1000, // Consider data fresh for 2 minutes
  });
}
