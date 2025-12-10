import type { PlaidWebhookEvent } from "@/types/plaid/webhookSchema";

/**
 * Handle TRANSACTIONS webhook events
 */
export async function handleTransactionsWebhook(
  webhook_code: string,
  event: PlaidWebhookEvent,
): Promise<void> {
  switch (webhook_code) {
    case "INITIAL_UPDATE":
    case "SYNC_UPDATES_AVAILABLE":
        // await syncTransactionsHandler(event);
    default:
      console.log(`Unhandled TRANSACTIONS webhook code: ${webhook_code}`);
  }
}
