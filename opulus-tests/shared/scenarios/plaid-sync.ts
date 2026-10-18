import { uniqueId } from "../client.js";
import type { Plaid, Transaction } from "../plaid-stub.js";

/** A transaction in Plaid's shape, as `/transactions/sync` returns it. */
export function plaidTransaction(accountId: string, overrides: Plaid<Transaction> = {}): Plaid<Transaction> & { transaction_id: string } {
  return {
    transaction_id: uniqueId("txn"),
    account_id: accountId,
    amount: 12.5,
    iso_currency_code: "CAD",
    unofficial_currency_code: null,
    date: "2026-10-10",
    authorized_date: null,
    name: "Coffee Shop",
    merchant_name: "Coffee Shop",
    pending: false,
    payment_channel: "in store",
    personal_finance_category: { primary: "FOOD_AND_DRINK", detailed: "FOOD_AND_DRINK_COFFEE" },
    ...overrides,
  };
}
