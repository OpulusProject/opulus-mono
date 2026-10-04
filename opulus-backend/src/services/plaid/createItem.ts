import {
  logger,
  normalizePlaidAccount,
  normalizePlaidItem,
  plaidService,
  prisma,
} from "@opulus/core";

export interface LinkAccountMetadata {
  name: string;
  mask: string | null;
}

export interface DuplicateCheckInput {
  institutionId: string | null;
  accounts: LinkAccountMetadata[];
}

export type CreateItemResult =
  | { duplicate: false; item: Awaited<ReturnType<typeof persistNewItem>> }
  | { duplicate: true; existingItemId: string };

/**
 * Exchange a Plaid public_token for an access_token and persist the Item
 * and its initial accounts.
 *
 * Per Plaid's [duplicate items guidance](https://plaid.com/docs/link/duplicate-items/):
 *
 * > Then, before requesting an access_token, examine and compare the onSuccess
 * > callback metadata to the user's existing Items. You can compare a
 * > combination of the accounts' institution_id, account name, and account
 * > mask to determine whether an end user has previously linked an account to
 * > your application. Do not exchange a public token for an access token if
 * > you detect a duplicate Item.
 *
 * The frontend forwards the Link onSuccess metadata (institution id + per-
 * account name/mask) alongside the public token. We check for a duplicate
 * *before* calling /item/public_token/exchange so we don't rotate a working
 * access token or burn an exchange on something we won't persist.
 */
export async function createItem(
  userId: string,
  publicToken: string,
  linkMetadata: DuplicateCheckInput
) {
  const duplicate = await findDuplicateItemId(userId, linkMetadata);
  if (duplicate) {
    logger.info(
      {
        user_id: userId,
        existing_item_id: duplicate,
        institution_id: linkMetadata.institutionId,
      },
      "Duplicate Item detected via Link metadata; skipping public_token exchange"
    );
    return { duplicate: true as const, existingItemId: duplicate };
  }

  const exchange = await plaidService.exchangePublicToken(publicToken);
  const item = await persistNewItem(userId, exchange.access_token);
  return { duplicate: false as const, item };
}

/**
 * Returns the id of a persisted Item that matches the Link metadata, or null.
 *
 * Match criteria: same user + same `institutionId` + at least one account
 * sharing both `name` and `mask`. The combo of (name, mask) is deterministic
 * on the Plaid side for a given underlying account and is what Plaid's doc
 * recommends. We only consult DB rows (no Plaid API calls).
 */
async function findDuplicateItemId(
  userId: string,
  linkMetadata: DuplicateCheckInput
): Promise<string | null> {
  if (!linkMetadata.institutionId || linkMetadata.accounts.length === 0) {
    return null;
  }

  const candidates = await prisma.item.findMany({
    where: {
      userId,
      institutionId: linkMetadata.institutionId,
    },
    select: {
      id: true,
      bankAccounts: { select: { name: true, mask: true } },
    },
  });

  for (const candidate of candidates) {
    const persistedKeys = new Set(
      candidate.bankAccounts.map((a) => `${a.name}|${a.mask ?? ""}`)
    );
    const matches = linkMetadata.accounts.some((a) =>
      persistedKeys.has(`${a.name}|${a.mask ?? ""}`)
    );
    if (matches) return candidate.id;
  }

  return null;
}

/** Exchange the public token, fetch item + institution + accounts, persist. */
async function persistNewItem(userId: string, accessToken: string) {
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
