import {
  logger,
  normalizePlaidAccount,
  normalizePlaidItem,
  plaidService,
  prisma,
} from "@opulus/core";

/**
 * Exchange a Plaid public token for an access token and persist the Item
 * and its initial accounts.
 *
 * Idempotent on `plaidItemId`: if the Item already exists (e.g. the user
 * re-linked the same institution/login), we refresh the stored access token
 * — Plaid issues a new one on each successful exchange and invalidates the
 * previous one — and return the existing Item without touching accounts.
 */
export async function createItemForUser(userId: string, publicToken: string) {
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

  return prisma.$transaction(async (tx) => {
    const existing = await tx.item.findUnique({
      where: { plaidItemId: itemData.plaidItemId },
    });

    if (existing) {
      const updated = await tx.item.update({
        where: { id: existing.id },
        data: { accessToken },
      });
      logger.info(
        { plaid_item_id: itemData.plaidItemId, item_id: existing.id },
        "Item already exists; refreshed access token (idempotent re-link)"
      );
      return updated;
    }

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
