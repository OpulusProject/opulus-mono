import { testDb } from "../db.js";

/**
 * Holding fixtures.
 *
 * Holdings are written by the sync that runs when an institution is linked or its
 * accounts are updated; the specs read what it stored from the ISOLATED test DB,
 * the exception to "verify over HTTP" for data that has no read side yet (the
 * API that shows them is a separate PR).
 */

/** An item's holdings with their securities, by ticker. */
export async function readHoldings(itemId: string) {
  const rows = await testDb().holding.findMany({
    where: { itemId },
    include: { security: true },
  });
  return rows.sort((a, b) =>
    (a.security.tickerSymbol ?? "").localeCompare(b.security.tickerSymbol ?? ""),
  );
}

/** How many security rows exist for a Plaid security id. */
export async function countSecurities(plaidSecurityId: string) {
  return testDb().security.count({ where: { plaidSecurityId } });
}

/** Put a holding straight into the store, for specs that read holdings or leave them alone. */
export async function seedHolding(params: {
  userId: string;
  itemId: string;
  accountId: string;
  plaidSecurityId?: string;
  tickerSymbol?: string;
  securityName?: string;
  type?: string;
  isCashEquivalent?: boolean;
  quantity?: number;
  price?: number;
  priceAsOf?: Date | null;
  value?: number;
  /** The total paid; null (the default) is "the institution sent none". */
  costBasis?: number | null;
  currency?: string | null;
}) {
  const db = testDb();
  const plaidSecurityId =
    params.plaidSecurityId ?? `sec_${Math.random().toString(36).slice(2)}`;
  const security = await db.security.upsert({
    where: { plaidSecurityId },
    create: {
      plaidSecurityId,
      tickerSymbol: params.tickerSymbol ?? "OLD",
      name: params.securityName ?? "Seeded security",
      type: params.type ?? "equity",
      isCashEquivalent: params.isCashEquivalent ?? false,
    },
    update: {},
  });
  return db.holding.create({
    data: {
      accountId: params.accountId,
      securityId: security.id,
      itemId: params.itemId,
      userId: params.userId,
      quantity: params.quantity ?? 1,
      institutionPrice: params.price ?? 10,
      institutionPriceAsOf: params.priceAsOf ?? null,
      institutionValue: params.value ?? 10,
      costBasis: params.costBasis ?? null,
      isoCurrencyCode: params.currency === undefined ? "CAD" : params.currency,
      syncedAt: new Date(),
    },
  });
}
