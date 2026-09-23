import {
  itemService,
  logger,
  normalizePlaidTransaction,
  plaidService,
  prisma,
  type RemovedTransaction,
} from "@opulus/core";

export interface SyncItemResult {
  added: number;
  modified: number;
  removed: number;
}

/**
 * Catch up an item's transactions from its stored Plaid cursor.
 */
export async function syncItemTransactions(
  plaidItemId: string
): Promise<SyncItemResult> {
  const item = await itemService.getByPlaidItemId(plaidItemId);

  const { added, modified, removed, nextCursor } =
    await plaidService.transactionsSync(
      item.accessToken,
      item.transactionCursor
    );

  const bankAccounts = await prisma.bankAccount.findMany({
    where: { itemId: item.id },
    select: {
      id: true,
      providerAccountId: true,
    },
  });

  const accountIdMap = new Map(
    bankAccounts.map((acc) => [acc.providerAccountId, acc.id])
  );

  await prisma.$transaction(async (tx) => {
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

    if (modified.length > 0) {
      await Promise.all(
        modified.map(async (plaidTransaction) => {
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
        })
      );
    }

    if (removed.length > 0) {
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

    await tx.item.update({
      where: { id: item.id },
      data: { transactionCursor: nextCursor },
    });
  });

  const result: SyncItemResult = {
    added: added.length,
    modified: modified.length,
    removed: removed.length,
  };

  logger.info(
    {
      item_id: plaidItemId,
      added_count: result.added,
      modified_count: result.modified,
      removed_count: result.removed,
    },
    "Transactions synced successfully"
  );

  return result;
}
