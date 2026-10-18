import { testDb } from "../db.js";

/**
 * Investment transaction fixtures.
 *
 * Written by the sync that runs when an institution is linked or updated, and by
 * the INVESTMENTS_TRANSACTIONS webhook; the specs read what it stored from the
 * ISOLATED test DB, as for holdings (the API that shows them is a separate PR).
 */

/** An item's investment transactions with their securities, oldest first (ties by Plaid id). */
export async function readInvestmentTransactions(itemId: string) {
  return testDb().investmentTransaction.findMany({
    where: { itemId },
    include: { security: true },
    orderBy: [{ date: "asc" }, { plaidInvestmentTransactionId: "asc" }],
  });
}

/** When an item's investment transactions were last synced (null: never). */
export async function readInvestmentTransactionsSyncedAt(itemId: string) {
  const item = await testDb().item.findUniqueOrThrow({ where: { id: itemId } });
  return item.investmentTransactionsSyncedAt;
}
