import { itemRepository, UnauthorizedError } from "@opulus/core";

/**
 * Get one of the user's items.
 *
 * Fetching an item always means fetching the user's own, so the ownership check
 * lives here: "can this user touch this item" is decided in one place, and a
 * use case that acts on an item calls this instead of each controller checking.
 *
 * @throws NotFoundError if there is no such item
 * @throws UnauthorizedError if the item belongs to another user
 */
export async function getItem(params: { userId: string; itemId: string }) {
  const item = await itemRepository.getById(params.itemId);
  if (item.userId !== params.userId) {
    throw new UnauthorizedError("You do not have access to this item");
  }
  return item;
}

/**
 * Like `getItem`, for callers that identify the item by Plaid's item id.
 */
export async function getItemByPlaidItemId(params: {
  userId: string;
  plaidItemId: string;
}) {
  const item = await itemRepository.getByPlaidItemId(params.plaidItemId);
  if (item.userId !== params.userId) {
    throw new UnauthorizedError("You do not have access to this item");
  }
  return item;
}
