import { TransactionsResponse } from '@opulus/core/dto';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';

import { transactionKeys } from './queryKeys';
import type { TransactionListParams } from './transactionParams';
import { getTransactionsApi } from './useTransactions';

const PAGE_SIZE = 50;

/**
 * Hook to read the user's transactions a page at a time ("Load more").
 *
 * @param params - Filters and sort; the page number is managed here
 * @returns TanStack infinite query result; `data.pages` holds the loaded pages
 */
export function useInfiniteTransactions(
  params: Omit<TransactionListParams, 'page' | 'limit'>
) {
  return useInfiniteQuery<TransactionsResponse['data'], Error>({
    queryKey: transactionKeys.infinite(params),
    queryFn: ({ pageParam }) =>
      getTransactionsApi({
        ...params,
        page: pageParam as number,
        limit: PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: ({ pagination }) =>
      pagination.page < pagination.totalPages ? pagination.page + 1 : undefined,
    placeholderData: keepPreviousData,
    retry: 1,
    staleTime: 2 * 60 * 1000,
  });
}
