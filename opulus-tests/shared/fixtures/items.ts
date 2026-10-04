import { uniqueId } from "../client.js";
import { testDb } from "../db.js";

/**
 * Item / bank-account fixtures.
 *
 * Items and bank accounts have NO create endpoint — they are born only from the
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
 * Seed one Item plus one linked BankAccount for a user, mirroring what the
 * webhooks link handler persists. Returns the ids the read specs need.
 */
export async function seedItemWithAccount(
  userId: string,
  overrides: Partial<{ institutionName: string; accountName: string }> = {},
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
    },
  });

  const account = await db.bankAccount.create({
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
