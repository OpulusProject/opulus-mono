import { itemService, UnauthorizedError } from "@opulus/core";

/**
 * Get an item, checking that it belongs to the user.
 *
 * This is where "can this user touch this item" is decided, so a use case that
 * acts on an item calls it first instead of each controller checking.
 *
 * @throws NotFoundError if there is no such item
 * @throws UnauthorizedError if the item belongs to another user
 */
export async function getOwnedItem(params: { userId: string; itemId: string }) {
  const item = await itemService.getById(params.itemId);
  if (item.userId !== params.userId) {
    throw new UnauthorizedError("You do not have access to this item");
  }
  return item;
}

/**
 * Like `getOwnedItem`, for callers that identify the item by Plaid's item id.
 */
export async function getOwnedItemByPlaidItemId(params: {
  userId: string;
  plaidItemId: string;
}) {
  const item = await itemService.getByPlaidItemId(params.plaidItemId);
  if (item.userId !== params.userId) {
    throw new UnauthorizedError("You do not have access to this item");
  }
  return item;
}
