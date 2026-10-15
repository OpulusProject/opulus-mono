import { DailyTransactionTotalsResponse } from '@opulus/core/dto';
import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/lib/api/client';

import { transactionKeys } from './queryKeys';
import {
  QUERY_SERIALIZER,
  type TransactionFilterParams,
  toQueryParams,
} from './transactionParams';

const getDailyTransactionTotalsApi = async (
  params?: TransactionFilterParams
): Promise<DailyTransactionTotalsResponse['data']> => {
  const response = await apiClient.get<DailyTransactionTotalsResponse>(
    '/api/transactions/daily-totals',
    { params: toQueryParams(params), paramsSerializer: QUERY_SERIALIZER }
  );
  return response.data.data;
};

/**
 * Hook to fetch each day's spending, income and net, in the base currency, for
 * the transactions matching the filters. The server adds them up,
 * so no page of transactions has to be loaded for it.
 *
 * @param params - Optional filters (the same ones as the list)
 * @returns TanStack Query result with `baseCurrency` and `byDay`
 */
export function useDailyTransactionTotals(params?: TransactionFilterParams) {
  return useQuery<DailyTransactionTotalsResponse['data'], Error>({
    queryKey: transactionKeys.dailyTotals(params),
    queryFn: () => getDailyTransactionTotalsApi(params),
    retry: 1,
    staleTime: 2 * 60 * 1000,
  });
}
