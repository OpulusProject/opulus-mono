/**
 * Create Item endpoint DTOs
 */

/**
 * Create item request body
 */
export interface CreateItemRequest {
  publicToken: string;
  institutionId: string;
}

/**
 * Create item API response. Sent with 201 for a new item, or 409 with a
 * message when the user is already connected to the institution (itemId is
 * then the existing item).
 */
export interface CreateItemResponse {
  data: {
    itemId: string;
    duplicate: boolean;
  };
  message?: string;
}
