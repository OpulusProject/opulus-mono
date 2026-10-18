import type { PlaidWebhookEvent } from "@/types/plaid/webhookSchema";
import { logger, NotFoundError } from "@opulus/core";

/**
 * Run a handler's work, and drop the webhook if the item it is about is gone.
 * The user may have disconnected the item before the webhook arrived; retrying
 * would never find it and would only leave a dead event behind.
 */
export async function skipWhenItemIsGone(
  event: PlaidWebhookEvent,
  work: () => Promise<void>
): Promise<void> {
  try {
    await work();
  } catch (error) {
    if (error instanceof NotFoundError) {
      logger.warn(
        {
          plaid_item_id: event.item_id,
          webhook_type: event.webhook_type,
          webhook_code: event.webhook_code,
        },
        "Webhook for an item we no longer have; ignoring"
      );
      return;
    }
    throw error;
  }
}
