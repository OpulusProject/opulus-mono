import type { HoldingsResponse } from '@opulus/core/dto';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { apiClient } from '@/lib/api/client';

import { investmentKeys } from './queryKeys';

export interface HoldingsParams {
  /** Only these accounts (our account ids). */
  accountIds?: string[];
  /** Only holdings of this security (our security id). */
  securityId?: string;
  /** Only accounts of this subtype (tfsa, rrsp, ...). */
  accountSubtype?: string;
  /** `account` groups the holdings account by account (largest first otherwise). */
  sort?: 'value' | 'account';
}

const getHoldingsApi = async (
  params: HoldingsParams
): Promise<HoldingsResponse['data']> => {
  const response = await apiClient.get<HoldingsResponse>(
    '/api/investments/holdings',
    {
      params: {
        ...(params.accountIds?.length && { accountId: params.accountIds }),
        ...(params.securityId && { securityId: params.securityId }),
        ...(params.accountSubtype && { accountSubtype: params.accountSubtype }),
        ...(params.sort && { sort: params.sort }),
      },
      // Repeat the parameter (?accountId=a&accountId=b), not accountId[]=a.
      paramsSerializer: { indexes: null },
    }
  );
  return response.data.data;
};

/**
 * Hook to fetch what the authenticated user holds in their investment
 * accounts, and what it adds up to (the server does the adding).
 *
 * @param params - Filters (all holdings if omitted)
 * @returns TanStack Query result with `summary`, `accounts` and `holdings`
 */
export function useHoldings(params: HoldingsParams = {}) {
  return useQuery<HoldingsResponse['data'], Error>({
    queryKey: investmentKeys.holdings(params),
    queryFn: () => getHoldingsApi(params),
    placeholderData: keepPreviousData,
    retry: 1,
    staleTime: 2 * 60 * 1000,
  });
}
