import {
  ACCOUNT_TYPES,
  type AccountType,
} from "../types/dto/accounts/accountType.js";
import { fromUnits, toUnits } from "./money.js";

/** Rounding to Plaid's 4 decimals keeps derived amounts clean. */
const round = (amount: number) => fromUnits(toUnits(amount));

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
 * How the transactions after a day bear on an account's balance on that day.
 * Money out is positive in Plaid's amounts. The values are what the money out
 * since is multiplied by to get from today's balance to the earlier one.
 */
export const BALANCE_DIRECTION = {
  /** A deposit account that paid money out since was higher then: add it back. */
  AddBack: 1,
  /** A credit or loan balance is what is owed: spending since raised it, so take it off. */
  TakeOff: -1,
  /**
   * Transactions do not explain the balance (an investment, whose value also
   * moves with the market): it is held flat.
   */
  Flat: 0,
} as const;

export type BalanceDirection =
  (typeof BALANCE_DIRECTION)[keyof typeof BALANCE_DIRECTION];

/** How an account's past balances follow from its balance today and the transactions since. */
export function balanceDirection(type: string): BalanceDirection {
  switch (normalizeAccountType(type)) {
    case "depository":
      return BALANCE_DIRECTION.AddBack;
    case "credit":
    case "loan":
      return BALANCE_DIRECTION.TakeOff;
    default:
      return BALANCE_DIRECTION.Flat;
  }
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
