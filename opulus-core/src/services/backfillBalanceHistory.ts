import { runInTransaction } from "../client/transaction.js";
import { accountRepository } from "../repositories/accountRepository.js";
import { historicBalanceRepository } from "../repositories/historicBalanceRepository.js";
import { itemRepository } from "../repositories/itemRepository.js";
import { transactionRepository } from "../repositories/transactionRepository.js";
import {
  isTransactionHistoryComplete,
  reconstructBalanceHistory,
} from "../utils/balanceHistory.js";
import { logger } from "../utils/logger.js";
import { refreshItemBalances } from "./refreshItemBalances.js";

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
 * history once; an item that already has history is left alone. Before it
 * reconstructs it reads the item's balances fresh from Plaid, since the history
 * works back from them. Today's balance is not stored: it is read live.
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

  // The history is today's balance with later transactions undone, so the
  // balance has to be as current as the transactions. The one stored when the
  // item was linked may be older than some of them (or cached by Plaid), which
  // would leave every earlier day off by their sum. Reading it fresh costs a
  // Plaid call, once per item. If that fails, a history built from the stored
  // balances is better than none.
  try {
    await refreshItemBalances({
      itemId: item.id,
      accessToken: item.accessToken,
    });
  } catch (error) {
    logger.warn(
      {
        item_id: params.plaidItemId,
        error_message: error instanceof Error ? error.message : String(error),
      },
      "Could not refresh balances before the balance history; using the stored ones"
    );
  }

  const [accounts, transactions] = await Promise.all([
    accountRepository.getBalancesByItemId(item.id),
    transactionRepository.getForBalanceHistory(item.id),
  ]);

  const history = reconstructBalanceHistory({
    accounts,
    transactions,
    today: now.toISOString().slice(0, 10),
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
