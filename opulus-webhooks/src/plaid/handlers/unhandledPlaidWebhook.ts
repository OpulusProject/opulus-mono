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

  console.log(
    `UNHANDLED ${webhook_type} WEBHOOK: ${webhook_code}: Plaid item id ${plaidItemId || "N/A"}`,
  );
}

