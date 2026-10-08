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
 * Seed transactions for a user's seeded item/account. Returns the transaction
 * names so a follow-up API read can assert on exactly what it made.
 *
 * Pass `dates` to choose each transaction's date (one transaction per date, and
 * `names[i]` belongs to `dates[i]`), for tests about filtering or ordering by
 * date. Otherwise `count` transactions get dates in the first nine days of
 * January 2026.
 */
export async function seedTransactions(
  params: {
    userId: string;
    itemId: string;
    accountId: string;
    count?: number;
    dates?: Date[];
  },
): Promise<{ names: string[]; count: number }> {
  const db = testDb();
  const count = params.dates?.length ?? params.count ?? 3;
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
      date: params.dates?.[i] ?? new Date("2026-01-0" + ((i % 9) + 1)),
      name,
      category: ["Food and Drink"],
      pending: false,
      isoCurrencyCode: "CAD",
    };
  });

  await db.transaction.createMany({ data });
  return { names, count };
}
