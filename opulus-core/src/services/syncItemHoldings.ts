import { accountRepository } from "../repositories/accountRepository.js";
import {
  holdingRepository,
  normalizePlaidHoldings,
} from "../repositories/holdingRepository.js";
import { plaidGateway } from "../gateways/plaidGateway.js";
import { AppError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { requestPricingOfNewSecurities } from "./securityPrices.js";

/**
 * Plaid error codes meaning "this item has no investments data to give right
 * now" (unsupported institution, not consented, not ready, or no investment
 * accounts). These are expected, so callers treat them as "unavailable".
 */
const UNAVAILABLE_ERROR_CODES = new Set([
  "PRODUCTS_NOT_SUPPORTED",
  "PRODUCT_NOT_READY",
  "ADDITIONAL_CONSENT_REQUIRED",
  "NO_INVESTMENT_ACCOUNTS",
  "INVALID_PRODUCT",
]);

export type SyncHoldingsResult =
  | {
      status: "synced";
      holdings: number;
      securities: number;
      unmatched: number;
    }
  | { status: "unavailable"; reason: string };

/** The parts of an item a holdings sync needs. */
interface SyncableItem {
  id: string;
  userId: string;
  accessToken: string;
}

/**
 * Fetch an item's holdings from Plaid and store them, replacing what was there
 * for the accounts Plaid answered for. Resolves to `unavailable` when Plaid has
 * nothing to give for this item (unsupported institution, no investment
 * accounts, product not ready); other failures throw.
 *
 * Shared by the backend (when an institution is linked, and on a refresh) and
 * the webhooks service (HOLDINGS updates), which is why it lives in core.
 *
 * @throws AppError if Plaid or the database fails unexpectedly
 */
export async function syncItemHoldings(params: {
  item: SyncableItem;
}): Promise<SyncHoldingsResult> {
  const { item } = params;

  let response;
  try {
    response = await plaidGateway.getInvestmentHoldings(item.accessToken);
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
  const providerAccountIds = response.accounts.map((a) => a.account_id);
  const accountIds = await accountRepository.getIdsByProviderAccountIds(
    item.id,
    providerAccountIds
  );

  const normalized = normalizePlaidHoldings(response);
  const matched = normalized.holdings.flatMap((holding) => {
    const accountId = accountIds.get(holding.providerAccountId);
    return accountId ? [{ ...holding, accountId }] : [];
  });

  await holdingRepository.replaceForAccounts(
    item,
    [...accountIds.values()],
    normalized.securities,
    matched
  );
  // New securities get a price and history at once, not at the next scheduled run.
  if (normalized.securities.length > 0) requestPricingOfNewSecurities();

  return {
    status: "synced",
    holdings: matched.length,
    securities: normalized.securities.length,
    unmatched: normalized.holdings.length - matched.length,
  };
}

/**
 * Like `syncItemHoldings`, but never throws. Use where holdings are a bonus and
 * must not fail the surrounding flow (e.g. linking an institution).
 */
export async function trySyncItemHoldings(params: {
  item: SyncableItem;
}): Promise<SyncHoldingsResult | { status: "failed" }> {
  const { item } = params;

  try {
    const result = await syncItemHoldings({ item });
    logger.info(
      { item_id: item.id, user_id: item.userId, ...result },
      "Holdings sync finished"
    );
    return result;
  } catch (error) {
    logger.warn(
      {
        item_id: item.id,
        user_id: item.userId,
        error_message: error instanceof Error ? error.message : String(error),
      },
      "Holdings sync failed (non-fatal)"
    );
    return { status: "failed" };
  }
}
