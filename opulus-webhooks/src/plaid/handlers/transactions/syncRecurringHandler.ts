import type { PlaidWebhookEvent } from "@/types/plaid/webhookSchema";
import {
  AppError,
  itemRepository,
  logger,
  syncItemRecurring,
} from "@opulus/core";

/**
 * Handle TRANSACTIONS RECURRING_TRANSACTIONS_UPDATE webhook events: Plaid has
 * found, or changed, an item's recurring payments and income. Fetch the item's
 * current streams and store them in place of the old ones.
 * https://plaid.com/docs/api/products/transactions/#recurring_transactions_update
 */
export async function syncRecurringHandler(
  event: PlaidWebhookEvent
): Promise<void> {
  if (!event.item_id) {
    throw new AppError(
      "item_id is required for RECURRING_TRANSACTIONS_UPDATE webhook",
      400
    );
  }

  const item = await itemRepository.getByPlaidItemId(event.item_id);
  const result = await syncItemRecurring({ item });

  logger.info(
    {
      item_id: item.id,
      plaid_item_id: event.item_id,
      account_ids: event.account_ids,
      ...result,
    },
    "Recurring transactions synced from RECURRING_TRANSACTIONS_UPDATE webhook"
  );
}
