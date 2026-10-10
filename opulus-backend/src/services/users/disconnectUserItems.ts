import { itemRepository, logger, plaidGateway } from "@opulus/core";

import { getItem } from "../items/getItem.js";

export interface DisconnectUserItemsParams {
  userId: string;
}

export interface DisconnectUserItemsResult {
  /** Items the user had. */
  total: number;
  /** Items Plaid confirmed removed (or no longer knew about). */
  removed: number;
  /** Items Plaid could not remove; they stay connected on Plaid's side. */
  failed: number;
}

/**
 * Remove every one of the user's items from Plaid. Run when the user deletes
 * their account, before the rows go, so Plaid stops serving the connections.
 *
 * It never throws because of Plaid: the user's right to delete their data must
 * not depend on Plaid being up. Each item is attempted, a failure is logged (ids
 * and the error kind only, never the access token) and counted in the result,
 * and the caller carries on deleting locally. An item that failed stays
 * connected on Plaid's side until it is removed from the Plaid dashboard.
 */
export async function disconnectUserItems(
  params: DisconnectUserItemsParams
): Promise<DisconnectUserItemsResult> {
  const items = await itemRepository.getAllByUserId(params.userId);

  const outcomes = await Promise.all(
    items.map(async (listed) => {
      try {
        const item = await getItem({
          userId: params.userId,
          itemId: listed.id,
        });
        await plaidGateway.removeItem(item.accessToken);
        return true;
      } catch (error) {
        logger.error(
          {
            user_id: params.userId,
            item_id: listed.id,
            error_name: error instanceof Error ? error.name : "unknown",
          },
          "Could not remove item from Plaid while deleting account; deleting locally anyway"
        );
        return false;
      }
    })
  );

  const removed = outcomes.filter(Boolean).length;
  return {
    total: items.length,
    removed,
    failed: items.length - removed,
  };
}
