import { runInTransaction } from "../client/transaction.js";
import { plaidGateway } from "../gateways/plaidGateway.js";
import { accountRepository } from "../repositories/accountRepository.js";
import { normalizePlaidSecurity } from "../repositories/holdingRepository.js";
import { itemRepository } from "../repositories/itemRepository.js";
import {
  investmentTransactionRepository,
  normalizePlaidInvestmentTransaction,
} from "../repositories/investmentTransactionRepository.js";
import { addDays, toDay } from "../utils/day.js";
import { AppError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

/**
 * Plaid error codes meaning "this item has no investment transactions to give
 * right now" (unsupported institution, not consented, not ready, or no
 * investment accounts). These are expected, so callers treat them as
 * "unavailable".
 */
const UNAVAILABLE_ERROR_CODES = new Set([
  "PRODUCTS_NOT_SUPPORTED",
  "PRODUCT_NOT_READY",
  "ADDITIONAL_CONSENT_REQUIRED",
  "NO_INVESTMENT_ACCOUNTS",
  "INVALID_PRODUCT",
]);

/** How far back Plaid keeps investment transactions, in days (24 months). */
const PLAID_HISTORY_DAYS = 730;

/**
 * How far before the last successful sync the next one starts. Plaid can add,
 * change or cancel a transaction for a few weeks after the fact, so the recent
 * past is read again each time.
 */
const OVERLAP_DAYS = 30;

export type SyncInvestmentTransactionsResult =
  | {
      status: "synced";
      transactions: number;
      unmatched: number;
      from: string;
      to: string;
    }
  | { status: "unavailable"; reason: string };

/** The parts of an item an investment transactions sync needs. */
interface SyncableItem {
  id: string;
  userId: string;
  accessToken: string;
  investmentTransactionsSyncedAt: Date | null;
}

/**
 * Fetch an item's investment transactions from Plaid and store them, replacing
 * what was stored for the period fetched: all 24 months the first time, then the
 * time since the last sync (and a month before it). Resolves to `unavailable`
 * when Plaid has nothing to give for this item; other failures throw.
 *
 * Shared by the backend (when an institution is linked or updated) and the
 * webhooks service (INVESTMENTS_TRANSACTIONS updates), which is why it lives in
 * core.
 *
 * @param now - The current time (for tests)
 * @throws AppError if Plaid or the database fails unexpectedly
 */
export async function syncItemInvestmentTransactions(params: {
  item: SyncableItem;
  now?: Date;
}): Promise<SyncInvestmentTransactionsResult> {
  const { item } = params;
  const now = params.now ?? new Date();
  const to = toDay(now);
  const from = item.investmentTransactionsSyncedAt
    ? toDay(
        new Date(
          Math.max(
            Date.parse(
              `${addDays(toDay(item.investmentTransactionsSyncedAt), -OVERLAP_DAYS)}T00:00:00Z`
            ),
            Date.parse(`${addDays(to, -PLAID_HISTORY_DAYS)}T00:00:00Z`)
          )
        )
      )
    : addDays(to, -PLAID_HISTORY_DAYS);

  let response;
  try {
    response = await plaidGateway.getInvestmentTransactions(
      item.accessToken,
      from,
      to
    );
  } catch (error) {
    if (
      error instanceof AppError &&
      error.code &&
      UNAVAILABLE_ERROR_CODES.has(error.code)
    ) {
      return { status: "unavailable", reason: error.code };
    }
    throw error;
  }

  // Plaid answers for the item's investment accounts; ours are the ones it names.
  const accountIds = await accountRepository.getIdsByProviderAccountIds(
    item.id,
    response.accounts.map((account) => account.account_id)
  );

  const normalized = response.investmentTransactions.map(
    normalizePlaidInvestmentTransaction
  );
  const matched = normalized.flatMap(({ providerAccountId, ...rest }) => {
    const accountId = accountIds.get(providerAccountId);
    return accountId ? [{ ...rest, accountId }] : [];
  });

  await runInTransaction(async (tx) => {
    await investmentTransactionRepository.replacePeriod(
      item,
      [...accountIds.values()],
      {
        from: new Date(`${from}T00:00:00Z`),
        to: new Date(`${to}T23:59:59.999Z`),
      },
      response.securities.map(normalizePlaidSecurity),
      matched,
      tx
    );
    await itemRepository.update(
      item.id,
      { investmentTransactionsSyncedAt: now },
      tx
    );
  });

  return {
    status: "synced",
    transactions: matched.length,
    unmatched: normalized.length - matched.length,
    from,
    to,
  };
}

/**
 * Like `syncItemInvestmentTransactions`, but never throws. Use where investment
 * transactions are a bonus and must not fail the surrounding flow (e.g. linking
 * an institution).
 */
export async function trySyncItemInvestmentTransactions(params: {
  item: SyncableItem;
}): Promise<SyncInvestmentTransactionsResult | { status: "failed" }> {
  const { item } = params;

  try {
    const result = await syncItemInvestmentTransactions({ item });
    logger.info(
      { item_id: item.id, user_id: item.userId, ...result },
      "Investment transactions sync finished"
    );
    return result;
  } catch (error) {
    logger.warn(
      {
        item_id: item.id,
        user_id: item.userId,
        error_message: error instanceof Error ? error.message : String(error),
      },
      "Investment transactions sync failed (non-fatal)"
    );
    return { status: "failed" };
  }
}
