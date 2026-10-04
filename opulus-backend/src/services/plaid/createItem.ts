import {
  logger,
  normalizePlaidAccount,
  normalizePlaidItem,
  plaidService,
  prisma,
} from "@opulus/core";

import { findDuplicateItem } from "./findDuplicateItem.js";

export interface CreateItemInput {
  institutionId: string;
}

export async function createItem(
  userId: string,
  publicToken: string,
  input: CreateItemInput
) {
  const duplicate = await findDuplicateItem(userId, input.institutionId);
  if (duplicate) {
    logger.info(
      {
        user_id: userId,
        existing_item_id: duplicate,
        institution_id: input.institutionId,
      },
      "Duplicate Item detected; skipping public_token exchange"
    );
    return { duplicate: true as const, existingItemId: duplicate };
  }

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

  const createdItem = await prisma.$transaction(async (tx) => {
    const created = await tx.item.create({ data: itemData });

    for (const plaidAccount of accountsResponse.accounts) {
      const accountData = normalizePlaidAccount(
        plaidAccount,
        created.id,
        userId
      );
      await tx.bankAccount.create({ data: accountData });
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

  return { duplicate: false as const, item: createdItem };
}
