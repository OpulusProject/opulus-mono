import type { PlaidWebhookEvent } from "@/types/plaid/webhookSchema";
import { logger } from "@opulus/core";

/**
 * Handle ITEM webhook events
 */
export async function handleItemWebhook(
  webhook_code: string,
  event: PlaidWebhookEvent
): Promise<void> {
  switch (webhook_code) {
    case "ERROR":
    case "LOGIN_REPAIRED":
    case "NEW_ACCOUNTS_AVAILABLE":
    case "PENDING_DISCONNECT":
    case "PENDING_EXPIRATION":
    case "USER_PERMISSION_REVOKED": {
      // await updateItemStatusHandler(event);
    }
    default:
      logger.warn(
        {
          webhook_code: event.webhook_code,
          webhook_type: event.webhook_type,
          item_id: event.item_id,
        },
        "Unhandled ITEM webhook code"
      );
      break;
  }
}
