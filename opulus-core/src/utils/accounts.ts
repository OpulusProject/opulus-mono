import {
  ACCOUNT_TYPES,
  type AccountType,
} from "../types/dto/accounts/accountType.js";

/** Plaid's amounts have at most 4 decimals; rounding keeps derived ones clean. */
const round = (amount: number) => Math.round(amount * 10_000) / 10_000;

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

interface CreditBalances {
  balanceLimit: number | null;
  balanceAvailable: number | null;
  balanceCurrent: number | null;
}

/**
 * A credit account's limit. Plaid sometimes sends only the limit or only the
 * available credit, so the one that is missing is derived from the other
 * (limit = owed + available). Null when it cannot be known.
 */
export function creditLimitOf(account: CreditBalances): number | null {
  if (account.balanceLimit !== null) return account.balanceLimit;
  if (account.balanceAvailable !== null && account.balanceCurrent !== null) {
    return round(account.balanceCurrent + account.balanceAvailable);
  }
  return null;
}

/**
 * The credit still available on a credit account: what Plaid reports, or the
 * limit less what is owed when it does not. Null when it cannot be known.
 */
export function availableCreditOf(account: CreditBalances): number | null {
  if (account.balanceAvailable !== null) return account.balanceAvailable;
  const limit = creditLimitOf(account);
  if (limit !== null && account.balanceCurrent !== null) {
    return round(limit - account.balanceCurrent);
  }
  return null;
}
