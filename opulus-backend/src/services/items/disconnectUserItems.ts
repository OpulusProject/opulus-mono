import { AppError, itemRepository, logger, plaidGateway } from "@opulus/core";

export interface DisconnectUserItemsParams {
  userId: string;
}

/**
 * Remove every one of a user's items from Plaid, so deleting the user does not
 * leave live connections (and their access tokens) behind. Only Plaid is
 * touched: the rows go with the user, which every table cascades from.
 *
 * Every item is tried even if one fails, and an item Plaid no longer knows is
 * counted as removed, so after a partial failure the call can simply be made
 * again. If any item could not be removed this throws and the user must not be
 * deleted: their tokens would be unreachable afterwards.
 *
 * @throws AppError (502, PLAID_DISCONNECT_FAILED) if Plaid refused any item
 */
export async function disconnectUserItems(
  params: DisconnectUserItemsParams
): Promise<void> {
  const items = await itemRepository.getAllByUserId(params.userId);

  const results = await Promise.allSettled(
    items.map((item) => plaidGateway.removeItem(item.accessToken))
  );

  const failed = results.flatMap((result, index) =>
    result.status === "rejected" ? [index] : []
  );
  if (failed.length === 0) return;

  logger.error(
    {
      user_id: params.userId,
      failed_item_ids: failed.map((index) => items[index]!.id),
      total_items: items.length,
    },
    "Could not remove all of a user's items from Plaid"
  );
  throw new AppError(
    `Could not disconnect ${failed.length} of your ${items.length} bank connections. Nothing was deleted; try again.`,
    502,
    "PLAID_DISCONNECT_FAILED"
  );
}
