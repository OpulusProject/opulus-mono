import { PlaidWebhookEvent } from "@/types/plaid/webhookSchema";
import {
  AppError,
  itemService,
  normalizePlaidTransaction,
  plaidService,
  prisma,
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
  if (!event.item_id) {
    throw new AppError("item_id is required for TRANSACTIONS webhook", 400);
  }

  try {
    // Get the item from database
    const item = await itemService.getByPlaidItemId(event.item_id);

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
              console.warn(
                `[TRANSACTIONS WEBHOOK] Account ${plaidTransaction.account_id} not found for transaction ${plaidTransaction.transaction_id}`
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
            console.warn(
              `[TRANSACTIONS WEBHOOK] Account ${plaidTransaction.account_id} not found for transaction ${plaidTransaction.transaction_id}`
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
      }

      // Process removed transactions
      // Removed transactions are just transaction IDs (strings), not full transaction objects
      if (removed.length > 0) {
        await tx.transaction.deleteMany({
          where: {
            providerTransactionId: {
              in: removed,
            },
          },
        });
      }

      // Update item's transaction cursor
      // Use transaction client directly since we're inside a Prisma transaction
      await tx.item.update({
        where: { id: item.id },
        data: { transactionCursor: nextCursor },
      });
    });

    console.log(
      `[TRANSACTIONS WEBHOOK] ${event.webhook_code} - Item ${event.item_id}: ${added.length} added, ${modified.length} modified, ${removed.length} removed`
    );
  } catch (error) {
    // Re-throw AppError as-is
    if (error instanceof AppError) {
      throw error;
    }

    // Wrap other errors
    const message =
      error instanceof Error
        ? `Failed to sync transactions: ${error.message}`
        : "An unexpected error occurred while syncing transactions";
    throw new AppError(message, 500);
  }
}
