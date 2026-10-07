import {
  accountService,
  itemService,
  plaidService,
  prisma,
  transactionService,
} from "@opulus/core";

import { getItem } from "./getItem.js";

export interface DeleteItemParams {
  userId: string;
  itemId: string;
}

/**
 * Disconnect one of the user's items: remove it from Plaid, then delete the item
 * and everything linked to it (transactions, accounts) in one database
 * transaction.
 *
 * Plaid is called first, so if it fails nothing has been deleted; if the
 * database delete then fails, the item can be deleted again.
 *
 * @throws NotFoundError if there is no such item
 * @throws UnauthorizedError if the item belongs to another user
 */
export async function deleteItem(params: DeleteItemParams): Promise<void> {
  const item = await getItem(params);

  await plaidService.removeItem(item.accessToken);

  await prisma.$transaction(async (tx) => {
    await transactionService.deleteByItemId(item.id, tx);
    await accountService.deleteByItemId(item.id, tx);
    await itemService.delete(item.id, tx);
  });

  // TODO: record deletion of item
}
