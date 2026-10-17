import type { PlaidWebhookEvent } from "@/types/plaid/webhookSchema";
import { syncRecurringHandler } from "./syncRecurringHandler.js";
import { syncTransactionsHandler } from "./syncTransactionsHandler.js";
import { logger } from "@opulus/core";

/**
 * Handle TRANSACTIONS webhook events
 */
export async function handleTransactionsWebhook(
  webhook_code: string,
  event: PlaidWebhookEvent
): Promise<void> {
  switch (webhook_code) {
    case "INITIAL_UPDATE":
    case "SYNC_UPDATES_AVAILABLE":
      await syncTransactionsHandler(event);
      break;
    case "RECURRING_TRANSACTIONS_UPDATE":
      await syncRecurringHandler(event);
      break;
    case "TRANSACTIONS_REMOVED":
      // handled by SYNC_UPDATES_AVAILABLE
      break;
    default:
      logger.warn(
        {
          webhook_code: event.webhook_code,
          webhook_type: event.webhook_type,
          item_id: event.item_id,
        },
        "Unhandled TRANSACTIONS webhook code"
      );
      break;
  }
}
