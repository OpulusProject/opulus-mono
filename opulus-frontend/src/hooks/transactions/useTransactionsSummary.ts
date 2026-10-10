import { TransactionsSummaryResponse } from '@opulus/core/dto';
import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/lib/api/client';

import { transactionKeys } from './queryKeys';
import {
  QUERY_SERIALIZER,
  type TransactionFilterParams,
  toQueryParams,
} from './transactionParams';

const getTransactionsSummaryApi = async (
  params?: TransactionFilterParams
): Promise<TransactionsSummaryResponse['data']> => {
  const response = await apiClient.get<TransactionsSummaryResponse>(
    '/api/transactions/summary',
    { params: toQueryParams(params), paramsSerializer: QUERY_SERIALIZER }
  );
  return response.data.data;
};

/**
 * Hook to fetch totals and spending by category and by day for the
 * transactions matching the filters. The server adds them up, so no page of
 * transactions has to be loaded for it.
 *
 * @param params - Optional filters (the same ones as the list)
 * @returns TanStack Query result with `totals`, `byCategory` and `byDay`
 */
export function useTransactionsSummary(params?: TransactionFilterParams) {
  return useQuery<TransactionsSummaryResponse['data'], Error>({
    queryKey: transactionKeys.summary(params),
    queryFn: () => getTransactionsSummaryApi(params),
    retry: 1,
    staleTime: 2 * 60 * 1000,
  });
}
