import { testDb } from "../db.js";

/**
 * Holding fixtures.
 *
 * Holdings are written by the sync and read through the API; the sync specs read
 * what it stored from the ISOLATED test DB, the exception to "verify over HTTP"
 * for the endpoint that has no read side yet (the API that shows them is a
 * separate PR).
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

/** Put a holding straight into the store, for specs about what a sync leaves alone. */
export async function seedHolding(params: {
  userId: string;
  itemId: string;
  accountId: string;
  plaidSecurityId: string;
  tickerSymbol?: string;
  quantity?: number;
}) {
  const db = testDb();
  const security = await db.security.upsert({
    where: { plaidSecurityId: params.plaidSecurityId },
    create: {
      plaidSecurityId: params.plaidSecurityId,
      tickerSymbol: params.tickerSymbol ?? "OLD",
      name: "Seeded security",
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
      institutionPrice: 10,
      institutionValue: 10,
      syncedAt: new Date(),
    },
  });
}
