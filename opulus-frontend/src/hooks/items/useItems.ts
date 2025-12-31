import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/lib/api/client';

/**
 * Public DTO for Item response
 * Matches the backend ItemPublicDTO interface
 */
export interface ItemPublicDTO {
  id: string;
  institutionName: string | null;
  institutionLogo: string | null;
  institutionColor: string | null;
  error: string | null;
  metadata: {
    accountCount: number;
    totalAvailableBalance: number;
  };
}

export interface ItemsResponse {
  data: {
    items: ItemPublicDTO[];
  };
}

const getItemsApi = async (): Promise<ItemsResponse['data']> => {
  const response = await apiClient.get<ItemsResponse>('/api/items');
  return response.data.data;
};

/**
 * Hook to fetch all items for the authenticated user with metadata
 * Includes account count and total available balance for each item
 *
 * @returns TanStack Query result with items array
 */
export function useItems() {
  return useQuery<ItemsResponse['data'], Error>({
    queryKey: ['items'],
    queryFn: getItemsApi,
    retry: 1,
    staleTime: 2 * 60 * 1000, // Consider data fresh for 2 minutes
  });
}

