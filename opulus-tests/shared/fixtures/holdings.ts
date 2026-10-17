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
