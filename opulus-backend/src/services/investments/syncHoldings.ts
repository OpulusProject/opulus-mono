import { syncItemHoldings, type SyncHoldingsResult } from "@opulus/core";

import { getItem } from "../items/getItem.js";

export interface SyncHoldingsParams {
  userId: string;
  /** Our item id. */
  itemId: string;
}

/**
 * Pull one of the user's items' current holdings from Plaid and store them.
 * Plaid's data is as fresh as its last pull from the institution (usually about
 * daily), so this does not make an institution update; it takes what Plaid
 * already has.
 *
 * @throws NotFoundError if there is no such item
 * @throws UnauthorizedError if the item belongs to another user
 * @throws AppError if Plaid or the database fails unexpectedly
 */
export async function syncHoldings(
  params: SyncHoldingsParams
): Promise<SyncHoldingsResult> {
  const item = await getItem(params);

  return syncItemHoldings({ item });
}
