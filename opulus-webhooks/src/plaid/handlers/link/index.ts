import type { PlaidWebhookEvent } from "@/types/plaid/webhookSchema";
import { createItemHandler } from "./createItemHandler";

/**
 * Handle ITEM webhook events
 */
export async function handleLinkWebhook(
  webhook_code: string,
  event: PlaidWebhookEvent
): Promise<void> {
  switch (webhook_code) {
    case "ITEM_ADD_RESULT": {
      await createItemHandler(event);
      break;
    }
    default:
      console.log(`Unhandled LINK webhook code: ${webhook_code}`);
  }
}
