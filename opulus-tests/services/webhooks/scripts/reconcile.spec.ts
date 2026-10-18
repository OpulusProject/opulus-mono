import { expect, test } from "@playwright/test";
import { readInvestmentTransactions, readItemSync, readSyncedTransactions, seedLinkedItem } from "../../../shared/fixtures/index.js";
import { resetPlaidStub, setPlaidInvestmentTransactions, setPlaidSyncPages } from "../../../shared/plaid-stub.js";
import { buy, daysAgo, transactionsAnswer } from "../../../shared/scenarios/plaid-investments.js";
import { plaidTransaction } from "../../../shared/scenarios/plaid-sync.js";
import { createEmptyDatabase } from "../helpers/emptyDatabase.js";
import { runWebhooksScript } from "../helpers/script.js";

const linkedItem = seedLinkedItem;

const reconcile = (...args: string[]) => runWebhooksScript("reconcile", args, { NODE_ENV: "production" });

/**
 * This file: the reconcile script, which an operator runs to catch items up after
 * an outage (Plaid does not replay webhooks after about a day). It syncs each
 * item's transactions from its stored cursor, then its holdings, investment
 * transactions and recurring payments, without the receiver. The script runs for real against the test
 * database and the Plaid stub; what it stored is read from the test DB.
 *
 * Test cases:
 * - catches an item up from its stored cursor and reports it
 * - brings an item's investment transactions up to date as well
 * - with --item, syncs only that item
 * - without --item, syncs every item
 * - carries on past an item that fails, and exits non-zero
 * - asks for the item id when --item has none, and syncs nothing
 * - says there is nothing to do, and succeeds, when there are no items
 */
test.describe("reconcile script", () => {
  test.beforeEach(async () => {
    await resetPlaidStub();
  });

  test("catches an item up from its stored cursor and reports it", async () => {
    // Arrange
    const item = await linkedItem();
    await setPlaidSyncPages(item.accessToken, [
      { added: [plaidTransaction(item.providerAccountId, { name: "Missed while down" })], next_cursor: "cursor-1" },
    ]);

    // Act
    const result = await reconcile("--item", item.plaidItemId);

    // Assert
    expect(result.code).toBe(0);
    expect(result.output).toContain("Reconciled item");
    expect((await readSyncedTransactions(item.itemId)).map((t) => t.name)).toEqual(["Missed while down"]);
    expect((await readItemSync(item.itemId)).transactionCursor).toBe("cursor-1");
  });

  test("brings an item's investment transactions up to date as well", async () => {
    // Arrange
    const item = await linkedItem();
    await setPlaidInvestmentTransactions(transactionsAnswer([buy(item.providerAccountId, `it_${Date.now()}`, "sec_x", daysAgo(3))], [], [item.providerAccountId]));

    // Act
    const result = await reconcile("--item", item.plaidItemId);

    // Assert
    expect(result.code).toBe(0);
    expect(await readInvestmentTransactions(item.itemId)).toHaveLength(1);
  });

  test("with --item, syncs only that item", async () => {
    // Arrange: two items, each with a page waiting.
    const [wanted, other] = [await linkedItem(), await linkedItem()];
    for (const item of [wanted, other]) {
      await setPlaidSyncPages(item.accessToken, [{ added: [plaidTransaction(item.providerAccountId)], next_cursor: "c1" }]);
    }

    // Act
    await reconcile("--item", wanted.plaidItemId);

    // Assert
    expect(await readSyncedTransactions(wanted.itemId)).toHaveLength(1);
    expect(await readSyncedTransactions(other.itemId)).toEqual([]);
  });

  test("without --item, syncs every item", async () => {
    // Arrange
    const items = [await linkedItem(), await linkedItem()];
    for (const item of items) {
      await setPlaidSyncPages(item.accessToken, [{ added: [plaidTransaction(item.providerAccountId)], next_cursor: "c1" }]);
    }

    // Act
    await reconcile();

    // Assert
    for (const item of items) {
      expect(await readSyncedTransactions(item.itemId)).toHaveLength(1);
    }
  });

  test("carries on past an item that fails, and exits non-zero", async () => {
    // Arrange: Plaid fails the first item's sync; the second is fine.
    const failing = await linkedItem();
    const fine = await linkedItem();
    await setPlaidSyncPages(failing.accessToken, [{ error_code: "INTERNAL_SERVER_ERROR" }]);
    await setPlaidSyncPages(fine.accessToken, [{ added: [plaidTransaction(fine.providerAccountId)], next_cursor: "c1" }]);

    // Act
    const result = await reconcile();

    // Assert
    expect(result.code).not.toBe(0);
    expect(result.output).toContain("Failed to reconcile item");
    expect(await readSyncedTransactions(fine.itemId)).toHaveLength(1);
    expect(await readSyncedTransactions(failing.itemId)).toEqual([]);
  });

  test("asks for the item id when --item has none, and syncs nothing", async () => {
    // Arrange
    const item = await linkedItem();
    await setPlaidSyncPages(item.accessToken, [{ added: [plaidTransaction(item.providerAccountId)], next_cursor: "c1" }]);

    // Act
    const result = await reconcile("--item");

    // Assert
    expect(result.code).not.toBe(0);
    expect(result.output).toContain("Usage: reconcile [--item <plaidItemId>]");
    expect(await readSyncedTransactions(item.itemId)).toEqual([]);
  });

  test("says there is nothing to do, and succeeds, when there are no items", async () => {
    // Arrange: a database with no items at all.
    const empty = await createEmptyDatabase();

    try {
      // Act
      const result = await runWebhooksScript("reconcile", [], { NODE_ENV: "production", DATABASE_URL: empty.url });

      // Assert
      expect(result.code).toBe(0);
      expect(result.output).toContain("No items to reconcile");
    } finally {
      await empty.drop();
    }
  });
});
