import {
  itemService,
  liabilityService,
  logger,
  normalizePlaidAccount,
  plaidService,
  prisma,
  toItemErrorData,
} from "@opulus/core";

/**
 * Reconcile a persisted Item's accounts with Plaid's current view
 * (`/accounts/get`). Called after a Link update-mode session (reconnect or
 * add-accounts) since Plaid does not fire a webhook for update mode.
 *
 * It also refreshes the item's stored error and consent expiry from Plaid,
 * and drops the "new accounts available" flag once new accounts were added.
 *
 * New Plaid accounts are inserted and existing ones have their mutable fields
 * refreshed. Accounts we have that Plaid no longer returns were de-selected by
 * the user (Plaid: "any de-selected accounts will no longer be shared with
 * you"), so they are deleted along with their transactions and liabilities.
 * Two guards keep a quirk on Plaid's side from deleting real data:
 * - An account is matched by Plaid's account id, and failing that by its
 *   persistent id, because account ids can change across item updates.
 * - Nothing is deleted when Plaid returned no accounts, or when none of the
 *   returned accounts matched one we have. Both look like something other than
 *   the user de-selecting (an error, or all the ids changing).
 */
export async function updateItemAccounts(itemId: string) {
  const item = await itemService.getById(itemId);
  const accountsResponse = await plaidService.getAccounts(item.accessToken);

  // The user just went through update mode, so whatever error or warning a
  // webhook stored may be resolved. Plaid sends no webhook for that, so take
  // the item's current state from Plaid.
  const plaidItem = await plaidService.getItem(item.accessToken);
  await itemService.update(item.id, {
    ...toItemErrorData(plaidItem.item.error),
    consentExpirationTime: plaidItem.item.consent_expiration_time
      ? new Date(plaidItem.item.consent_expiration_time)
      : null,
  });

  let created = 0;
  let updated = 0;
  let removed = 0;

  await prisma.$transaction(async (tx) => {
    const existingAccounts = await tx.account.findMany({
      where: { itemId: item.id },
      select: { id: true, providerAccountId: true, persistentAccountId: true },
    });
    const matchedIds = new Set<string>();

    for (const plaidAccount of accountsResponse.accounts) {
      const data = normalizePlaidAccount(plaidAccount, item.id, item.userId);
      const existing =
        existingAccounts.find(
          (a) => a.providerAccountId === data.providerAccountId
        ) ??
        (data.persistentAccountId
          ? existingAccounts.find(
              (a) =>
                !matchedIds.has(a.id) &&
                a.persistentAccountId === data.persistentAccountId
            )
          : undefined);

      if (!existing) {
        await tx.account.create({ data });
        created += 1;
      } else {
        matchedIds.add(existing.id);
        await tx.account.update({
          where: { id: existing.id },
          data: {
            // Plaid's id for the account can change; keep ours current.
            providerAccountId: data.providerAccountId,
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

    // Accounts Plaid no longer shares. Only act when the response is
    // trustworthy: it listed accounts, and at least one was one of ours.
    const unmatched = existingAccounts.filter((a) => !matchedIds.has(a.id));
    if (unmatched.length > 0) {
      if (accountsResponse.accounts.length > 0 && matchedIds.size > 0) {
        const result = await tx.account.deleteMany({
          where: { id: { in: unmatched.map((a) => a.id) } },
        });
        removed = result.count;
      } else {
        logger.warn(
          {
            item_id: item.id,
            accounts_known: existingAccounts.length,
            accounts_from_plaid: accountsResponse.accounts.length,
          },
          "Plaid's accounts matched none of ours; not removing any"
        );
      }
    }
  });

  // The accounts Plaid flagged as new have been added, so stop prompting.
  // (If the user shared none of them, the flag stays and they can try again.)
  if (created > 0) {
    await itemService.update(item.id, { newAccountsAvailable: false });
  }

  // New or re-consented accounts may now have liabilities data.
  await liabilityService.trySyncForItem(item);

  logger.info(
    {
      item_id: item.id,
      plaid_item_id: item.plaidItemId,
      user_id: item.userId,
      accounts_total: accountsResponse.accounts.length,
      accounts_created: created,
      accounts_updated: updated,
      accounts_removed: removed,
    },
    "Item accounts updated from Plaid"
  );

  return { itemId: item.id, created, updated, removed };
}
