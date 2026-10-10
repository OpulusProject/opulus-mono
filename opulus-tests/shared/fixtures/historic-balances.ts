import { testDb } from "../db.js";

/**
 * Historic balance fixtures.
 *
 * Historic balances have NO create endpoint (the webhooks service writes them),
 * so they are seeded directly into the ISOLATED test DB (see helpers/db.ts)
 * against an account previously created via seedItemWithAccount. Verification
 * happens over HTTP, through the net worth history endpoint.
 */

export interface SeedHistoricBalance {
  /** The day the balance closed, "YYYY-MM-DD". */
  date: string;
  balanceCurrent: number;
}

/** Seed closing balances for one of a user's seeded accounts. */
export async function seedHistoricBalances(params: {
  userId: string;
  accountId: string;
  isoCurrencyCode?: string | null;
  balances: SeedHistoricBalance[];
}): Promise<void> {
  await testDb().accountHistoricBalance.createMany({
    data: params.balances.map((balance) => ({
      accountId: params.accountId,
      userId: params.userId,
      date: new Date(`${balance.date}T00:00:00Z`),
      balanceCurrent: balance.balanceCurrent,
      isoCurrencyCode: params.isoCurrencyCode ?? "CAD",
    })),
  });
}

/**
 * Reads, for a spec that has no other way to see the table.
 *
 * A spec that must check the stored rows themselves, one account and one day at
 * a time (the receiver's backfill spec), reads them here. That is an exception
 * to "verify over HTTP", used where the HTTP view (the net worth sums accounts)
 * is too coarse; specs of the endpoint itself read over HTTP.
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
