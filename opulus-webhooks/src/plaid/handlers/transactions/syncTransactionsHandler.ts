import { PlaidWebhookEvent } from "@/types/plaid/webhookSchema";
import {
  AppError,
  itemService,
  normalizePlaidTransaction,
  plaidService,
  prisma,
  type RemovedTransaction,
} from "@opulus/core";

/**
 * Handle transaction sync webhook events
 * Syncs transactions for an item using Plaid's /transactions/sync endpoint
 * Handles pagination automatically and updates the item's transaction cursor
 *
 * @param event - Plaid webhook event
 * @throws AppError if item not found or sync fails
 */
export async function syncTransactionsHandler(
  event: PlaidWebhookEvent
): Promise<void> {
  const startTime = Date.now();
  const webhookCode = event.webhook_code || "UNKNOWN";
  const itemId = event.item_id;

  console.log(
    `[TRANSACTIONS SYNC] Starting ${webhookCode} for item ${itemId}`,
    {
      webhook_code: webhookCode,
      item_id: itemId,
      environment: event.environment,
      error: event.error,
    }
  );

  if (!itemId) {
    console.error("[TRANSACTIONS SYNC] Missing item_id in webhook event", {
      event: JSON.stringify(event),
    });
    throw new AppError("item_id is required for TRANSACTIONS webhook", 400);
  }

  try {
    // Get the item from database
    console.log(`[TRANSACTIONS SYNC] Fetching item from database: ${itemId}`);
    const item = await itemService.getByPlaidItemId(itemId);
    console.log(`[TRANSACTIONS SYNC] Item found:`, {
      item_id: item.id,
      plaid_item_id: item.plaidItemId,
      user_id: item.userId,
      current_cursor: item.transactionCursor || "null",
      has_access_token: !!item.accessToken,
    });

    // Sync transactions from Plaid
    // This handles pagination automatically
    console.log(
      `[TRANSACTIONS SYNC] Calling Plaid transactionsSync with cursor: ${item.transactionCursor || "null"}`
    );
    const syncResult = await plaidService.transactionsSync(
      item.accessToken,
      item.transactionCursor
    );

    const { added, modified, removed, nextCursor } = syncResult;
    console.log(`[TRANSACTIONS SYNC] Plaid sync completed:`, {
      added_count: added.length,
      modified_count: modified.length,
      removed_count: removed.length,
      next_cursor: nextCursor || "null",
      has_more_data:
        added.length > 0 || modified.length > 0 || removed.length > 0,
    });

    // Get all bank accounts for this item to map account IDs
    console.log(
      `[TRANSACTIONS SYNC] Fetching bank accounts for item ${item.id}`
    );
    const bankAccounts = await prisma.bankAccount.findMany({
      where: { itemId: item.id },
      select: {
        id: true,
        providerAccountId: true,
      },
    });
    console.log(
      `[TRANSACTIONS SYNC] Found ${bankAccounts.length} bank accounts`
    );

    // Create a map of providerAccountId -> database accountId
    const accountIdMap = new Map(
      bankAccounts.map((acc) => [acc.providerAccountId, acc.id])
    );

    // Normalize and process transactions in a single database transaction
    // If any operation fails, the entire transaction rolls back
    console.log(`[TRANSACTIONS SYNC] Starting database transaction`);
    await prisma.$transaction(async (tx) => {
      // Process added transactions
      if (added.length > 0) {
        console.log(
          `[TRANSACTIONS SYNC] Processing ${added.length} added transactions`
        );
        const transactionsToCreate = added
          .map((plaidTransaction) => {
            const accountId = accountIdMap.get(plaidTransaction.account_id);
            if (!accountId) {
              console.warn(
                `[TRANSACTIONS SYNC] Account ${plaidTransaction.account_id} not found for transaction ${plaidTransaction.transaction_id}`
              );
              return null;
            }

            return normalizePlaidTransaction(
              plaidTransaction,
              accountId,
              item.id,
              item.userId
            );
          })
          .filter((t): t is NonNullable<typeof t> => t !== null);

        console.log(
          `[TRANSACTIONS SYNC] Normalized ${transactionsToCreate.length} transactions (${added.length - transactionsToCreate.length} skipped due to missing accounts)`
        );

        if (transactionsToCreate.length > 0) {
          console.log(
            `[TRANSACTIONS SYNC] Creating ${transactionsToCreate.length} transactions in database`
          );
          await tx.transaction.createMany({
            data: transactionsToCreate,
            skipDuplicates: true,
          });
          console.log(`[TRANSACTIONS SYNC] Successfully created transactions`);
        }
      }

      // Process modified transactions
      if (modified.length > 0) {
        console.log(
          `[TRANSACTIONS SYNC] Processing ${modified.length} modified transactions`
        );
        const updatePromises = modified.map(async (plaidTransaction) => {
          const accountId = accountIdMap.get(plaidTransaction.account_id);
          if (!accountId) {
            console.warn(
              `[TRANSACTIONS SYNC] Account ${plaidTransaction.account_id} not found for transaction ${plaidTransaction.transaction_id}`
            );
            return;
          }

          const transactionData = normalizePlaidTransaction(
            plaidTransaction,
            accountId,
            item.id,
            item.userId
          );

          const {
            providerTransactionId,
            accountId: txAccountId,
            ...updateData
          } = transactionData;

          await tx.transaction.update({
            where: {
              providerTransactionId_accountId: {
                providerTransactionId,
                accountId: txAccountId,
              },
            },
            data: updateData,
          });
        });

        await Promise.all(updatePromises);
        console.log(
          `[TRANSACTIONS SYNC] Successfully updated ${modified.length} transactions`
        );
      }

      // Process removed transactions
      // Plaid's /transactions/sync returns removed as Array<RemovedTransaction>
      // RemovedTransaction has { transaction_id: string, account_id: string }
      if (removed.length > 0) {
        console.log(
          `[TRANSACTIONS SYNC] Processing ${removed.length} removed transactions`
        );

        // Extract transaction IDs from RemovedTransaction objects
        const transactionIdsToDelete = (removed as RemovedTransaction[]).map(
          (removedTx) => removedTx.transaction_id
        );

        if (transactionIdsToDelete.length > 0) {
          const deleteResult = await tx.transaction.deleteMany({
            where: {
              providerTransactionId: {
                in: transactionIdsToDelete,
              },
            },
          });
          console.log(
            `[TRANSACTIONS SYNC] Deleted ${deleteResult.count} transactions`
          );
        }
      }

      // Update item's transaction cursor
      // Use transaction client directly since we're inside a Prisma transaction
      console.log(
        `[TRANSACTIONS SYNC] Updating transaction cursor to: ${nextCursor || "null"}`
      );
      await tx.item.update({
        where: { id: item.id },
        data: { transactionCursor: nextCursor },
      });
      console.log(`[TRANSACTIONS SYNC] Successfully updated cursor`);
    });

    const duration = Date.now() - startTime;
    console.log(
      `[TRANSACTIONS SYNC] ✅ Successfully completed ${webhookCode} for item ${itemId} in ${duration}ms`,
      {
        added: added.length,
        modified: modified.length,
        removed: removed.length,
        duration_ms: duration,
      }
    );
  } catch (error) {
    const duration = Date.now() - startTime;

    // Log full error details for debugging
    console.error(
      `[TRANSACTIONS SYNC] ❌ Failed ${webhookCode} for item ${itemId} after ${duration}ms`,
      {
        error_type:
          error instanceof Error ? error.constructor.name : typeof error,
        error_message: error instanceof Error ? error.message : String(error),
        error_stack: error instanceof Error ? error.stack : undefined,
        error_full: JSON.stringify(error, Object.getOwnPropertyNames(error)),
        item_id: itemId,
        webhook_code: webhookCode,
        duration_ms: duration,
      }
    );

    // Re-throw AppError as-is
    if (error instanceof AppError) {
      throw error;
    }

    // Wrap other errors with full details
    const message =
      error instanceof Error
        ? `Failed to sync transactions: ${error.message}`
        : "An unexpected error occurred while syncing transactions";
    throw new AppError(message, 500);
  }
}
