import {
  ACCOUNT_TYPES,
  type AccountType,
} from "../types/dto/accounts/getAccounts.js";

/**
 * An account's type as we group it: Plaid's own `type`, with the deprecated
 * `brokerage` folded into `investment` and anything unrecognized as `other`.
 */
export function normalizeAccountType(type: string): AccountType {
  if (type === "brokerage") return "investment";
  return (ACCOUNT_TYPES as readonly string[]).includes(type)
    ? (type as AccountType)
    : "other";
}

/** Credit and loan balances are what is owed (Plaid reports them positive). */
export function isOwed(type: string): boolean {
  const normalized = normalizeAccountType(type);
  return normalized === "credit" || normalized === "loan";
}

/**
 * A credit account's limit. Plaid sometimes sends only the limit or only the
 * available credit, so the one that is missing is derived from the other
 * (limit = owed + available). Null when it cannot be known.
 */
export function creditLimitOf(account: {
  balanceLimit: number | null;
  balanceAvailable: number | null;
  balanceCurrent: number | null;
}): number | null {
  if (account.balanceLimit !== null) return account.balanceLimit;
  if (account.balanceAvailable !== null && account.balanceCurrent !== null) {
    return account.balanceCurrent + account.balanceAvailable;
  }
  return null;
}
