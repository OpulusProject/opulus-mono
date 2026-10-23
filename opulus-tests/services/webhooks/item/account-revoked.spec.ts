import { expect, test } from "@playwright/test";
import { uniqueId } from "../../../shared/client.js";
import {
  accountExists,
  countAccountData,
  countItems,
  readWebhookEvents,
  seedAccountOnItem,
  seedCreditLiability,
  seedHolding,
  seedInvestmentTransaction,
  seedItemWithAccount,
  seedStream,
  seedTransactions,
  seedUser,
} from "../../../shared/fixtures/index.js";
import { deliverWebhook } from "../helpers/fixtures/index.js";

/** A user with one linked item and two accounts on it, each with data; the ids Plaid knows them by. */
async function itemWithTwoAccounts() {
  const user = await seedUser();
  const first = await seedItemWithAccount(user.id);
  const second = await seedAccountOnItem({ userId: user.id, itemId: first.itemId });
  for (const accountId of [first.accountId, second.accountId]) {
    await seedTransactions({ userId: user.id, itemId: first.itemId, accountId, count: 2 });
    await seedHolding({ userId: user.id, itemId: first.itemId, accountId });
    await seedInvestmentTransaction({ userId: user.id, itemId: first.itemId, accountId, type: "cash", subtype: "deposit", amount: -100 });
    await seedCreditLiability({ userId: user.id, itemId: first.itemId, accountId });
    await seedStream({ userId: user.id, itemId: first.itemId, accountId });
  }
  return { userId: user.id, plaidItemId: first.plaidItemId, itemId: first.itemId, first, second };
}

const SEEDED = { transactions: 2, holdings: 1, investmentTransactions: 1, liabilities: 1, streams: 1 };
const NONE = { transactions: 0, holdings: 0, investmentTransactions: 0, liabilities: 0, streams: 0 };

/** Send a USER_ACCOUNT_REVOKED webhook, signed as Plaid signs it, and wait for the worker to finish. */
const revoke = (request: Parameters<typeof deliverWebhook>[0], plaidItemId: string, accountId?: string) =>
  deliverWebhook(request, {
    webhook_type: "ITEM",
    webhook_code: "USER_ACCOUNT_REVOKED",
    item_id: plaidItemId,
    ...(accountId ? { account_id: accountId } : {}),
  });

/**
 * This file: what the worker does with an ITEM USER_ACCOUNT_REVOKED webhook,
 * which says the user revoked access to one account at the institution. Plaid
 * says to delete what is stored for it, so the worker deletes the account and
 * everything stored for it; what is left is read from the test DB. Nothing here
 * calls Plaid: the webhook carries everything the worker needs.
 *
 * Test cases:
 * - removes the revoked account with everything stored for it, and keeps the item and its other accounts
 * - keeps the item, with no accounts, when its last account is revoked
 * - ignores a webhook that names no account, without retrying it
 * - ignores a webhook for an account we do not have, and changes nothing else
 * - ignores a webhook for an item we no longer have, without retrying it
 * - removes only the named item's account when another item has an account with the same Plaid id
 */
test.describe("ITEM USER_ACCOUNT_REVOKED webhooks", () => {
  test("removes the revoked account with everything stored for it, and keeps the item and its other accounts", async ({ request }) => {
    // Arrange
    const { plaidItemId, itemId, first, second } = await itemWithTwoAccounts();
    expect(await countAccountData(second.accountId)).toEqual(SEEDED);

    // Act
    await revoke(request, plaidItemId, second.providerAccountId);

    // Assert
    expect(await accountExists(second.accountId)).toBe(false);
    expect(await countAccountData(second.accountId)).toEqual(NONE);
    expect(await accountExists(first.accountId)).toBe(true);
    expect(await countAccountData(first.accountId)).toEqual(SEEDED);
    expect(await countItems([itemId])).toBe(1);
  });

  test("keeps the item, with no accounts, when its last account is revoked", async ({ request }) => {
    // Arrange: an item with a single account.
    const user = await seedUser();
    const item = await seedItemWithAccount(user.id);
    await seedTransactions({ userId: user.id, itemId: item.itemId, accountId: item.accountId, count: 2 });

    // Act
    await revoke(request, item.plaidItemId, item.providerAccountId);

    // Assert: the account and its data are gone; the item stays, so the user can add accounts again.
    expect(await accountExists(item.accountId)).toBe(false);
    expect(await countItems([item.itemId])).toBe(1);
  });

  test("ignores a webhook that names no account, without retrying it", async ({ request }) => {
    // Arrange
    const { plaidItemId, first, second } = await itemWithTwoAccounts();

    // Act
    await revoke(request, plaidItemId);

    // Assert: handled once (not failed and retried), and nothing removed.
    expect((await readWebhookEvents(plaidItemId)).map((e) => [e.status, e.attempts])).toEqual([["processed", 1]]);
    expect(await accountExists(first.accountId)).toBe(true);
    expect(await accountExists(second.accountId)).toBe(true);
  });

  test("ignores a webhook for an account we do not have, and changes nothing else", async ({ request }) => {
    // Arrange
    const { plaidItemId, first, second } = await itemWithTwoAccounts();

    // Act
    await revoke(request, plaidItemId, uniqueId("unknown"));

    // Assert
    expect((await readWebhookEvents(plaidItemId)).map((e) => [e.status, e.attempts])).toEqual([["processed", 1]]);
    expect(await countAccountData(first.accountId)).toEqual(SEEDED);
    expect(await countAccountData(second.accountId)).toEqual(SEEDED);
  });

  test("ignores a webhook for an item we no longer have, without retrying it", async ({ request }) => {
    // Arrange: an item id Plaid knows but we do not.
    const plaidItemId = uniqueId("plaid_item");

    // Act
    await revoke(request, plaidItemId, uniqueId("acct"));

    // Assert
    expect((await readWebhookEvents(plaidItemId)).map((e) => [e.status, e.attempts])).toEqual([["processed", 1]]);
  });

  test("removes only the named item's account when another item has an account with the same Plaid id", async ({ request }) => {
    // Arrange: two items (two users) whose accounts share a Plaid account id.
    const shared = uniqueId("shared");
    const a = await seedUser();
    const b = await seedUser();
    const itemA = await seedItemWithAccount(a.id, { account: {} });
    const itemB = await seedItemWithAccount(b.id, { account: {} });
    const accountA = await seedAccountOnItem({ userId: a.id, itemId: itemA.itemId, providerAccountId: shared });
    const accountB = await seedAccountOnItem({ userId: b.id, itemId: itemB.itemId, providerAccountId: shared });

    // Act
    await revoke(request, itemA.plaidItemId, shared);

    // Assert
    expect(await accountExists(accountA.accountId)).toBe(false);
    expect(await accountExists(accountB.accountId)).toBe(true);
  });
});
