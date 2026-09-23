import { PlaidWebhookEvent } from "@/types/plaid/webhookSchema";
import { AppError, logger, transactionService } from "@opulus/core";

/**
 * Handle transaction sync webhook events.
 * Domain work lives in transactionService.syncForItem.
 */
export async function syncTransactionsHandler(
  event: PlaidWebhookEvent
): Promise<void> {
  if (!event.item_id) {
    throw new AppError("item_id is required for TRANSACTIONS webhook", 400);
  }

  try {
    await transactionService.syncForItem(event.item_id);
  } catch (error) {
    logger.error(
      {
        event: {
          webhook_type: event.webhook_type,
          webhook_code: event.webhook_code,
          item_id: event.item_id,
        },
        error_type:
          error instanceof Error ? error.constructor.name : typeof error,
        error_message: error instanceof Error ? error.message : String(error),
        error_stack: error instanceof Error ? error.stack : undefined,
      },
      "Handler execution failed"
    );

    if (error instanceof AppError) {
      throw error;
    }

    const message =
      error instanceof Error
        ? `Failed to sync transactions: ${error.message}`
        : "An unexpected error occurred while syncing transactions";
    throw new AppError(message, 500);
  }
}
