import type { PlaidWebhookEvent } from "@/types/plaid/webhookSchema";
import {
  recordItemStatus,
  type ItemStatusWebhookCode,
} from "@/services/recordItemStatus.js";
import { AppError, logger, NotFoundError } from "@opulus/core";

/**
 * Handle ITEM webhooks that change an item's connection status: read the
 * event and hand it to `recordItemStatus`.
 */
export async function updateItemStatusHandler(
  event: PlaidWebhookEvent,
  webhookCode: ItemStatusWebhookCode
): Promise<void> {
  if (!event.item_id) {
    throw new AppError("item_id is required for ITEM webhook", 400);
  }

  try {
    await recordItemStatus({
      plaidItemId: event.item_id,
      webhookCode,
      error: event.error,
      consentExpirationTime: event.consent_expiration_time,
      disconnectTime: event.disconnect_time,
      reason: event.reason,
    });
  } catch (error) {
    // The user may have disconnected the item before the webhook arrived;
    // retrying would never find it.
    if (error instanceof NotFoundError) {
      logger.warn(
        { plaid_item_id: event.item_id, webhook_code: webhookCode },
        "ITEM webhook for an item we no longer have; ignoring"
      );
      return;
    }
    throw error;
  }
}
