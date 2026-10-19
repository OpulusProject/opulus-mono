import type { HoldingsResponse } from '@opulus/core/dto';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { apiClient } from '@/lib/api/client';

import { investmentKeys } from './queryKeys';

export interface HoldingsParams {
  /** Only this account (our account id). */
  accountId?: string;
  /** Only accounts of this subtype (tfsa, rrsp, ...). */
  accountSubtype?: string;
  /** Only holdings of this security (our security id). */
  securityId?: string;
  /** Largest first (the default), or account by account. */
  sort?: 'value' | 'account';
}

const getHoldingsApi = async (
  params: HoldingsParams
): Promise<HoldingsResponse['data']> => {
  const response = await apiClient.get<HoldingsResponse>(
    '/api/investments/holdings',
    { params }
  );
  return response.data.data;
};

/**
 * Hook to fetch what the authenticated user holds in their investment
 * accounts, and what it adds up to (the server does the adding).
 *
 * @param params - Filters and order (all holdings, largest first, if omitted)
 * @param options.enabled - Wait to ask until this is true
 * @returns TanStack Query result with `summary`, `accounts` and `holdings`
 */
export function useHoldings(
  params: HoldingsParams = {},
  { enabled = true } = {}
) {
  return useQuery<HoldingsResponse['data'], Error>({
    queryKey: investmentKeys.holdings(params),
    queryFn: () => getHoldingsApi(params),
    enabled,
    placeholderData: keepPreviousData,
    retry: 1,
    staleTime: 2 * 60 * 1000,
  });
}
