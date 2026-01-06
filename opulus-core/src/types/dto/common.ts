/**
 * Common DTO types used across multiple endpoints
 */

/**
 * Pagination metadata returned with paginated responses
 */
export interface PaginationMetadata {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

