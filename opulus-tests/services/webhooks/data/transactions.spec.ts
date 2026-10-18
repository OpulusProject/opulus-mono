import { expect, test } from "@playwright/test";
import { uniqueId } from "../../../shared/client.js";
import { readItemAccessToken } from "../../../shared/db.js";
import {
  readAccountBalances,
  readItemSync,
  readSyncedTransactions,
  readWebhookEvents,
  seedItemWithAccount,
  seedUser,
} from "../../../shared/fixtures/index.js";
import { setPlaidSyncPages, syncCursorsAskedFor } from "../../../shared/plaid-stub.js";
import { plaidTransaction } from "../../../shared/scenarios/plaid-sync.js";
import { deliverWebhook } from "../helpers/fixtures/index.js";

/** A user with one linked item and its account, and the access token the stub knows them by. */
async function linkedItem() {
  const user = await seedUser();
  const item = await seedItemWithAccount(user.id);
  return { ...item, accessToken: await readItemAccessToken(item.itemId) };
}

/** `newTransactions` is in Plaid's payload; it also keeps two webhooks for one item from being taken for a repeat delivery (see plaid.spec.ts). */
const syncWebhook = (plaidItemId: string, newTransactions = 1) => ({
  webhook_type: "TRANSACTIONS",
  webhook_code: "SYNC_UPDATES_AVAILABLE",
  item_id: plaidItemId,
  new_transactions: newTransactions,
});

/**
 * This file: what the worker does with a TRANSACTIONS SYNC_UPDATES_AVAILABLE
 * webhook, which says Plaid has new transaction data. The worker asks Plaid
 * (the stub plays it: the pages it answers are set per access token) for what
 * changed since the cursor it stored, and stores the result. What it stored is
 * read from the test DB (the backend that serves it is not part of this suite).
 *
 * Test cases:
 * - stores the transactions Plaid added, with their category, and remembers where the sync got to
 * - asks from the stored cursor next time, and applies what changed since
 * - follows Plaid's pages until it has no more, in one webhook
 * - stores the balances Plaid lists with the transactions
 * - skips transactions for an account that was not shared with us
 * - leaves the item as it was when Plaid cannot sync, then syncs on the retry
 * - INITIAL_UPDATE syncs the item like SYNC_UPDATES_AVAILABLE
 * - TRANSACTIONS_REMOVED and codes it has no action for are processed without asking Plaid
 */
test.describe("TRANSACTIONS webhooks", () => {
  test("stores the transactions Plaid added, with their category, and remembers where the sync got to", async ({ request }) => {
    // Arrange
    const item = await linkedItem();
    const coffee = plaidTransaction(item.providerAccountId, { name: "Coffee", amount: 4.5 });
    const rent = plaidTransaction(item.providerAccountId, {
      name: "Rent",
      amount: 1400,
      personal_finance_category: { primary: "RENT_AND_UTILITIES", detailed: "RENT_AND_UTILITIES_RENT" },
    });
    await setPlaidSyncPages(item.accessToken, [{ added: [coffee, rent], next_cursor: "cursor-1" }]);

    // Act
    await deliverWebhook(request, syncWebhook(item.plaidItemId));

    // Assert
    expect(await readSyncedTransactions(item.itemId)).toMatchObject([
      { name: "Coffee", amount: 4.5, categoryPrimary: "FOOD_AND_DRINK", categoryDetailed: "FOOD_AND_DRINK_COFFEE", accountId: item.accountId },
      { name: "Rent", amount: 1400, categoryPrimary: "RENT_AND_UTILITIES", categoryDetailed: "RENT_AND_UTILITIES_RENT" },
    ]);
    const sync = await readItemSync(item.itemId);
    expect(sync.transactionCursor).toBe("cursor-1");
    expect(sync.syncedAt).not.toBeNull();
  });

  test("asks from the stored cursor next time, and applies what changed since: modified updated, removed deleted", async ({ request }) => {
    // Arrange: a first sync that adds three transactions.
    const item = await linkedItem();
    const [keep, change, drop] = ["Keep", "Change", "Drop"].map((name) => plaidTransaction(item.providerAccountId, { name, amount: 10 }));
    await setPlaidSyncPages(item.accessToken, [
      { added: [keep, change, drop], next_cursor: "cursor-1" },
      {
        modified: [{ ...change, name: "Changed", amount: 25 }],
        removed: [{ transaction_id: drop.transaction_id as string }],
        next_cursor: "cursor-2",
      },
    ]);
    await deliverWebhook(request, syncWebhook(item.plaidItemId, 3));

    // Act: Plaid tells us again.
    await deliverWebhook(request, syncWebhook(item.plaidItemId, 2));

    // Assert: the second sync started from the first one's cursor and applied both changes.
    expect(await syncCursorsAskedFor(item.accessToken)).toEqual([null, "cursor-1"]);
    expect(await readSyncedTransactions(item.itemId)).toMatchObject([
      { name: "Changed", amount: 25 },
      { name: "Keep", amount: 10 },
    ]);
    expect((await readItemSync(item.itemId)).transactionCursor).toBe("cursor-2");
  });

  test("follows Plaid's pages until it has no more, in one webhook", async ({ request }) => {
    // Arrange
    const item = await linkedItem();
    await setPlaidSyncPages(item.accessToken, [
      { added: [plaidTransaction(item.providerAccountId, { name: "First page" })], next_cursor: "c1", has_more: true },
      { added: [plaidTransaction(item.providerAccountId, { name: "Second page" })], next_cursor: "c2", has_more: false },
    ]);

    // Act
    await deliverWebhook(request, syncWebhook(item.plaidItemId));

    // Assert
    expect((await readSyncedTransactions(item.itemId)).map((t) => t.name)).toEqual(["First page", "Second page"]);
    expect((await readItemSync(item.itemId)).transactionCursor).toBe("c2");
  });

  test("stores the balances Plaid lists with the transactions", async ({ request }) => {
    // Arrange: the account was seeded with one balance; Plaid now reports another.
    const item = await linkedItem();
    await setPlaidSyncPages(item.accessToken, [
      {
        added: [plaidTransaction(item.providerAccountId)],
        accounts: [
          {
            account_id: item.providerAccountId,
            balances: { current: 321.5, available: 300, limit: null, iso_currency_code: "CAD", unofficial_currency_code: null },
          },
        ],
        next_cursor: "cursor-1",
      },
    ]);
    expect((await readAccountBalances(item.accountId)).current).toBe(1000);

    // Act
    await deliverWebhook(request, syncWebhook(item.plaidItemId));

    // Assert
    expect(await readAccountBalances(item.accountId)).toEqual({ current: 321.5, available: 300, limit: null });
  });

  test("skips transactions for an account that was not shared with us", async ({ request }) => {
    // Arrange
    const item = await linkedItem();
    await setPlaidSyncPages(item.accessToken, [
      {
        added: [
          plaidTransaction(item.providerAccountId, { name: "Mine" }),
          plaidTransaction(uniqueId("someone-elses-account"), { name: "Not shared" }),
        ],
        next_cursor: "cursor-1",
      },
    ]);

    // Act
    await deliverWebhook(request, syncWebhook(item.plaidItemId));

    // Assert
    expect((await readSyncedTransactions(item.itemId)).map((t) => t.name)).toEqual(["Mine"]);
  });

  test("leaves the item as it was when Plaid cannot sync, then syncs on the retry", async ({ request }) => {
    // Arrange: Plaid fails once, then answers.
    const item = await linkedItem();
    await setPlaidSyncPages(item.accessToken, [
      { error_code: "INTERNAL_SERVER_ERROR" },
      { added: [plaidTransaction(item.providerAccountId, { name: "After the retry" })], next_cursor: "cursor-1" },
    ]);

    // Act: the first attempt fails and the queue tries again after its backoff.
    await deliverWebhook(request, syncWebhook(item.plaidItemId));

    // Assert: stored once, by the second attempt.
    expect((await readSyncedTransactions(item.itemId)).map((t) => t.name)).toEqual(["After the retry"]);
    const [event] = await readWebhookEvents(item.plaidItemId);
    expect(event).toMatchObject({ status: "processed", attempts: 2 });
  });

  test("INITIAL_UPDATE syncs the item like SYNC_UPDATES_AVAILABLE", async ({ request }) => {
    // Arrange
    const item = await linkedItem();
    await setPlaidSyncPages(item.accessToken, [
      { added: [plaidTransaction(item.providerAccountId, { name: "First load" })], next_cursor: "cursor-1" },
    ]);

    // Act
    await deliverWebhook(request, { ...syncWebhook(item.plaidItemId), webhook_code: "INITIAL_UPDATE" });

    // Assert
    expect((await readSyncedTransactions(item.itemId)).map((t) => t.name)).toEqual(["First load"]);
    expect((await readItemSync(item.itemId)).transactionCursor).toBe("cursor-1");
  });

  for (const webhook_code of ["TRANSACTIONS_REMOVED", "SOMETHING_NEW"]) {
    test(`${webhook_code} is processed without asking Plaid (a sync covers removals)`, async ({ request }) => {
      // Arrange: Plaid has a page waiting, which would be stored if it were asked.
      const item = await linkedItem();
      await setPlaidSyncPages(item.accessToken, [
        { added: [plaidTransaction(item.providerAccountId)], next_cursor: "cursor-1" },
      ]);

      // Act
      await deliverWebhook(request, { ...syncWebhook(item.plaidItemId), webhook_code });

      // Assert
      expect(await syncCursorsAskedFor(item.accessToken)).toEqual([]);
      expect(await readSyncedTransactions(item.itemId)).toEqual([]);
      expect(await readWebhookEvents(item.plaidItemId)).toMatchObject([{ status: "processed", attempts: 1 }]);
    });
  }
});
