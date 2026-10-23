import {
  itemRepository,
  logger,
  plaidGateway,
  syncItemAccounts,
  toItemErrorData,
  trySyncItemHoldings,
  trySyncItemInvestmentTransactions,
  trySyncItemRecurring,
  trySyncItemLiabilities,
} from "@opulus/core";

import { getItem } from "./getItem.js";

/**
 * Reconcile a persisted Item's accounts with Plaid's current view
 * (`/accounts/get`). Called after a Link update-mode session (reconnect or
 * add-accounts) since Plaid does not fire a webhook for update mode.
 *
 * It also refreshes the item's stored error and consent expiry from Plaid,
 * and drops the "new accounts available" flag once new accounts were added.
 *
 * New Plaid accounts are inserted and existing ones refreshed. Accounts Plaid
 * no longer shares (the user de-selected them) are deleted with everything
 * stored for them; see `syncItemAccounts` for how an account is matched and when
 * nothing is deleted.
 */
export interface UpdateItemAccountsParams {
  userId: string;
  itemId: string;
}

export interface UpdateItemAccountsResult {
  itemId: string;
  created: number;
  updated: number;
  removed: number;
}

export async function updateItemAccounts(
  params: UpdateItemAccountsParams
): Promise<UpdateItemAccountsResult> {
  const item = await getItem(params);

  // The user just went through update mode, so whatever error or warning a
  // webhook stored may be resolved. Plaid sends no webhook for that, so take
  // the item's current state from Plaid.
  const plaidItem = await plaidGateway.getItem(item.accessToken);
  await itemRepository.update(item.id, {
    ...toItemErrorData(plaidItem.item.error),
    consentExpirationTime: plaidItem.item.consent_expiration_time
      ? new Date(plaidItem.item.consent_expiration_time)
      : null,
  });

  const { created, updated, removed, reported } = await syncItemAccounts({
    item,
  });

  // The accounts Plaid flagged as new have been added, so stop prompting.
  // (If the user shared none of them, the flag stays and they can try again.)
  if (created > 0) {
    await itemRepository.update(item.id, { newAccountsAvailable: false });
  }

  // New or re-consented accounts may now have liabilities data.
  await trySyncItemLiabilities({ item });
  await trySyncItemHoldings({ item });
  await trySyncItemInvestmentTransactions({ item });
  await trySyncItemRecurring({ item });

  logger.info(
    {
      item_id: item.id,
      plaid_item_id: item.plaidItemId,
      user_id: item.userId,
      accounts_total: reported,
      accounts_created: created,
      accounts_updated: updated,
      accounts_removed: removed,
    },
    "Item accounts updated from Plaid"
  );

  return { itemId: item.id, created, updated, removed };
}
