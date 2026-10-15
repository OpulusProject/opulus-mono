import { SpendingByCategoryResponse } from '@opulus/core/dto';
import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/lib/api/client';

import { transactionKeys } from './queryKeys';
import {
  QUERY_SERIALIZER,
  type TransactionFilterParams,
  toQueryParams,
} from './transactionParams';

export interface SpendingByCategoryParams extends TransactionFilterParams {
  /** List only this many categories; the rest are added up in `other`. */
  top?: number;
}

const getSpendingByCategoryApi = async ({
  top,
  ...filters
}: SpendingByCategoryParams = {}): Promise<
  SpendingByCategoryResponse['data']
> => {
  const response = await apiClient.get<SpendingByCategoryResponse>(
    '/api/transactions/spending-by-category',
    {
      params: { ...toQueryParams(filters), top },
      paramsSerializer: QUERY_SERIALIZER,
    }
  );
  return response.data.data;
};

/**
 * Hook to fetch what was spent in each category, with each one's share of the
 * total, for the transactions matching the filters. The server ranks and adds
 * them up, so the client only displays the result.
 *
 * @param params - Optional filters (the same ones as the list), and `top`
 * @returns TanStack Query result with one entry per currency
 */
export function useSpendingByCategory(params?: SpendingByCategoryParams) {
  return useQuery<SpendingByCategoryResponse['data'], Error>({
    queryKey: transactionKeys.spendingByCategory(params),
    queryFn: () => getSpendingByCategoryApi(params),
    retry: 1,
    staleTime: 2 * 60 * 1000,
  });
}
