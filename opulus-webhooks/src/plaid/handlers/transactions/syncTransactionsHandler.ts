import { PlaidWebhookEvent } from "@/types/plaid/webhookSchema";
import {
  AppError,
  backfillBalanceHistory,
  logger,
  syncItemTransactions,
} from "@opulus/core";

/**
 * Handle transaction sync webhook events.
 */
export async function syncTransactionsHandler(
  event: PlaidWebhookEvent
): Promise<void> {
  if (!event.item_id) {
    throw new AppError("item_id is required for TRANSACTIONS webhook", 400);
  }

  try {
    const { transactionsUpdateStatus } = await syncItemTransactions({
      plaidItemId: event.item_id,
    });
    // Fills in the item's balance history once Plaid has loaded all of its
    // transactions, and does nothing until then or when it already has history.
    // A failure fails the job and the queue retries it: syncing again is
    // harmless (nothing new to fetch, and the status is still reported), so
    // the retry is effectively just the backfill.
    await backfillBalanceHistory({
      plaidItemId: event.item_id,
      transactionsUpdateStatus,
    });
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
