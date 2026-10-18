import { expect, test } from "@playwright/test";
import {
  normalizePlaidAccount,
  normalizePlaidBalances,
  normalizePlaidItem,
  normalizePlaidTransaction,
} from "@opulus/core";

const asArg = <T extends (...args: never[]) => unknown>(value: unknown) => value as Parameters<T>[0];

/**
 * Plaid's accounts, items and transactions as we keep them
 * (opulus-core/src/repositories/{account,item,transaction}Repository.ts).
 *
 * Only what is not a plain copy of a field is pinned here: what becomes null,
 * what is flattened or dropped, and what is kept only when it holds something.
 *
 * Test cases:
 * - an account without its optional fields has nulls for them
 * - normalizePlaidBalances keeps the four balance columns only, with null for a missing one
 * - an item's error is flattened into columns, and its consent expiry becomes a date
 * - an item without an institution, an error or a consent expiry has nulls for them
 * - a transaction's dates become dates and its category is flattened
 * - a transaction's location and payment details are kept only when they hold something
 * - a transaction with no pending flag is not pending, and a missing amount is zero
 */
test.describe("Plaid normalizers", () => {
  test("an account without its optional fields has nulls for them", () => {
    const bare = asArg<typeof normalizePlaidAccount>({ account_id: "a", name: "A", type: "other", balances: {} });

    expect(normalizePlaidAccount(bare, "i", "u")).toMatchObject({
      providerAccountId: "a",
      itemId: "i",
      userId: "u",
      persistentAccountId: null,
      officialName: null,
      subtype: null,
      mask: null,
      balanceCurrent: null,
      isoCurrencyCode: null,
    });
  });

  test("normalizePlaidBalances keeps the four balance columns only, with null for a missing one", () => {
    const account = asArg<typeof normalizePlaidBalances>({
      account_id: "acct",
      name: "ignored",
      balances: { current: 5, iso_currency_code: "USD" },
    });

    expect(normalizePlaidBalances(account)).toEqual({
      balanceAvailable: null,
      balanceCurrent: 5,
      balanceLimit: null,
      isoCurrencyCode: "USD",
      unofficialCurrencyCode: null,
    });
  });

  test("an item's error is flattened into columns, and its consent expiry becomes a date", () => {
    const item = asArg<typeof normalizePlaidItem>({
      item_id: "plaid-item",
      error: { error_type: "ITEM_ERROR", error_code: "ITEM_LOGIN_REQUIRED", error_message: "login required", display_message: null },
      available_products: [],
      billed_products: ["transactions"],
      consent_expiration_time: "2026-12-01T00:00:00Z",
    });

    expect(normalizePlaidItem(item, "user-1", "access-token", { name: "Stub Bank" })).toMatchObject({
      institutionName: "Stub Bank",
      errorType: "ITEM_ERROR",
      errorCode: "ITEM_LOGIN_REQUIRED",
      errorMessage: "login required",
      displayMessage: null,
      billedProducts: ["transactions"],
      consentExpirationTime: new Date("2026-12-01T00:00:00Z"),
    });
  });

  test("an item without an institution, an error or a consent expiry has nulls for them", () => {
    const item = asArg<typeof normalizePlaidItem>({ item_id: "plaid-item", available_products: [], billed_products: [], error: null });

    expect(normalizePlaidItem(item, "user-1", "tok", null)).toMatchObject({
      institutionId: null,
      institutionName: null,
      institutionColor: null,
      institutionLogo: null,
      webhook: null,
      errorType: null,
      errorCode: null,
      errorMessage: null,
      displayMessage: null,
      consentExpirationTime: null,
    });
  });

  test("a transaction's dates become dates and its category is flattened", () => {
    const transaction = asArg<typeof normalizePlaidTransaction>({
      transaction_id: "txn-1",
      amount: 12.5,
      date: "2026-10-10",
      authorized_date: "2026-10-09",
      name: "COFFEE SHOP 123",
      personal_finance_category: { primary: "FOOD_AND_DRINK", detailed: "FOOD_AND_DRINK_COFFEE" },
    });

    expect(normalizePlaidTransaction(transaction, "acct-1", "item-1", "user-1")).toMatchObject({
      providerTransactionId: "txn-1",
      date: new Date("2026-10-10"),
      authorizedDate: new Date("2026-10-09"),
      categoryPrimary: "FOOD_AND_DRINK",
      categoryDetailed: "FOOD_AND_DRINK_COFFEE",
    });
  });

  test("a transaction's location and payment details are kept only when they hold something", () => {
    const normalize = (extra: Record<string, unknown>) =>
      normalizePlaidTransaction(
        asArg<typeof normalizePlaidTransaction>({ transaction_id: "t", date: "2026-10-10", name: "N", amount: 1, ...extra }),
        "a",
        "i",
        "u",
      );

    expect(normalize({ location: { city: "Toronto", region: null }, payment_meta: { reference_number: "r1" } })).toMatchObject({
      location: { city: "Toronto", region: null },
      paymentMeta: { reference_number: "r1" },
    });
    expect(normalize({ location: { city: null, region: null }, payment_meta: {} })).toMatchObject({ location: null, paymentMeta: null });
    expect(normalize({})).toMatchObject({ location: null, paymentMeta: null });
  });

  test("a transaction with no pending flag is not pending, and a missing amount is zero", () => {
    const transaction = asArg<typeof normalizePlaidTransaction>({ transaction_id: "t", date: "2026-10-10", name: "N" });

    expect(normalizePlaidTransaction(transaction, "a", "i", "u")).toMatchObject({
      pending: false,
      amount: 0,
      authorizedDate: null,
      merchantName: null,
      categoryPrimary: null,
    });
  });
});
