import { testDb } from "../db.js";

/**
 * Security price fixtures. `security` and `security_price` are shared by every
 * user, so a spec namespaces its securities with a unique Plaid security id (and
 * ticker) and asserts only on those.
 */

/** A security with no holder; its history is fetched or not as `backfilled` says. */
export async function seedSecurity(params: {
  plaidSecurityId: string;
  tickerSymbol: string | null;
  marketIdentifierCode?: string | null;
  type?: string;
  isCashEquivalent?: boolean;
  isoCurrencyCode?: string | null;
  /** Its history has been fetched (not yet, by default). */
  backfilled?: boolean;
}) {
  return testDb().security.create({
    data: {
      plaidSecurityId: params.plaidSecurityId,
      tickerSymbol: params.tickerSymbol,
      name: params.tickerSymbol ?? "Seeded security",
      marketIdentifierCode: params.marketIdentifierCode ?? null,
      type: params.type ?? "etf",
      isCashEquivalent: params.isCashEquivalent ?? false,
      isoCurrencyCode: params.isoCurrencyCode ?? "CAD",
      priceBackfilledAt: params.backfilled ? new Date() : null,
    },
  });
}

/** Store a close for a day by hand. */
export async function seedSecurityPrice(params: {
  securityId: string;
  /** "YYYY-MM-DD". */
  date: string;
  close: number;
  currency?: string;
}) {
  const date = new Date(`${params.date}T00:00:00Z`);
  return testDb().securityPrice.create({
    data: {
      securityId: params.securityId,
      date,
      close: params.close,
      currency: params.currency ?? "CAD",
      source: "seed",
      asOf: date,
    },
  });
}

/** When a security's history was fetched; null if it has not been. */
export async function readBackfilledAt(securityId: string): Promise<Date | null> {
  const { priceBackfilledAt } = await testDb().security.findUniqueOrThrow({
    where: { id: securityId },
    select: { priceBackfilledAt: true },
  });
  return priceBackfilledAt;
}

/** A security's stored prices, oldest day first, with the close as a number and the day as "YYYY-MM-DD". */
export async function readSecurityPrices(securityId: string) {
  const rows = await testDb().securityPrice.findMany({
    where: { securityId },
    orderBy: { date: "asc" },
  });
  return rows.map((row) => ({
    date: row.date.toISOString().slice(0, 10),
    close: Number(row.close),
    currency: row.currency,
    source: row.source,
    asOf: row.asOf,
  }));
}
