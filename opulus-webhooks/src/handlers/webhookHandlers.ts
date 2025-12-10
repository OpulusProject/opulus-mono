import { AppError } from "@opulus/core";
import type { PlaidWebhookEvent } from "../types/plaid/webhook.js";

/**
 * Handle TRANSACTIONS webhook events
 */
async function handleTransactionsWebhook(
  webhook_code: string,
  event: PlaidWebhookEvent
): Promise<void> {
  switch (webhook_code) {
    case "SYNC_UPDATES_AVAILABLE":
      // Handle sync updates available
      console.log("Sync updates available for item:", event.item_id);
      break;
    case "DEFAULT_UPDATE":
      // Handle default transaction update
      console.log("Default transaction update for item:", event.item_id);
      break;
    case "INITIAL_UPDATE":
      // Handle initial transaction update
      console.log("Initial transaction update for item:", event.item_id);
      break;
    case "HISTORICAL_UPDATE":
      // Handle historical transaction update
      console.log("Historical transaction update for item:", event.item_id);
      break;
    default:
      console.log(`Unhandled TRANSACTIONS webhook code: ${webhook_code}`);
  }
}

/**
 * Handle ITEM webhook events
 */
async function handleItemWebhook(
  webhook_code: string,
  event: PlaidWebhookEvent
): Promise<void> {
  switch (webhook_code) {
    case "ERROR":
      // Handle item error
      console.error("Item error:", event.error);
      break;
    case "PENDING_EXPIRATION":
      // Handle pending expiration
      console.log("Item pending expiration:", event.item_id);
      break;
    case "USER_PERMISSION_REVOKED":
      // Handle user permission revoked
      console.log("User permission revoked for item:", event.item_id);
      break;
    default:
      console.log(`Unhandled ITEM webhook code: ${webhook_code}`);
  }
}

/**
 * Handle AUTH webhook events
 */
async function handleAuthWebhook(
  webhook_code: string,
  event: PlaidWebhookEvent
): Promise<void> {
  switch (webhook_code) {
    case "AUTOMATICALLY_VERIFIED":
      // Handle automatically verified
      console.log("Account automatically verified:", event.account_ids);
      break;
    case "VERIFICATION_EXPIRED":
      // Handle verification expired
      console.log("Verification expired for accounts:", event.account_ids);
      break;
    default:
      console.log(`Unhandled AUTH webhook code: ${webhook_code}`);
  }
}

/**
 * Process a Plaid webhook event
 * Routes webhook events to appropriate handlers based on type and code
 * @param event - Plaid webhook event
 * @throws AppError if processing fails
 */
export async function processPlaidWebhook(
  event: PlaidWebhookEvent
): Promise<void> {
  try {
    const { webhook_type, webhook_code } = event;

    // Route to appropriate handler based on webhook type and code
    switch (webhook_type) {
      case "TRANSACTIONS":
        await handleTransactionsWebhook(webhook_code, event);
        break;
      case "ITEM":
        await handleItemWebhook(webhook_code, event);
        break;
      case "AUTH":
        await handleAuthWebhook(webhook_code, event);
        break;
      default:
        console.log(`Unhandled webhook type: ${webhook_type}`);
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? `Failed to process webhook: ${error.message}`
        : "An unexpected error occurred while processing webhook";
    throw new AppError(message, 500);
  }
}


