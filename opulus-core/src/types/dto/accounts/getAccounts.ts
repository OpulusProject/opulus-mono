/**
 * Get Accounts endpoint DTOs
 */

import { AccountDTO, toAccountDTO } from "./account.js";

/**
 * Account types, matching Plaid's account `type`. `other` also covers any type
 * we do not recognize.
 */
export const ACCOUNT_TYPES = [
  "depository",
  "investment",
  "credit",
  "loan",
  "other",
] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

/**
 * The connection (item) an account belongs to, just enough to say where it is
 * and whether that connection has a problem.
 */
export interface AccountConnectionDTO {
  id: string;
  institutionName: string | null;
  errorCode: string | null;
}

export interface AccountWithConnectionDTO extends AccountDTO {
  connection: AccountConnectionDTO;
}

/**
 * Accounts API response
 */
export interface AccountsResponse {
  data: {
    accounts: AccountWithConnectionDTO[];
  };
}

/**
 * Transform a stored account row (with its item) to the public DTO
 */
export function toAccountWithConnectionDTO(
  account: Parameters<typeof toAccountDTO>[0] & {
    item: {
      id: string;
      institutionName: string | null;
      errorCode: string | null;
    };
  }
): AccountWithConnectionDTO {
  return {
    ...toAccountDTO(account),
    connection: {
      id: account.item.id,
      institutionName: account.item.institutionName,
      errorCode: account.item.errorCode,
    },
  };
}
