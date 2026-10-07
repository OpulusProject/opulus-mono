import { accountRepository } from "../repositories/accountRepository.js";
import {
  liabilityRepository,
  normalizePlaidLiabilities,
} from "../repositories/liabilityRepository.js";
import { plaidGateway } from "../gateways/plaidGateway.js";
import { AppError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

/**
 * Plaid error codes meaning "this item has no liabilities data to give right
 * now" (unsupported institution, not consented, not ready, or no eligible
 * accounts). These are expected, so callers treat them as "unavailable".
 */
const UNAVAILABLE_ERROR_CODES = new Set([
  "PRODUCTS_NOT_SUPPORTED",
  "PRODUCT_NOT_READY",
  "ADDITIONAL_CONSENT_REQUIRED",
  "NO_LIABILITY_ACCOUNTS",
  "INVALID_PRODUCT",
]);

export type SyncLiabilitiesResult =
  | { status: "synced"; synced: number; unmatched: number }
  | { status: "unavailable"; reason: string };

/** The parts of an item a liabilities sync needs. */
interface SyncableItem {
  id: string;
  userId: string;
  accessToken: string;
}

export interface SyncItemLiabilitiesParams {
  item: SyncableItem;
  /**
   * Only fetch these Plaid account ids (e.g. the accounts a LIABILITIES webhook
   * reported as changed). All of the item's accounts if omitted.
   */
  providerAccountIds?: string[];
}

/**
 * Fetch an item's liabilities from Plaid and store one row per account.
 * Resolves to `unavailable` when Plaid has nothing to give for this item
 * (unsupported institution, product not ready, etc.); other failures throw.
 *
 * This is shared by the backend (when an institution is linked or its accounts
 * updated) and the webhooks service (LIABILITIES updates), which is why it
 * lives in core.
 *
 * @throws AppError if Plaid or the database fails unexpectedly
 */
export async function syncItemLiabilities(
  params: SyncItemLiabilitiesParams
): Promise<SyncLiabilitiesResult> {
  const { item, providerAccountIds } = params;

  let response;
  try {
    response = await plaidGateway.getLiabilities(
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

  const normalized = normalizePlaidLiabilities(response.liabilities);
  if (normalized.length === 0) {
    return { status: "synced", synced: 0, unmatched: 0 };
  }

  const accountIds = await accountRepository.getIdsByProviderAccountIds(
    item.id,
    normalized.map((entry) => entry.providerAccountId)
  );

  const rows = normalized.flatMap((entry) => {
    const accountId = accountIds.get(entry.providerAccountId);
    return accountId ? [{ accountId, data: entry.data }] : [];
  });

  if (rows.length > 0) {
    await liabilityRepository.upsertMany(item, rows);
  }

  return {
    status: "synced",
    synced: rows.length,
    unmatched: normalized.length - rows.length,
  };
}

/**
 * Like `syncItemLiabilities` for a whole item, but never throws. Use where
 * liabilities are a bonus and must not fail the surrounding flow (e.g. linking
 * an institution).
 */
export async function trySyncItemLiabilities(params: {
  item: SyncableItem;
}): Promise<SyncLiabilitiesResult | { status: "failed" }> {
  const { item } = params;

  try {
    const result = await syncItemLiabilities({ item });
    logger.info(
      { item_id: item.id, user_id: item.userId, ...result },
      "Liabilities sync finished"
    );
    return result;
  } catch (error) {
    logger.warn(
      {
        item_id: item.id,
        user_id: item.userId,
        error_message: error instanceof Error ? error.message : String(error),
      },
      "Liabilities sync failed (non-fatal)"
    );
    return { status: "failed" };
  }
}
