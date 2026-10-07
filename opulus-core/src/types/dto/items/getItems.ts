/**
 * Get Items endpoint DTOs
 */

import type { PlaidErrorType } from "plaid";

import { AccountDTO, toAccountDTO } from "../accounts/account.js";
import { toIsoString } from "../common.js";

/**
 * Item (a connection to an institution) as returned by the API
 * Only includes fields safe to expose to the client
 */
export interface ItemDTO {
  id: string;
  institutionName: string | null;
  institutionLogo: string | null;
  institutionColor: string | null;
  errorType: PlaidErrorType | null;
  errorCode: string | null;
  errorMessage: string | null;
  displayMessage: string | null;
  /** Plaid found accounts the user has not shared yet; they can add them. */
  newAccountsAvailable: boolean;
  syncedAt: string | null;
  accounts: AccountDTO[];
}

/**
 * Items API response
 */
export interface ItemsResponse {
  data: {
    items: ItemDTO[];
  };
}

/**
 * Transform full item data to public DTO
 * Filters out sensitive fields like accessToken, plaidItemId, etc.
 * @param item - Full item data from service (includes accounts)
 * @returns Public DTO with only safe-to-expose fields
 */
export function toItemDTO(item: {
  id: string;
  institutionName: string | null;
  institutionLogo: string | null;
  institutionColor: string | null;
  errorType: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  displayMessage: string | null;
  newAccountsAvailable: boolean;
  syncedAt: Date | null;
  accounts: Array<Parameters<typeof toAccountDTO>[0]>;
}): ItemDTO {
  return {
    id: item.id,
    institutionName: item.institutionName,
    institutionLogo: item.institutionLogo,
    institutionColor: item.institutionColor,
    errorType: (item.errorType as PlaidErrorType | null) ?? null,
    errorCode: item.errorCode,
    errorMessage: item.errorMessage,
    displayMessage: item.displayMessage,
    newAccountsAvailable: item.newAccountsAvailable,
    syncedAt: toIsoString(item.syncedAt),
    accounts: item.accounts.map(toAccountDTO),
  };
}
