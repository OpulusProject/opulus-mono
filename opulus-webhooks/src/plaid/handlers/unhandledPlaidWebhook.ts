import { logger } from "@opulus/core";
import type { PlaidWebhookEvent } from "@/types/plaid/webhookSchema";

/**
 * Handle unhandled webhook types
 * Logs unhandled webhook events for monitoring and debugging
 */
export function unhandledWebhook(
  webhook_type: string,
  webhook_code: string,
  event: PlaidWebhookEvent,
): void {
  const { item_id: plaidItemId } = event;

  logger.warn(
    {
      webhook_type,
      webhook_code,
      item_id: plaidItemId,
    },
    "Unhandled webhook type"
  );
}

