import { TransactionsResponse } from '@opulus/core';
import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/lib/api/client';

interface GetTransactionsParams {
  itemId?: string;
  accountId?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

const getTransactionsApi = async (
  params?: GetTransactionsParams
): Promise<TransactionsResponse['data']> => {
  const queryParams = new URLSearchParams();
  if (params?.itemId) queryParams.append('itemId', params.itemId);
  if (params?.accountId) queryParams.append('accountId', params.accountId);
  if (params?.startDate)
    queryParams.append('startDate', params.startDate.toISOString());
  if (params?.endDate)
    queryParams.append('endDate', params.endDate.toISOString());
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());

  const url = `/api/transactions${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const response = await apiClient.get<TransactionsResponse>(url);
  return response.data.data;
};

/**
 * Hook to fetch transactions for the authenticated user
 * Supports optional filtering by itemId or accountId, and pagination
 *
 * @param params - Optional filters and pagination parameters
 * @returns TanStack Query result with transactions array and pagination metadata
 */
export function useTransactions(params?: GetTransactionsParams) {
  return useQuery<TransactionsResponse['data'], Error>({
    queryKey: ['transactions', params],
    queryFn: () => getTransactionsApi(params),
    retry: 1,
    staleTime: 2 * 60 * 1000, // Consider data fresh for 2 minutes
  });
}

