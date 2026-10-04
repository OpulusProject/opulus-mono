import {
  itemService,
  logger,
  normalizePlaidAccount,
  plaidService,
  prisma,
} from "@opulus/core";

/**
 * Reconcile a persisted Item's bank accounts with Plaid's current view
 * (`/accounts/get`). Called after a Link update-mode session (reconnect or
 * add-accounts) since Plaid does not fire a webhook for update mode. Also
 * called from `createItem` when the user re-links an already-known Item.
 *
 * Behavior:
 *   - new Plaid account       → inserted
 *   - existing Plaid account  → mutable fields refreshed (balances, name, ...)
 *   - account not in response → soft-deleted (`deletedAt = now`)
 *
 * We soft-delete rather than hard-delete to preserve historical Transaction
 * rows (which cascade-delete via the FK). Read sites must filter on
 * `deletedAt IS NULL`.
 */
export async function updateItemAccounts(itemId: string) {
  const item = await itemService.getById(itemId);
  const accountsResponse = await plaidService.getAccounts(item.accessToken);
  const now = new Date();

  const plaidProviderIds = new Set(
    accountsResponse.accounts.map((a) => a.account_id)
  );

  let created = 0;
  let updated = 0;
  let restored = 0;
  let softDeleted = 0;

  await prisma.$transaction(async (tx) => {
    for (const plaidAccount of accountsResponse.accounts) {
      const data = normalizePlaidAccount(plaidAccount, item.id, item.userId);
      const existing = await tx.bankAccount.findUnique({
        where: {
          providerAccountId_itemId: {
            providerAccountId: data.providerAccountId,
            itemId: item.id,
          },
        },
        select: { id: true, deletedAt: true },
      });

      if (!existing) {
        await tx.bankAccount.create({ data });
        created += 1;
        continue;
      }

      if (existing.deletedAt) restored += 1;
      else updated += 1;

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
          deletedAt: null,
        },
      });
    }

    // Soft-delete rows for accounts the user de-selected (not present in the
    // current Plaid response). Transactions remain intact for history.
    const deletion = await tx.bankAccount.updateMany({
      where: {
        itemId: item.id,
        deletedAt: null,
        providerAccountId: { notIn: Array.from(plaidProviderIds) },
      },
      data: { deletedAt: now },
    });
    softDeleted = deletion.count;
  });

  logger.info(
    {
      item_id: item.id,
      plaid_item_id: item.plaidItemId,
      user_id: item.userId,
      accounts_total: accountsResponse.accounts.length,
      accounts_created: created,
      accounts_updated: updated,
      accounts_restored: restored,
      accounts_soft_deleted: softDeleted,
    },
    "Item accounts reconciled with Plaid"
  );

  return { itemId: item.id, created, updated, restored, softDeleted };
}
