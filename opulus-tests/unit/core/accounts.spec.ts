import { expect, test } from "@playwright/test";
import {
  availableCreditOf,
  balanceDirection,
  BALANCE_DIRECTION,
  creditLimitOf,
  isOwed,
  normalizeAccountType,
} from "@opulus/core";

const balances = (limit: number | null, available: number | null, current: number | null) => ({
  balanceLimit: limit,
  balanceAvailable: available,
  balanceCurrent: current,
});

/**
 * How accounts are classified and how a credit account's numbers fill in for
 * each other (opulus-core/src/utils/accounts.ts). Net worth, the spending and
 * the credit utilisation all hang on these, with Plaid's inconsistent data.
 *
 * Test cases:
 * - normalizeAccountType keeps Plaid's known types, folds brokerage into investment and calls anything else other
 * - isOwed is true for credit and loan only
 * - balanceDirection adds back for deposit accounts, takes off for credit and loans, holds the rest flat
 * - creditLimitOf prefers the limit Plaid sent, else owed + available, else null
 * - availableCreditOf prefers what Plaid sent, else limit - owed, else null
 * - the derived amounts are rounded to Plaid's four decimals
 */
test.describe("account helpers", () => {
  test("normalizeAccountType keeps Plaid's known types, folds brokerage into investment and calls anything else other", () => {
    expect(["depository", "credit", "loan", "investment"].map(normalizeAccountType)).toEqual([
      "depository",
      "credit",
      "loan",
      "investment",
    ]);
    expect(normalizeAccountType("brokerage")).toBe("investment");
    expect(normalizeAccountType("other")).toBe("other");
    expect(normalizeAccountType("crypto-wallet")).toBe("other");
    expect(normalizeAccountType("")).toBe("other");
  });

  test("isOwed is true for credit and loan only", () => {
    expect(["credit", "loan"].map(isOwed)).toEqual([true, true]);
    expect(["depository", "investment", "brokerage", "other", "unknown"].map(isOwed)).toEqual([false, false, false, false, false]);
  });

  test("balanceDirection adds back for deposit accounts, takes off for credit and loans, holds the rest flat", () => {
    expect(balanceDirection("depository")).toBe(BALANCE_DIRECTION.AddBack);
    expect(balanceDirection("credit")).toBe(BALANCE_DIRECTION.TakeOff);
    expect(balanceDirection("loan")).toBe(BALANCE_DIRECTION.TakeOff);
    expect(balanceDirection("investment")).toBe(BALANCE_DIRECTION.Flat);
    expect(balanceDirection("brokerage")).toBe(BALANCE_DIRECTION.Flat);
    expect(balanceDirection("something-new")).toBe(BALANCE_DIRECTION.Flat);
  });

  test("creditLimitOf prefers the limit Plaid sent, else owed + available, else null", () => {
    expect(creditLimitOf(balances(5000, 4000, 1000))).toBe(5000);
    expect(creditLimitOf(balances(5000, null, null))).toBe(5000);
    expect(creditLimitOf(balances(null, 4000, 1000))).toBe(5000);
    expect(creditLimitOf(balances(null, 4000, null))).toBeNull();
    expect(creditLimitOf(balances(null, null, 1000))).toBeNull();
    expect(creditLimitOf(balances(null, null, null))).toBeNull();
  });

  test("availableCreditOf prefers what Plaid sent, else limit - owed, else null", () => {
    expect(availableCreditOf(balances(5000, 3900, 1000))).toBe(3900);
    expect(availableCreditOf(balances(5000, null, 1000))).toBe(4000);
    expect(availableCreditOf(balances(null, null, 1000))).toBeNull();
    expect(availableCreditOf(balances(5000, null, null))).toBeNull();
    expect(availableCreditOf(balances(null, 0, null))).toBe(0);
  });

  test("the derived amounts are rounded to Plaid's four decimals", () => {
    expect(creditLimitOf(balances(null, 0.1, 0.2))).toBe(0.3);
    expect(availableCreditOf(balances(0.3, null, 0.1))).toBe(0.2);
  });
});
