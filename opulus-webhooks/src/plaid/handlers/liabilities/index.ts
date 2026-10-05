import type { PlaidWebhookEvent } from "@/types/plaid/webhookSchema";
import { AppError, itemService, liabilityService, logger } from "@opulus/core";

/**
 * Handle LIABILITIES webhook events
 */
export async function handleLiabilitiesWebhook(
  webhook_code: string,
  event: PlaidWebhookEvent
): Promise<void> {
  switch (webhook_code) {
    case "DEFAULT_UPDATE": {
      if (!event.item_id) {
        throw new AppError("item_id is required for LIABILITIES webhook", 400);
      }

      const item = await itemService.getByPlaidItemId(event.item_id);
      const result = await liabilityService.syncForItem(item);
      logger.info(
        { item_id: item.id, plaid_item_id: event.item_id, ...result },
        "Liabilities synced from webhook"
      );
      break;
    }
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
