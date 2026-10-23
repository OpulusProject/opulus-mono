import type {
  ActivityKind,
  ActivityResponse,
  HoldingsRange,
} from '@opulus/core/dto';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';

import { apiClient } from '@/lib/api/client';

import { investmentKeys } from './queryKeys';

const PAGE_SIZE = 50;

export interface ActivityParams {
  /** Only these accounts (our account ids). */
  accountIds?: string[];
  securityId?: string;
  kind?: ActivityKind;
  /** The period to look at; all time if omitted. */
  range?: HoldingsRange;
  /** The first and last day (`YYYY-MM-DD`) of a `custom` range. */
  from?: string;
  to?: string;
}

const getActivityApi = async (
  params: ActivityParams & { page: number; limit: number }
): Promise<ActivityResponse['data']> => {
  const response = await apiClient.get<ActivityResponse>(
    '/api/investments/activity',
    {
      params: {
        page: params.page,
        limit: params.limit,
        ...(params.accountIds?.length && { accountId: params.accountIds }),
        ...(params.securityId && { securityId: params.securityId }),
        ...(params.kind && { kind: params.kind }),
        ...(params.range && { range: params.range }),
        ...(params.from && { from: params.from }),
        ...(params.to && { to: params.to }),
      },
      // Repeat the parameter (?accountId=a&accountId=b), not accountId[]=a.
      paramsSerializer: { indexes: null },
    }
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
