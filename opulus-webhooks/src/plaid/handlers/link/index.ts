import type { PlaidWebhookEvent } from "@/types/plaid/webhookSchema";
import { logger } from "@opulus/core";
import { createItemHandler } from "./createItemHandler.js";

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
    case "SESSION_FINISHED": {
      // since we're updating our db after every item add result, we don't need to do anything here
      break;
    }
    default:
      logger.warn(
        {
          webhook_code: event.webhook_code,
          webhook_type: event.webhook_type,
          item_id: event.item_id,
        },
        "Unhandled LINK webhook code"
      );
      break;
  }
}
