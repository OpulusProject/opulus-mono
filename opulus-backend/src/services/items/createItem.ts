import {
  logger,
  normalizePlaidAccount,
  normalizePlaidItem,
  plaidGateway,
  prisma,
  trySyncItemLiabilities,
} from "@opulus/core";

import { findDuplicateItem } from "./findDuplicateItem.js";

export interface CreateItemParams {
  userId: string;
  publicToken: string;
  institutionId: string;
}

export type CreateItemResult =
  | { duplicate: true; existingItemId: string }
  | { duplicate: false; item: { id: string } };

/**
 * Connect an institution for the user: exchange Plaid Link's public token for
 * an access token, and store the item with its accounts and liabilities. If the
 * user already has an item for the institution, nothing is exchanged and the
 * existing item's id is returned.
 */
export async function createItem(
  params: CreateItemParams
): Promise<CreateItemResult> {
  const { userId, publicToken, institutionId } = params;
  const duplicate = await findDuplicateItem(userId, institutionId);
  if (duplicate) {
    logger.info(
      {
        user_id: userId,
        existing_item_id: duplicate,
        institution_id: institutionId,
      },
      "Duplicate Item detected; skipping public_token exchange"
    );
    return { duplicate: true as const, existingItemId: duplicate };
  }

  const exchange = await plaidGateway.exchangePublicToken(publicToken);
  const accessToken = exchange.access_token;

  const { item } = await plaidGateway.getItem(accessToken);

  let institution: {
    name: string;
    logo?: string | null;
    primary_color?: string | null;
  } | null = null;

  if (item.institution_id) {
    try {
      const institutionResponse = await plaidGateway.getInstitutionById(
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

  const accountsResponse = await plaidGateway.getAccounts(accessToken);
  const itemData = normalizePlaidItem(item, userId, accessToken, institution);

  const createdItem = await prisma.$transaction(async (tx) => {
    const created = await tx.item.create({ data: itemData });

    for (const plaidAccount of accountsResponse.accounts) {
      const accountData = normalizePlaidAccount(
        plaidAccount,
        created.id,
        userId
      );
      await tx.account.create({ data: accountData });
    }

    logger.info(
      {
        item_id: created.id,
        plaid_item_id: itemData.plaidItemId,
        user_id: userId,
        accounts_count: accountsResponse.accounts.length,
      },
      "Item and accounts created"
    );

    return created;
  });

  // Liabilities (APRs, due dates, loan terms) are a bonus: fetch them now, but
  // never fail linking over them. A LIABILITIES webhook refreshes them later.
  await trySyncItemLiabilities({
    id: createdItem.id,
    userId,
    accessToken,
  });

  return { duplicate: false as const, item: createdItem };
}
