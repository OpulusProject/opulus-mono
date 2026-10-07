import { plaidService } from "@opulus/core";

import { getOwnedItemByPlaidItemId } from "../items/getOwnedItem.js";

export interface RefreshTransactionsParams {
  userId: string;
  /** Plaid's id for the item (not ours). */
  plaidItemId: string;
}

export interface RefreshTransactionsResult {
  /** Plaid's id for the refresh request. */
  requestId: string;
}

/**
 * Ask Plaid to fetch the newest transactions for one of the user's items.
 *
 * Plaid can take 10-30 seconds to finish, so this returns as soon as the
 * request is accepted; Plaid fires a SYNC_UPDATES_AVAILABLE webhook when the
 * refresh completes.
 *
 * @throws NotFoundError if there is no such item
 * @throws UnauthorizedError if the item belongs to another user
 */
export async function refreshTransactions(
  params: RefreshTransactionsParams
): Promise<RefreshTransactionsResult> {
  const item = await getOwnedItemByPlaidItemId(params);

  const refreshResponse = await plaidService.transactionsRefresh(
    item.accessToken
  );

  return { requestId: refreshResponse.request_id };
}
