import { testDb } from "../db.js";

/**
 * Historic balance reads, for a spec that has no other way to see the table.
 *
 * Historic balances are written by the webhooks service's sync (no create
 * endpoint) and are read through the net worth endpoint, which sums accounts.
 * A spec that must check the rows themselves, one account and one day at a
 * time, reads them here. That is an exception to "verify over HTTP", used where
 * the HTTP view is too coarse; specs of the endpoint itself read over HTTP.
 */
export interface StoredHistoricBalance {
  accountId: string;
  userId: string;
  /** The day it closed, "YYYY-MM-DD". */
  date: string;
  balanceCurrent: number;
  isoCurrencyCode: string | null;
  createdAt: Date;
}

/** Every historic balance of an item's accounts, oldest day first. */
export async function readHistoricBalances(
  itemId: string,
): Promise<StoredHistoricBalance[]> {
  const rows = await testDb().accountHistoricBalance.findMany({
    where: { account: { itemId } },
    orderBy: [{ accountId: "asc" }, { date: "asc" }],
  });
  return rows.map((row) => ({
    accountId: row.accountId,
    userId: row.userId,
    date: row.date.toISOString().slice(0, 10),
    balanceCurrent: row.balanceCurrent.toNumber(),
    isoCurrencyCode: row.isoCurrencyCode,
    createdAt: row.createdAt,
  }));
}
