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

/** Put an investment transaction straight into the store, for specs that read activity. */
export async function seedInvestmentTransaction(params: {
  userId: string;
  itemId: string;
  accountId: string;
  /** Plaid's type: buy, sell, cash, fee, transfer, cancel. */
  type: string;
  subtype?: string | null;
  /** Plaid's sign: money out of the account is positive. */
  amount: number;
  /** "YYYY-MM-DD" (UTC); today by default. */
  date?: string;
  name?: string;
  tickerSymbol?: string;
  quantity?: number;
  price?: number;
  fees?: number | null;
  currency?: string | null;
}) {
  const db = testDb();
  const security = params.tickerSymbol
    ? await db.security.create({
        data: {
          plaidSecurityId: `sec_${Math.random().toString(36).slice(2)}`,
          tickerSymbol: params.tickerSymbol,
          name: `${params.tickerSymbol} Inc.`,
          type: "equity",
        },
      })
    : null;
  return db.investmentTransaction.create({
    data: {
      plaidInvestmentTransactionId: `it_${Math.random().toString(36).slice(2)}`,
      accountId: params.accountId,
      itemId: params.itemId,
      userId: params.userId,
      securityId: security?.id ?? null,
      date: new Date(`${params.date ?? new Date().toISOString().slice(0, 10)}T00:00:00Z`),
      name: params.name ?? params.type,
      type: params.type,
      subtype: params.subtype ?? null,
      quantity: params.quantity ?? null,
      price: params.price ?? null,
      amount: params.amount,
      fees: params.fees ?? null,
      isoCurrencyCode: params.currency === undefined ? "CAD" : params.currency,
    },
  });
}
