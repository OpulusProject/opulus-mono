import {
  itemService,
  logger,
  normalizePlaidAccount,
  plaidService,
  prisma,
} from "@opulus/core";

/**
 * Reconcile a persisted Item's bank accounts with Plaid's current view
 * (`/accounts/get`). Used after a Link update-mode session (reconnect or
 * add-accounts), where Plaid does not fire a webhook for the completion.
 *
 * Upsert-only: new Plaid accounts are inserted, existing ones have their
 * mutable fields refreshed. Accounts the user *de-selected* are left in
 * the DB untouched to avoid cascade-deleting historical Transaction rows;
 * soft-deletion is a future change.
 */
export async function updateItemAccountsForUser(itemId: string) {
  const item = await itemService.getById(itemId);
  const accountsResponse = await plaidService.getAccounts(item.accessToken);

  let created = 0;
  let updated = 0;

  await prisma.$transaction(async (tx) => {
    for (const plaidAccount of accountsResponse.accounts) {
      const data = normalizePlaidAccount(plaidAccount, item.id, item.userId);
      const existing = await tx.bankAccount.findFirst({
        where: { itemId: item.id, providerAccountId: data.providerAccountId },
        select: { id: true },
      });

      if (existing) {
        await tx.bankAccount.update({
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
      } else {
        await tx.bankAccount.create({ data });
        created += 1;
      }
    }
  });

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
