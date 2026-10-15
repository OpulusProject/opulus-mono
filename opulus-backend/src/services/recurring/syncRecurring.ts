import { syncItemRecurring, type SyncRecurringResult } from "@opulus/core";

import { getItem } from "../items/getItem.js";

export interface SyncRecurringParams {
  userId: string;
  /** Our item id. */
  itemId: string;
}

/**
 * Pull the recurring payments and income Plaid found for one of the user's
 * items and store them, replacing what was stored.
 *
 * @throws NotFoundError if there is no such item
 * @throws UnauthorizedError if the item belongs to another user
 * @throws AppError if Plaid or the database fails unexpectedly
 */
export async function syncRecurring(
  params: SyncRecurringParams
): Promise<SyncRecurringResult> {
  const item = await getItem(params);

  return syncItemRecurring({ item });
}
