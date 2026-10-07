import { uniqueId } from "../client.js";
import { testDb } from "../db.js";

/**
 * Item / account fixtures.
 *
 * Items and accounts have NO create endpoint — they are born only from the
 * Plaid webhook → exchange → DB write path. Per the service-api-tests skill,
 * resources with no create endpoint are seeded directly into an ISOLATED test DB
 * (see helpers/db.ts); verification always happens over HTTP. Payload shapes
 * mirror what the webhooks link handler persists.
 */

export interface SeededItem {
  itemId: string;
  plaidItemId: string;
  accountId: string;
  accountName: string;
  institutionName: string;
}

/**
 * Seed one Item plus one linked Account for a user, mirroring what the
 * webhooks link handler persists. Returns the ids the read specs need.
 */
export async function seedItemWithAccount(
  userId: string,
  overrides: Partial<{
    institutionName: string;
    accountName: string;
    errorType: string | null;
    errorCode: string | null;
    errorMessage: string | null;
    displayMessage: string | null;
    newAccountsAvailable: boolean;
    syncedAt: Date | null;
    /** Overrides for the seeded account (defaults to a CAD checking account). */
    account: Partial<{
      officialName: string | null;
      type: string;
      subtype: string | null;
      mask: string | null;
      balanceCurrent: number | null;
      balanceAvailable: number | null;
      balanceLimit: number | null;
      isoCurrencyCode: string | null;
    }>;
  }> = {},
): Promise<SeededItem> {
  const db = testDb();
  const institutionName = overrides.institutionName ?? uniqueId("Bank");
  const accountName = overrides.accountName ?? uniqueId("Checking");

  const item = await db.item.create({
    data: {
      plaidItemId: uniqueId("plaid_item"),
      userId,
      accessToken: uniqueId("access"),
      institutionId: uniqueId("ins"),
      institutionName,
      updateType: "background",
      availableProducts: ["transactions"],
      billedProducts: ["transactions"],
      products: ["transactions"],
      ...(overrides.errorType !== undefined
        ? { errorType: overrides.errorType }
        : {}),
      ...(overrides.errorCode !== undefined
        ? { errorCode: overrides.errorCode }
        : {}),
      ...(overrides.errorMessage !== undefined
        ? { errorMessage: overrides.errorMessage }
        : {}),
      ...(overrides.displayMessage !== undefined
        ? { displayMessage: overrides.displayMessage }
        : {}),
      ...(overrides.newAccountsAvailable !== undefined
        ? { newAccountsAvailable: overrides.newAccountsAvailable }
        : {}),
      ...(overrides.syncedAt !== undefined
        ? { syncedAt: overrides.syncedAt }
        : {}),
    },
  });

  const account = await db.account.create({
    data: {
      providerAccountId: uniqueId("acct"),
      itemId: item.id,
      userId,
      name: accountName,
      type: "depository",
      subtype: "checking",
      mask: "0000",
      balanceCurrent: 1000,
      balanceAvailable: 950,
      isoCurrencyCode: "CAD",
      ...overrides.account,
    },
  });

  return {
    itemId: item.id,
    plaidItemId: item.plaidItemId,
    accountId: account.id,
    accountName,
    institutionName,
  };
}

/**
 * Seed one more account on an existing item (e.g. one a sandbox item got from
 * a real link), so a test can stand in for an account Plaid no longer returns.
 * Returns the ids a follow-up API read needs.
 */
export async function seedAccountForItem(params: {
  itemId: string;
  userId: string;
  name?: string;
}): Promise<{ accountId: string; accountName: string }> {
  const accountName = params.name ?? uniqueId("Extra");
  const account = await testDb().account.create({
    data: {
      providerAccountId: uniqueId("acct"),
      itemId: params.itemId,
      userId: params.userId,
      name: accountName,
      type: "depository",
      subtype: "savings",
      mask: "9999",
      balanceCurrent: 10,
      balanceAvailable: 10,
      isoCurrencyCode: "CAD",
    },
  });
  return { accountId: account.id, accountName };
}

/**
 * Give every account on an item an account id Plaid doesn't know (and drop
 * its persistent id), as if Plaid had changed all of them. Returns the
 * accounts' own ids, which don't change.
 */
export async function scrambleProviderAccountIds(
  itemId: string,
): Promise<string[]> {
  const db = testDb();
  const accounts = await db.account.findMany({ where: { itemId } });
  for (const [i, account] of accounts.entries()) {
    await db.account.update({
      where: { id: account.id },
      data: {
        providerAccountId: uniqueId(`unknown-${i}`),
        persistentAccountId: null,
      },
    });
  }
  return accounts.map((a) => a.id);
}
