import type { PlaidWebhookEvent } from "@/types/plaid/webhookSchema";
import { logger } from "@opulus/core";
import { syncHoldingsHandler } from "./syncHoldingsHandler.js";

/**
 * Handle HOLDINGS webhook events
 */
export async function handleHoldingsWebhook(
  webhook_code: string,
  event: PlaidWebhookEvent
): Promise<void> {
  switch (webhook_code) {
    case "DEFAULT_UPDATE":
      await syncHoldingsHandler(event);
      break;
    default:
      logger.warn(
        {
          webhook_code: event.webhook_code,
          webhook_type: event.webhook_type,
          item_id: event.item_id,
        },
        "Unhandled HOLDINGS webhook code"
      );
      break;
  }
}
