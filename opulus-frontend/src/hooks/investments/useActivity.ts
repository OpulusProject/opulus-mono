import type { ActivityKind, ActivityResponse } from '@opulus/core/dto';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';

import { apiClient } from '@/lib/api/client';

import { investmentKeys } from './queryKeys';

const PAGE_SIZE = 50;

export interface ActivityParams {
  accountId?: string;
  securityId?: string;
  kind?: ActivityKind;
  /** First and last day, `YYYY-MM-DD`. */
  startDate?: string;
  endDate?: string;
}

const getActivityApi = async (
  params: ActivityParams & { page: number; limit: number }
): Promise<ActivityResponse['data']> => {
  const response = await apiClient.get<ActivityResponse>(
    '/api/investments/activity',
    { params }
  );
  return response.data.data;
};

/**
 * Hook to read the user's investment activity a page at a time ("Load more").
 *
 * @param params - Filters; the page number is managed here
 * @param options.limit - Page size (50 by default)
 * @returns TanStack infinite query result; `data.pages` holds the loaded pages
 */
export function useActivity(
  params: ActivityParams,
  { limit = PAGE_SIZE, enabled = true } = {}
) {
  return useInfiniteQuery<ActivityResponse['data'], Error>({
    queryKey: investmentKeys.activity({ ...params, limit }),
    queryFn: ({ pageParam }) =>
      getActivityApi({ ...params, page: pageParam as number, limit }),
    initialPageParam: 1,
    getNextPageParam: ({ pagination }) =>
      pagination.page < pagination.totalPages ? pagination.page + 1 : undefined,
    placeholderData: keepPreviousData,
    enabled,
    retry: 1,
    staleTime: 2 * 60 * 1000,
  });
}
