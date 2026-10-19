import type { ActivitySummaryResponse } from '@opulus/core/dto';
import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/lib/api/client';

import { investmentKeys } from './queryKeys';

const getActivitySummaryApi = async (
  accountId?: string
): Promise<ActivitySummaryResponse['data']> => {
  const response = await apiClient.get<ActivitySummaryResponse>(
    '/api/investments/activity/summary',
    { params: accountId ? { accountId } : undefined }
  );
  return response.data.data;
};

/**
 * Hook to fetch what the user's investment accounts paid, charged and took in
 * over the last twelve months.
 *
 * @param accountId - Only this account (all accounts if omitted)
 */
export function useActivitySummary(accountId?: string) {
  return useQuery<ActivitySummaryResponse['data'], Error>({
    queryKey: investmentKeys.activitySummary(accountId),
    queryFn: () => getActivitySummaryApi(accountId),
    retry: 1,
    staleTime: 2 * 60 * 1000,
  });
}
