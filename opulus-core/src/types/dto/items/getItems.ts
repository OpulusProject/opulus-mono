/**
 * Get Items endpoint DTOs
 */

import { Prisma } from "@prisma/client";
import { Account } from "./bankAccount.js";

/**
 * Persistable Plaid item error. Field names match Plaid's ItemError payload
 * so we can store the object as-is (Prisma Json) and read it without parsing.
 */
export interface ItemError {
  error_type: string;
  error_code: string;
  error_message: string;
  display_message?: string | null;
}

export interface ItemPublicDTO {
  id: string;
  institutionName: string | null;
  institutionLogo: string | null;
  institutionColor: string | null;
  error: ItemError | null;
  syncedAt: string | null;
  accounts: Account[];
}

export interface ItemsResponse {
  data: {
    items: ItemPublicDTO[];
  };
}

export function toItemError(value: Prisma.JsonValue | null): ItemError | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const { error_type, error_code, error_message, display_message } = value as {
    error_type?: unknown;
    error_code?: unknown;
    error_message?: unknown;
    display_message?: unknown;
  };
  if (
    typeof error_type !== "string" ||
    typeof error_code !== "string" ||
    typeof error_message !== "string"
  ) {
    return null;
  }
  return {
    error_type,
    error_code,
    error_message,
    display_message: typeof display_message === "string" ? display_message : null,
  };
}

export function toItemPublicDTO(item: {
  id: string;
  institutionName: string | null;
  institutionLogo: string | null;
  institutionColor: string | null;
  error: Prisma.JsonValue | null;
  syncedAt: Date | null;
  bankAccounts: Array<{
    id: string;
    name: string;
    type: string;
    balanceAvailable: any;
    balanceCurrent: any;
    balanceLimit: any;
  }>;
}): ItemPublicDTO {
  return {
    id: item.id,
    institutionName: item.institutionName,
    institutionLogo: item.institutionLogo,
    institutionColor: item.institutionColor,
    error: toItemError(item.error),
    syncedAt: item.syncedAt ? item.syncedAt.toISOString() : null,
    accounts: item.bankAccounts.map((account) => ({
      id: account.id,
      name: account.name,
      type: account.type,
      balanceAvailable: account.balanceAvailable
        ? Number(account.balanceAvailable)
        : null,
      balanceCurrent: account.balanceCurrent
        ? Number(account.balanceCurrent)
        : null,
      balanceLimit: account.balanceLimit ? Number(account.balanceLimit) : null,
    })),
  };
}
