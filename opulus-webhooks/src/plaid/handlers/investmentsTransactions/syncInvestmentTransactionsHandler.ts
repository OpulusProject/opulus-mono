import type { PlaidWebhookEvent } from "@/types/plaid/webhookSchema";
import {
  AppError,
  itemRepository,
  logger,
  syncItemInvestmentTransactions,
} from "@opulus/core";

/**
 * Handle INVESTMENTS_TRANSACTIONS DEFAULT_UPDATE and HISTORICAL_UPDATE webhook
 * events: Plaid found new investment transactions on an item (DEFAULT_UPDATE),
 * or finished extracting the item's full history after it was linked
 * (HISTORICAL_UPDATE). Either way, read the period since the last sync again and
 * store it in place of what was there.
 * https://plaid.com/docs/api/products/investments/#investments_transactions-default_update
 */
export async function syncInvestmentTransactionsHandler(
  event: PlaidWebhookEvent
): Promise<void> {
  if (!event.item_id) {
    throw new AppError(
      "item_id is required for INVESTMENTS_TRANSACTIONS webhook",
      400
    );
  }

  const item = await itemRepository.getByPlaidItemId(event.item_id);
  const result = await syncItemInvestmentTransactions({ item });

  logger.info(
    {
      item_id: item.id,
      plaid_item_id: event.item_id,
      webhook_code: event.webhook_code,
      new_investments_transactions: event.new_investments_transactions,
      ...result,
    },
    "Investment transactions synced from webhook"
  );
}
