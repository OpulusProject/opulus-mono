import { testDb } from "../db.js";

/**
 * Exchange rate fixtures. `exchange_rate` is shared by every user (it is not
 * per user), so a spec cannot namespace its rows with `uniqueId`: specs that
 * use it clear or seed it themselves and run serially in their own database.
 */

export interface StoredExchangeRate {
  /** "YYYY-MM-DD". */
  date: string;
  currency: string;
  perEur: number;
  source: string;
}

/** Empty the table, so a spec starts from a known state. */
export async function clearExchangeRates(): Promise<void> {
  await testDb().exchangeRate.deleteMany({});
}

/** Remove the rates of every day from `day` on, as if those runs never happened. */
export async function deleteExchangeRatesFrom(day: string): Promise<number> {
  const result = await testDb().exchangeRate.deleteMany({
    where: { date: { gte: new Date(`${day}T00:00:00Z`) } },
  });
  return result.count;
}

/**
 * Reads, for the scheduler specs. A job has no response beyond its result, so what
 * it stored is checked in the table itself: the exception to "verify over
 * HTTP" for jobs. Oldest first, then by currency.
 */
export async function readExchangeRates(): Promise<StoredExchangeRate[]> {
  const rows = await testDb().exchangeRate.findMany({
    orderBy: [{ date: "asc" }, { currency: "asc" }],
  });
  return rows.map((row) => ({
    date: row.date.toISOString().slice(0, 10),
    currency: row.currency,
    perEur: row.perEur.toNumber(),
    source: row.source,
  }));
}
