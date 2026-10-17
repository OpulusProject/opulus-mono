import { accountRepository } from "../repositories/accountRepository.js";
import {
  normalizePlaidStreams,
  recurringStreamRepository,
} from "../repositories/recurringStreamRepository.js";
import { plaidGateway } from "../gateways/plaidGateway.js";
import { AppError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

/**
 * Plaid error codes meaning "this item has no recurring transactions to give
 * right now" (its transactions are not loaded yet, or the institution does not
 * support them). These are expected, so callers treat them as "unavailable".
 */
const UNAVAILABLE_ERROR_CODES = new Set([
  "PRODUCTS_NOT_SUPPORTED",
  "PRODUCT_NOT_READY",
  "PRODUCT_NOT_ENABLED",
  "ADDITIONAL_CONSENT_REQUIRED",
  "INVALID_PRODUCT",
]);

export type SyncRecurringResult =
  | { status: "synced"; streams: number; unmatched: number }
  | { status: "unavailable"; reason: string };

/** The parts of an item a recurring sync needs. */
interface SyncableItem {
  id: string;
  userId: string;
  accessToken: string;
}

/**
 * Fetch an item's recurring payments and income from Plaid and store them,
 * replacing what was stored. Resolves to `unavailable` when Plaid has nothing to
 * give yet (the item's transactions are not loaded, or it is not supported);
 * other failures throw.
 *
 * Shared by the backend (when an institution is linked, and on an accounts
 * update) and the webhooks service (RECURRING_TRANSACTIONS_UPDATE), which is
 * why it lives in core.
 *
 * @throws AppError if Plaid or the database fails unexpectedly
 */
export async function syncItemRecurring(params: {
  item: SyncableItem;
}): Promise<SyncRecurringResult> {
  const { item } = params;

  // Plaid wants the accounts to look at: all of the item's.
  const providerAccountIds =
    await accountRepository.getProviderAccountIdsByItemId(item.id);

  let response;
  try {
    response = await plaidGateway.getRecurringTransactions(
      item.accessToken,
      providerAccountIds
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

  const accountIds = await accountRepository.getIdsByProviderAccountIds(
    item.id,
    providerAccountIds
  );
  const normalized = normalizePlaidStreams(response);
  const matched = normalized.flatMap(({ providerAccountId, ...stream }) => {
    const accountId = accountIds.get(providerAccountId);
    return accountId ? [{ ...stream, accountId }] : [];
  });

  await recurringStreamRepository.replaceForItem(item, matched);

  return {
    status: "synced",
    streams: matched.length,
    unmatched: normalized.length - matched.length,
  };
}

/**
 * Like `syncItemRecurring`, but never throws. Use where recurring transactions
 * are a bonus and must not fail the surrounding flow (e.g. linking an
 * institution, whose transactions Plaid has usually not loaded yet).
 */
export async function trySyncItemRecurring(params: {
  item: SyncableItem;
}): Promise<SyncRecurringResult | { status: "failed" }> {
  const { item } = params;

  try {
    const result = await syncItemRecurring({ item });
    logger.info(
      { item_id: item.id, user_id: item.userId, ...result },
      "Recurring transactions sync finished"
    );
    return result;
  } catch (error) {
    logger.warn(
      {
        item_id: item.id,
        user_id: item.userId,
        error_message: error instanceof Error ? error.message : String(error),
      },
      "Recurring transactions sync failed (non-fatal)"
    );
    return { status: "failed" };
  }
}
