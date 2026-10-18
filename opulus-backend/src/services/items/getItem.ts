import { itemRepository, NotFoundError } from "@opulus/core";

export interface GetItemParams {
  userId: string;
  itemId: string;
}

/**
 * Get one of the user's items.
 *
 * Fetching an item always means fetching the user's own, so the ownership check
 * lives here: "can this user touch this item" is decided in one place, and a
 * use case that acts on an item calls this instead of each controller checking.
 *
 * Another user's item is answered exactly like one that does not exist, so a
 * caller cannot find out which ids are in use.
 *
 * @throws NotFoundError if there is no such item, or it belongs to another user
 */
export async function getItem(params: GetItemParams) {
  const item = await itemRepository.getById(params.itemId);
  if (item.userId !== params.userId) {
    throw new NotFoundError("Item not found");
  }
  return item;
}
