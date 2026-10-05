/**
 * Get Items endpoint DTOs
 */

import { Account } from "./bankAccount.js";

export interface ItemPublicDTO {
  id: string;
  institutionName: string | null;
  institutionLogo: string | null;
  institutionColor: string | null;
  errorType: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  displayMessage: string | null;
  syncedAt: string | null;
  accounts: Account[];
}

export interface ItemsResponse {
  data: {
    items: ItemPublicDTO[];
  };
}

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
    errorType: item.errorType,
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
    })),
  };
}
