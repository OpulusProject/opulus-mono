/**
 * Get Bank Accounts endpoint DTOs
 */

import { Account, toBankAccountDTO } from "../items/bankAccount.js";

/**
 * Bank account types, matching Plaid's account `type`. `other` also covers any type
 * we do not recognize.
 */
export const BANK_ACCOUNT_TYPES = [
  "depository",
  "investment",
  "credit",
  "loan",
  "other",
] as const;

export type BankAccountType = (typeof BANK_ACCOUNT_TYPES)[number];

/**
 * The connection (item) an account belongs to, just enough to say where it is
 * and whether that connection has a problem.
 */
export interface BankAccountConnection {
  id: string;
  institutionName: string | null;
  errorCode: string | null;
}

export interface BankAccountWithConnection extends Account {
  connection: BankAccountConnection;
}

/**
 * Accounts API response
 */
export interface BankAccountsResponse {
  data: {
    accounts: BankAccountWithConnection[];
  };
}

/**
 * Transform a stored bank account row (with its item) to the public DTO
 */
export function toBankAccountWithConnectionDTO(
  account: Parameters<typeof toBankAccountDTO>[0] & {
    item: {
      id: string;
      institutionName: string | null;
      errorCode: string | null;
    };
  }
): BankAccountWithConnection {
  return {
    ...toBankAccountDTO(account),
    connection: {
      id: account.item.id,
      institutionName: account.item.institutionName,
      errorCode: account.item.errorCode,
    },
  };
}
