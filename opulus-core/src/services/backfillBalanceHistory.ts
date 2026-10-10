import { runInTransaction } from "../client/transaction.js";
import { accountRepository } from "../repositories/accountRepository.js";
import { historicBalanceRepository } from "../repositories/historicBalanceRepository.js";
import { itemRepository } from "../repositories/itemRepository.js";
import { transactionRepository } from "../repositories/transactionRepository.js";
import {
  isTransactionHistoryComplete,
  reconstructBalanceHistory,
} from "../utils/balanceHistory.js";
import { toDay } from "../utils/day.js";
import { logger } from "../utils/logger.js";

export interface BackfillBalanceHistoryParams {
  /** Plaid's id for the item (not ours). */
  plaidItemId: string;
  /**
   * The `transactions_update_status` of the sync that was just done. The
   * history is only built once Plaid says all of the item's transactions are
   * loaded.
   */
  transactionsUpdateStatus: string | null | undefined;
}

export type BackfillBalanceHistoryResult =
  | { skipped: true }
  | { skipped: false; accounts: number; rows: number };

/**
 * Fill in an item's balance history for the days before it was linked, from the
 * transactions we hold. Meant to run after every transactions sync, given that
 * sync's `transactions_update_status`: it does nothing until Plaid reports the
 * item's full history loaded (HISTORICAL_UPDATE_COMPLETE), and then builds the
 * history once; an item that already has history is left alone. Today's
 * balance is not stored: it is read live.
 *
 * Lives in core so any service can run it (the webhooks service does, after a
 * sync).
 */
export async function backfillBalanceHistory(
  params: BackfillBalanceHistoryParams,
  now: Date = new Date()
): Promise<BackfillBalanceHistoryResult> {
  if (!isTransactionHistoryComplete(params.transactionsUpdateStatus)) {
    return { skipped: true };
  }

  const item = await itemRepository.getByPlaidItemId(params.plaidItemId);
  if (await historicBalanceRepository.existsForItem(item.id)) {
    return { skipped: true };
  }

  const [accounts, transactions] = await Promise.all([
    accountRepository.getBalancesByItemId(item.id),
    transactionRepository.getForBalanceHistory(item.id),
  ]);

  const history = reconstructBalanceHistory({
    accounts,
    transactions,
    today: toDay(now),
  });

  const rows = await runInTransaction((tx) =>
    historicBalanceRepository.replaceForAccounts(
      accounts.map((account) => account.id),
      history.map((row) => ({
        accountId: row.accountId,
        userId: item.userId,
        date: new Date(`${row.date}T00:00:00Z`),
        balanceCurrent: row.balanceCurrent,
        isoCurrencyCode: row.isoCurrencyCode,
      })),
      tx
    )
  );

  logger.info(
    {
      item_id: params.plaidItemId,
      account_count: accounts.length,
      row_count: rows,
    },
    "Balance history backfilled"
  );

  return { skipped: false, accounts: accounts.length, rows };
}
