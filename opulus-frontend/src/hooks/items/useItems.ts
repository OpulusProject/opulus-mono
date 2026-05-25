import { ItemsResponse } from '@opulus/core';
import { useQuery } from '@tanstack/react-query';

import { getApiClient } from '@/lib/api/getApiClient';

const getItemsApi = async (): Promise<ItemsResponse['data']> => {
  // getApiClient() returns demo client in demo mode (no network calls), real client otherwise
  const apiClient = getApiClient();
  const response = await apiClient.get<ItemsResponse>('/api/items');
  return response.data.data;
};

/**
 * Hook to fetch all items for the authenticated user with their bank accounts
 * Frontend should calculate metadata (account count, total balance) from accounts array
 *
 * @returns TanStack Query result with items array (each item includes accounts)
 */
export function useItems() {
  return useQuery<ItemsResponse['data'], Error>({
    queryKey: ['items'],
    queryFn: getItemsApi,
    retry: 1,
    staleTime: 2 * 60 * 1000, // Consider data fresh for 2 minutes
  });
}
