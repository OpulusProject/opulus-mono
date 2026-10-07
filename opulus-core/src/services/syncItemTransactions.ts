import type { RemovedTransaction } from "../client/plaid.js";
import { runInTransaction } from "../client/transaction.js";
import { plaidGateway } from "../gateways/plaidGateway.js";
import { accountRepository } from "../repositories/accountRepository.js";
import { itemRepository } from "../repositories/itemRepository.js";
import {
  normalizePlaidTransaction,
  transactionRepository,
} from "../repositories/transactionRepository.js";
import { logger } from "../utils/logger.js";

export interface SyncItemTransactionsParams {
  /** Plaid's id for the item (not ours). */
  plaidItemId: string;
}

export interface SyncItemTransactionsResult {
  added: number;
  modified: number;
  removed: number;
}

/**
 * Catch up an item's transactions from its stored Plaid cursor.
 *
 * This is shared by the webhooks service (SYNC_UPDATES_AVAILABLE and the
 * reconcile script), and lives in core with the other shared services.
 */
export async function syncItemTransactions(
  params: SyncItemTransactionsParams
): Promise<SyncItemTransactionsResult> {
  const item = await itemRepository.getByPlaidItemId(params.plaidItemId);

  const { added, modified, removed, nextCursor } =
    await plaidGateway.transactionsSync(item.accessToken, item.transactionCursor);

  // Only the accounts these transactions belong to need looking up.
  const accountIds = await accountRepository.getIdsByProviderAccountIds(
    item.id,
    [...new Set([...added, ...modified].map((t) => t.account_id))]
  );

  // Transactions for accounts we don't have (not shared with us) are skipped.
  const toRow = (plaidTransaction: (typeof added)[number]) => {
    const accountId = accountIds.get(plaidTransaction.account_id);
    return accountId
      ? normalizePlaidTransaction(
          plaidTransaction,
          accountId,
          item.id,
          item.userId
        )
      : null;
  };
  const notNull = <T>(row: T | null): row is T => row !== null;

  const toCreate = added.map(toRow).filter(notNull);
  const toUpdate = modified.map(toRow).filter(notNull);
  const toDelete = (removed as RemovedTransaction[]).map(
    (removedTransaction) => removedTransaction.transaction_id
  );

  // All of it, and moving the cursor forward, or none of it.
  await runInTransaction(async (tx) => {
    if (toCreate.length > 0) {
      await transactionRepository.createMany(toCreate, tx);
    }
    if (toUpdate.length > 0) {
      await transactionRepository.updateMany(toUpdate, tx);
    }
    if (toDelete.length > 0) {
      await transactionRepository.deleteMany(toDelete, tx);
    }
    await itemRepository.update(
      item.id,
      { transactionCursor: nextCursor, syncedAt: new Date() },
      tx
    );
  });

  const result: SyncItemTransactionsResult = {
    added: added.length,
    modified: modified.length,
    removed: removed.length,
  };

  logger.info(
    {
      item_id: params.plaidItemId,
      added_count: result.added,
      modified_count: result.modified,
      removed_count: result.removed,
    },
    "Transactions synced successfully"
  );

  return result;
}
