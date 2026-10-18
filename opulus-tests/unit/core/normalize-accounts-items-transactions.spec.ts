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
 * Test cases:
 * - an account keeps its names, type, mask and balances, with null for what Plaid left out
 * - normalizePlaidBalances keeps the four balance columns only, with null for a missing one
 * - an item keeps its ids, institution, webhook, products and consent expiry, with the error flattened into columns
 * - an item without an institution, an error or a consent expiry has nulls for them
 * - a transaction keeps its amount, dates, names, category, channel and currency
 * - a transaction's location and payment details are kept only when they hold something
 * - a transaction with no pending flag is not pending, and a missing amount is zero
 */
test.describe("Plaid normalizers", () => {
  test("an account keeps its names, type, mask and balances, with null for what Plaid left out", () => {
    const account = asArg<typeof normalizePlaidAccount>({
      account_id: "acct",
      persistent_account_id: "persistent",
      name: "Chequing",
      official_name: "Everyday Chequing",
      type: "depository",
      subtype: "checking",
      mask: "0000",
      balances: { available: 90, current: 100, limit: null, iso_currency_code: "CAD", unofficial_currency_code: null },
    });

    expect(normalizePlaidAccount(account, "item-1", "user-1")).toEqual({
      providerAccountId: "acct",
      persistentAccountId: "persistent",
      itemId: "item-1",
      userId: "user-1",
      name: "Chequing",
      officialName: "Everyday Chequing",
      type: "depository",
      subtype: "checking",
      mask: "0000",
      balanceAvailable: 90,
      balanceCurrent: 100,
      balanceLimit: null,
      isoCurrencyCode: "CAD",
      unofficialCurrencyCode: null,
    });

    const bare = asArg<typeof normalizePlaidAccount>({ account_id: "a", name: "A", type: "other", balances: {} });
    expect(normalizePlaidAccount(bare, "i", "u")).toMatchObject({
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

  test("an item keeps its ids, institution, webhook, products and consent expiry, with the error flattened into columns", () => {
    const item = asArg<typeof normalizePlaidItem>({
      item_id: "plaid-item",
      institution_id: "ins_1",
      webhook: "https://example.test/webhook/plaid",
      error: { error_type: "ITEM_ERROR", error_code: "ITEM_LOGIN_REQUIRED", error_message: "login required", display_message: null },
      available_products: ["investments"],
      billed_products: ["transactions"],
      products: ["transactions", "liabilities"],
      update_type: "background",
      consent_expiration_time: "2026-12-01T00:00:00Z",
    });

    expect(normalizePlaidItem(item, "user-1", "access-token", { name: "Stub Bank", logo: "logo-data", primary_color: "#112233" })).toEqual({
      plaidItemId: "plaid-item",
      userId: "user-1",
      accessToken: "access-token",
      institutionId: "ins_1",
      institutionName: "Stub Bank",
      institutionColor: "#112233",
      institutionLogo: "logo-data",
      webhook: "https://example.test/webhook/plaid",
      errorType: "ITEM_ERROR",
      errorCode: "ITEM_LOGIN_REQUIRED",
      errorMessage: "login required",
      displayMessage: null,
      availableProducts: ["investments"],
      billedProducts: ["transactions"],
      products: ["transactions", "liabilities"],
      updateType: "background",
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

  test("a transaction keeps its amount, dates, names, category, channel and currency", () => {
    const transaction = asArg<typeof normalizePlaidTransaction>({
      transaction_id: "txn-1",
      amount: 12.5,
      date: "2026-10-10",
      authorized_date: "2026-10-09",
      name: "COFFEE SHOP 123",
      merchant_name: "Coffee Shop",
      personal_finance_category: { primary: "FOOD_AND_DRINK", detailed: "FOOD_AND_DRINK_COFFEE" },
      payment_channel: "in store",
      iso_currency_code: "CAD",
      pending: true,
      pending_transaction_id: "txn-0",
    });

    expect(normalizePlaidTransaction(transaction, "acct-1", "item-1", "user-1")).toMatchObject({
      providerTransactionId: "txn-1",
      accountId: "acct-1",
      itemId: "item-1",
      userId: "user-1",
      amount: 12.5,
      date: new Date("2026-10-10"),
      authorizedDate: new Date("2026-10-09"),
      name: "COFFEE SHOP 123",
      merchantName: "Coffee Shop",
      categoryPrimary: "FOOD_AND_DRINK",
      categoryDetailed: "FOOD_AND_DRINK_COFFEE",
      paymentChannel: "in store",
      isoCurrencyCode: "CAD",
      unofficialCurrencyCode: null,
      pending: true,
      pendingTransactionId: "txn-0",
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
