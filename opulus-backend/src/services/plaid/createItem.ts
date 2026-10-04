import {
  logger,
  normalizePlaidAccount,
  normalizePlaidItem,
  plaidService,
  prisma,
} from "@opulus/core";

import { updateItemAccounts } from "./updateItemAccounts.js";

/**
 * Exchange a Plaid public_token for an access_token and persist the Item
 * and its initial accounts.
 *
 * ## Duplicate / re-link handling
 *
 * Plaid's recommendation (https://plaid.com/docs/link/duplicate-items/) is
 * that if a user re-links an institution they're already connected to, the
 * exchange will return the *same* `item_id` with a *new* `access_token`
 * (the old one is invalidated). The app should detect this and either
 * surface a "already linked" message, remove the old Item, or treat the new
 * exchange as the source of truth.
 *
 * We treat the new exchange as the source of truth:
 *   1. Refresh the stored `accessToken` so the old (now dead) token isn't
 *      used by downstream syncs.
 *   2. Delegate account reconciliation to `updateItemAccounts`, which
 *      upserts the current Plaid selection and soft-deletes anything the
 *      user de-selected on this re-link.
 *
 * Example from the review question: user initially linked 5 accounts, then
 * re-links the same institution and picks only 2. Idempotency hits, access
 * token is rotated, and `updateItemAccounts` soft-deletes the 3 omitted
 * accounts (their transactions stay for history).
 */
export async function createItem(userId: string, publicToken: string) {
  const exchange = await plaidService.exchangePublicToken(publicToken);
  const accessToken = exchange.access_token;

  const { item } = await plaidService.getItem(accessToken);

  let institution: {
    name: string;
    logo?: string | null;
    primary_color?: string | null;
  } | null = null;

  if (item.institution_id) {
    try {
      const institutionResponse = await plaidService.getInstitutionById(
        item.institution_id
      );
      institution = institutionResponse.institution;
    } catch (error) {
      logger.warn(
        {
          institution_id: item.institution_id,
          error_message:
            error instanceof Error ? error.message : String(error),
        },
        "Failed to fetch institution (optional)"
      );
    }
  }

  const accountsResponse = await plaidService.getAccounts(accessToken);
  const itemData = normalizePlaidItem(item, userId, accessToken, institution);

  const existing = await prisma.item.findUnique({
    where: { plaidItemId: itemData.plaidItemId },
  });

  if (existing) {
    const refreshed = await prisma.item.update({
      where: { id: existing.id },
      data: { accessToken },
    });
    const reconciliation = await updateItemAccounts(existing.id);
    logger.info(
      { plaid_item_id: itemData.plaidItemId, item_id: existing.id, ...reconciliation },
      "Item already exists; refreshed access token and reconciled accounts"
    );
    return refreshed;
  }

  return prisma.$transaction(async (tx) => {
    const createdItem = await tx.item.create({ data: itemData });

    for (const plaidAccount of accountsResponse.accounts) {
      const accountData = normalizePlaidAccount(
        plaidAccount,
        createdItem.id,
        userId
      );
      await tx.bankAccount.create({ data: accountData });
    }

    logger.info(
      {
        item_id: createdItem.id,
        plaid_item_id: itemData.plaidItemId,
        user_id: userId,
        accounts_count: accountsResponse.accounts.length,
      },
      "Item and accounts created"
    );

    return createdItem;
  });
}
