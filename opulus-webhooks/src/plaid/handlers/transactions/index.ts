import type { PlaidWebhookEvent } from "@/types/plaid/webhookSchema";
import { syncTransactionsHandler } from "./syncTransactionsHandler.js";

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
    case "TRANSACTIONS_REMOVED":
      // handled by SYNC_UPDATES_AVAILABLE
      break;
    default:
      console.log(`Unhandled TRANSACTIONS webhook code: ${webhook_code}`);
  }
}
