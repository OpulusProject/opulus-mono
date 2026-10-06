/**
 * Get Items endpoint DTOs
 */

import type { PlaidErrorType } from "plaid";

import { Account } from "./bankAccount.js";
import { toLiabilityDetailsDTO } from "./liabilityDetails.js";

/**
 * Public DTO for Item response
 * Only includes fields safe to expose to the client
 */
export interface ItemPublicDTO {
  id: string;
  institutionName: string | null;
  institutionLogo: string | null;
  institutionColor: string | null;
  errorType: PlaidErrorType | null;
  errorCode: string | null;
  errorMessage: string | null;
  displayMessage: string | null;
  syncedAt: string | null;
  accounts: Account[];
}

/**
 * Items API response
 */
export interface ItemsResponse {
  data: {
    items: ItemPublicDTO[];
  };
}

/**
 * Transform full item data to public DTO
 * Filters out sensitive fields like accessToken, plaidItemId, etc.
 * @param item - Full item data from service (includes bankAccounts)
 * @returns Public DTO with only safe-to-expose fields
 */
export function toItemPublicDTO(item: {
  id: string;
  institutionName: string | null;
  institutionLogo: string | null;
  institutionColor: string | null;
  errorType: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  displayMessage: string | null;
  syncedAt: Date | null;
  bankAccounts: Array<{
    id: string;
    name: string;
    type: string;
    balanceAvailable: any; // Prisma Decimal
    balanceCurrent: any; // Prisma Decimal
    balanceLimit: any; // Prisma Decimal
    liabilityDetails: Parameters<typeof toLiabilityDetailsDTO>[0] | null;
  }>;
}): ItemPublicDTO {
  return {
    id: item.id,
    institutionName: item.institutionName,
    institutionLogo: item.institutionLogo,
    institutionColor: item.institutionColor,
    errorType: (item.errorType as PlaidErrorType | null) ?? null,
    errorCode: item.errorCode,
    errorMessage: item.errorMessage,
    displayMessage: item.displayMessage,
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
      liabilityDetails: account.liabilityDetails
        ? toLiabilityDetailsDTO(account.liabilityDetails)
        : null,
    })),
  };
}
