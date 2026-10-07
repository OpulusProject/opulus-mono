/**
 * Common DTO types and helpers used across multiple endpoints
 */

import type { Prisma } from "@prisma/client";

/**
 * Pagination metadata returned with paginated responses
 */
export interface PaginationMetadata {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Convert a Prisma decimal to a number for JSON, keeping null.
 * Prisma decimals serialize to strings, so DTOs must convert them.
 */
export function toNumber(
  value: Prisma.Decimal | null | undefined
): number | null {
  return value == null ? null : value.toNumber();
}

/**
 * Convert a date to an ISO string for JSON, keeping null.
 */
export function toIsoString(value: Date): string;
export function toIsoString(value: Date | null | undefined): string | null;
export function toIsoString(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}
