/**
 * Get Items endpoint DTOs
 */

/**
 * Public DTO for Item response
 * Only includes fields safe to expose to the client
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

/**
 * Items API response
 */
export interface ItemsResponse {
  data: {
    items: ItemPublicDTO[];
  };
}

