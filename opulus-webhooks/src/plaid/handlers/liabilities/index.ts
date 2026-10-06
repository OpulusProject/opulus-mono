import type { PlaidWebhookEvent } from "@/types/plaid/webhookSchema";
import { logger } from "@opulus/core";
import { syncLiabilitiesHandler } from "./syncLiabilitiesHandler.js";

/**
 * Handle LIABILITIES webhook events
 */
export async function handleLiabilitiesWebhook(
  webhook_code: string,
  event: PlaidWebhookEvent
): Promise<void> {
  switch (webhook_code) {
    case "DEFAULT_UPDATE":
      await syncLiabilitiesHandler(event);
      break;
    default:
      logger.warn(
        {
          webhook_code: event.webhook_code,
          webhook_type: event.webhook_type,
          item_id: event.item_id,
        },
        "Unhandled LIABILITIES webhook code"
      );
      break;
  }
}
