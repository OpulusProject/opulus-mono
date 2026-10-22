import { encryptItemToken } from "@opulus/core";
import { uniqueId } from "../client.js";
import { readItemAccessToken, testDb } from "../db.js";
import { seedUser } from "./users.js";

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
  /** Plaid's id for the account, which streams, holdings and liabilities refer to. */
  providerAccountId: string;
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
      accessToken: encryptItemToken(uniqueId("access")),
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
    providerAccountId: account.providerAccountId,
    accountName,
    institutionName,
  };
}

/**
 * Add another account to an item `seedItemWithAccount` made (a second account of
 * the same institution). Returns the ids a spec needs.
 */
export async function seedAccountOnItem(params: {
  userId: string;
  itemId: string;
  name?: string;
  /** Plaid's account id; unique by default. */
  providerAccountId?: string;
  /** Plaid's persistent id for the account, if the institution gives one. */
  persistentAccountId?: string | null;
}): Promise<{ accountId: string; providerAccountId: string }> {
  const account = await testDb().account.create({
    data: {
      providerAccountId: params.providerAccountId ?? uniqueId("acct"),
      persistentAccountId: params.persistentAccountId ?? null,
      itemId: params.itemId,
      userId: params.userId,
      name: params.name ?? uniqueId("Savings"),
      type: "depository",
      subtype: "savings",
      mask: "1111",
      balanceCurrent: 500,
      balanceAvailable: 500,
      isoCurrencyCode: "CAD",
    },
  });
  return { accountId: account.id, providerAccountId: account.providerAccountId };
}

/**
 * Seed an item that has no accounts, as one is left when the user stops sharing
 * the last of them. Returns the ids a spec needs.
 */
export async function seedItemWithoutAccounts(
  userId: string,
  overrides: Partial<{ errorType: string | null; errorCode: string | null }> = {},
): Promise<{ itemId: string; plaidItemId: string }> {
  const item = await testDb().item.create({
    data: {
      plaidItemId: uniqueId("plaid_item"),
      userId,
      accessToken: encryptItemToken(uniqueId("access")),
      institutionId: uniqueId("ins"),
      institutionName: uniqueId("Bank"),
      updateType: "background",
      availableProducts: ["transactions"],
      billedProducts: ["transactions"],
      products: ["transactions"],
      ...overrides,
    },
  });
  return { itemId: item.id, plaidItemId: item.plaidItemId };
}

/** Whether an account is still stored. */
export async function accountExists(accountId: string): Promise<boolean> {
  return (await testDb().account.count({ where: { id: accountId } })) > 0;
}

/** An account's stored Plaid id (it changes when Plaid gives the account a new one). */
export async function readProviderAccountId(accountId: string): Promise<string> {
  const { providerAccountId } = await testDb().account.findUniqueOrThrow({
    where: { id: accountId },
    select: { providerAccountId: true },
  });
  return providerAccountId;
}

/** How much is stored for an account: the data that goes when the account does. */
export async function countAccountData(accountId: string) {
  const db = testDb();
  const where = { accountId };
  const [transactions, holdings, investmentTransactions, liabilities, streams] = await Promise.all([
    db.transaction.count({ where }),
    db.holding.count({ where }),
    db.investmentTransaction.count({ where }),
    db.accountLiability.count({ where }),
    db.recurringStream.count({ where }),
  ]);
  return { transactions, holdings, investmentTransactions, liabilities, streams };
}

/**
 * What the worker recorded about an item's connection status, read from the
 * ISOLATED test DB (the webhook suite does not run the backend that serves it).
 */
export async function readItemStatus(itemId: string) {
  return testDb().item.findUniqueOrThrow({
    where: { id: itemId },
    select: {
      id: true,
      errorType: true,
      errorCode: true,
      errorMessage: true,
      displayMessage: true,
      newAccountsAvailable: true,
      consentExpirationTime: true,
    },
  });
}

/** How many of these items are still in the database. */
export async function countItems(itemIds: string[]): Promise<number> {
  return testDb().item.count({ where: { id: { in: itemIds } } });
}

/** Where an item's transaction sync stands (the cursor it will ask from next, when it last succeeded). */
export async function readItemSync(itemId: string) {
  return testDb().item.findUniqueOrThrow({
    where: { id: itemId },
    select: { transactionCursor: true, syncedAt: true },
  });
}

/** An account's balances, as the last sync left them. */
export async function readAccountBalances(accountId: string) {
  const account = await testDb().account.findUniqueOrThrow({ where: { id: accountId } });
  return {
    current: account.balanceCurrent === null ? null : Number(account.balanceCurrent),
    available: account.balanceAvailable === null ? null : Number(account.balanceAvailable),
    limit: account.balanceLimit === null ? null : Number(account.balanceLimit),
  };
}


/**
 * A user with one linked item and its account, and the access token the Plaid
 * stub knows the item by (to queue the pages `/transactions/sync` answers).
 */
export async function seedLinkedItem() {
  const user = await seedUser();
  const item = await seedItemWithAccount(user.id);
  return { ...item, userId: user.id, accessToken: await readItemAccessToken(item.itemId) };
}
