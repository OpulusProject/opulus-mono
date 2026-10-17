import type { PlaidWebhookEvent } from "@/types/plaid/webhookSchema";
import {
  AppError,
  itemRepository,
  logger,
  syncItemHoldings,
} from "@opulus/core";

/**
 * Handle HOLDINGS DEFAULT_UPDATE webhook events: Plaid found new or changed
 * holdings on an item. Fetch the item's current holdings and store them in
 * place of the old ones.
 * https://plaid.com/docs/api/products/investments/#holdings-default_update
 */
export async function syncHoldingsHandler(
  event: PlaidWebhookEvent
): Promise<void> {
  if (!event.item_id) {
    throw new AppError("item_id is required for HOLDINGS webhook", 400);
  }

  const item = await itemRepository.getByPlaidItemId(event.item_id);
  const result = await syncItemHoldings({ item });

  logger.info(
    {
      item_id: item.id,
      plaid_item_id: event.item_id,
      new_holdings: event.new_holdings,
      updated_holdings: event.updated_holdings,
      ...result,
    },
    "Holdings synced from DEFAULT_UPDATE webhook"
  );
}
