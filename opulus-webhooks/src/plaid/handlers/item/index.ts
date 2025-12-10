import type { PlaidWebhookEvent } from "@/types/plaid/webhookSchema";

/**
 * Handle ITEM webhook events
 */
export async function handleItemWebhook(
  webhook_code: string,
  event: PlaidWebhookEvent,
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
      console.log(`Unhandled ITEM webhook code: ${webhook_code}`);
  }
}
