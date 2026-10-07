import {
  itemRepository,
  logger,
  normalizePlaidAccount,
  plaidService,
  prisma,
  toItemErrorData,
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
 * Upsert-only: new Plaid accounts are inserted, existing ones have their
 * mutable fields refreshed. De-selection handling (soft or hard delete) is
 * deferred — accounts the user removes stay in the DB for now.
 */
export interface UpdateItemAccountsParams {
  userId: string;
  itemId: string;
}

export interface UpdateItemAccountsResult {
  itemId: string;
  created: number;
  updated: number;
}

export async function updateItemAccounts(
  params: UpdateItemAccountsParams
): Promise<UpdateItemAccountsResult> {
  const item = await getItem(params);
  const accountsResponse = await plaidService.getAccounts(item.accessToken);

  // The user just went through update mode, so whatever error or warning a
  // webhook stored may be resolved. Plaid sends no webhook for that, so take
  // the item's current state from Plaid.
  const plaidItem = await plaidService.getItem(item.accessToken);
  await itemRepository.update(item.id, {
    ...toItemErrorData(plaidItem.item.error),
    consentExpirationTime: plaidItem.item.consent_expiration_time
      ? new Date(plaidItem.item.consent_expiration_time)
      : null,
  });

  let created = 0;
  let updated = 0;

  await prisma.$transaction(async (tx) => {
    for (const plaidAccount of accountsResponse.accounts) {
      const data = normalizePlaidAccount(plaidAccount, item.id, item.userId);
      const existing = await tx.account.findUnique({
        where: {
          providerAccountId_itemId: {
            providerAccountId: data.providerAccountId,
            itemId: item.id,
          },
        },
        select: { id: true },
      });

      if (!existing) {
        await tx.account.create({ data });
        created += 1;
      } else {
        await tx.account.update({
          where: { id: existing.id },
          data: {
            name: data.name,
            officialName: data.officialName,
            type: data.type,
            subtype: data.subtype,
            mask: data.mask,
            balanceAvailable: data.balanceAvailable,
            balanceCurrent: data.balanceCurrent,
            balanceLimit: data.balanceLimit,
            isoCurrencyCode: data.isoCurrencyCode,
            unofficialCurrencyCode: data.unofficialCurrencyCode,
            persistentAccountId: data.persistentAccountId,
          },
        });
        updated += 1;
      }
    }
  });

  // The accounts Plaid flagged as new have been added, so stop prompting.
  // (If the user shared none of them, the flag stays and they can try again.)
  if (created > 0) {
    await itemRepository.update(item.id, { newAccountsAvailable: false });
  }

  // New or re-consented accounts may now have liabilities data.
  await trySyncItemLiabilities(item);

  logger.info(
    {
      item_id: item.id,
      plaid_item_id: item.plaidItemId,
      user_id: item.userId,
      accounts_total: accountsResponse.accounts.length,
      accounts_created: created,
      accounts_updated: updated,
    },
    "Item accounts updated from Plaid"
  );

  return { itemId: item.id, created, updated };
}
