import { uniqueId } from "../client.js";
import { testDb } from "../db.js";

/**
 * Transaction fixtures.
 *
 * Transactions have NO create endpoint (Plaid sync path only), so they are
 * seeded directly into the ISOLATED test DB (see helpers/db.ts) against an item
 * previously created via seedItemWithAccount. Verification happens over HTTP.
 */

/**
 * Seed `count` transactions for a user's seeded item/account. Returns the
 * transaction names so a follow-up API read can assert on exactly what it made.
 */
export async function seedTransactions(
  params: { userId: string; itemId: string; accountId: string; count?: number },
): Promise<{ names: string[]; count: number }> {
  const db = testDb();
  const count = params.count ?? 3;
  const names: string[] = [];

  const data = Array.from({ length: count }, (_, i) => {
    const name = uniqueId(`txn_${i}`);
    names.push(name);
    return {
      providerTransactionId: uniqueId("ptxn"),
      accountId: params.accountId,
      itemId: params.itemId,
      userId: params.userId,
      amount: 12.34 + i,
      date: new Date("2026-01-0" + ((i % 9) + 1)),
      name,
      category: ["Food and Drink"],
      pending: false,
      isoCurrencyCode: "CAD",
    };
  });

  await db.transaction.createMany({ data });
  return { names, count };
}
