import { PlaidWebhookEvent } from "@/types/plaid/webhookSchema";
import {
  AppError,
  itemService,
  logger,
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
  const itemId = event.item_id;

  if (!itemId) {
    throw new AppError("item_id is required for TRANSACTIONS webhook", 400);
  }

  try {
    // Get the item from database
    const item = await itemService.getByPlaidItemId(itemId);

    // Sync transactions from Plaid
    // This handles pagination automatically
    const syncResult = await plaidService.transactionsSync(
      item.accessToken,
      item.transactionCursor
    );

    const { added, modified, removed, nextCursor } = syncResult;

    // Get all bank accounts for this item to map account IDs
    const bankAccounts = await prisma.bankAccount.findMany({
      where: { itemId: item.id },
      select: {
        id: true,
        providerAccountId: true,
      },
    });

    // Create a map of providerAccountId -> database accountId
    const accountIdMap = new Map(
      bankAccounts.map((acc) => [acc.providerAccountId, acc.id])
    );

    // Normalize and process transactions in a single database transaction
    // If any operation fails, the entire transaction rolls back
    await prisma.$transaction(async (tx) => {
      // Process added transactions
      if (added.length > 0) {
        const transactionsToCreate = added
          .map((plaidTransaction) => {
            const accountId = accountIdMap.get(plaidTransaction.account_id);
            if (!accountId) {
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

        if (transactionsToCreate.length > 0) {
          await tx.transaction.createMany({
            data: transactionsToCreate,
            skipDuplicates: true,
          });
        }
      }

      // Process modified transactions
      if (modified.length > 0) {
        const updatePromises = modified.map(async (plaidTransaction) => {
          const accountId = accountIdMap.get(plaidTransaction.account_id);
          if (!accountId) {
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
      }

      // Process removed transactions
      // Plaid's /transactions/sync returns removed as Array<RemovedTransaction>
      // RemovedTransaction has { transaction_id: string, account_id: string }
      if (removed.length > 0) {
        // Extract transaction IDs from RemovedTransaction objects
        const transactionIdsToDelete = (removed as RemovedTransaction[]).map(
          (removedTx) => removedTx.transaction_id
        );

        if (transactionIdsToDelete.length > 0) {
          await tx.transaction.deleteMany({
            where: {
              providerTransactionId: {
                in: transactionIdsToDelete,
              },
            },
          });
        }
      }

      // Update item's transaction cursor
      // Use transaction client directly since we're inside a Prisma transaction
      await tx.item.update({
        where: { id: item.id },
        data: { transactionCursor: nextCursor },
      });
    });

    logger.info(
      {
        event: {
          webhook_type: event.webhook_type,
          webhook_code: event.webhook_code,
          item_id: event.item_id,
        },
        added_count: added.length,
        modified_count: modified.length,
        removed_count: removed.length,
      },
      "Transactions synced successfully"
    );
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
