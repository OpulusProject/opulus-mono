import type { NetWorthHistoryResponse, NetWorthRange } from '@opulus/core/dto';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { apiClient } from '@/lib/api/client';

import { accountKeys } from './queryKeys';

const getNetWorthHistoryApi = async (
  range: NetWorthRange
): Promise<NetWorthHistoryResponse['data']> => {
  const response = await apiClient.get<NetWorthHistoryResponse>(
    '/api/accounts/net-worth',
    { params: { range } }
  );
  return response.data.data;
};

/**
 * Hook to fetch the authenticated user's net worth for each day in a range
 *
 * @param range - How far back to go, counting back from today
 * @returns TanStack Query result with one series per currency, a point per
 *   day, oldest first. The last point is today, from the live balances. While
 *   another range loads, the previous one stays in `data`.
 */
export function useNetWorthHistory(range: NetWorthRange) {
  return useQuery<NetWorthHistoryResponse['data'], Error>({
    queryKey: accountKeys.netWorth(range),
    queryFn: () => getNetWorthHistoryApi(range),
    placeholderData: keepPreviousData,
    retry: 1,
    staleTime: 2 * 60 * 1000, // Consider data fresh for 2 minutes
  });
}
