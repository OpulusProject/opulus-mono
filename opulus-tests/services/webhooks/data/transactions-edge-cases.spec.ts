import { expect, test } from "@playwright/test";
import {
  readItemSync,
  readSyncedTransactions,
  readWebhookEvents,
  seedLinkedItem,
  waitForWebhookEvents,
} from "../../../shared/fixtures/index.js";
import { setPlaidSyncPages, syncCursorsAskedFor } from "../../../shared/plaid-stub.js";
import { plaidTransaction } from "../../../shared/scenarios/plaid-sync.js";
import { deliverWebhook, postSignedWebhook } from "../helpers/fixtures/index.js";

const syncWebhook = (plaidItemId: string, newTransactions = 1) => ({
  webhook_type: "TRANSACTIONS",
  webhook_code: "SYNC_UPDATES_AVAILABLE",
  item_id: plaidItemId,
  new_transactions: newTransactions,
});

/**
 * This file: the awkward things Plaid's transaction sync does, and that a sync
 * is applied whole or not at all. The ordinary cases are in transactions.spec.ts.
 * Plaid is the stub (its pages are set per access token); what the worker stored
 * is read from the test DB.
 *
 * Test cases:
 * - a pending transaction is replaced by its posted version, not kept beside it
 * - a transaction added and modified in one sync is stored as modified
 * - removing a transaction we never stored changes nothing else in that sync
 * - a failure on a later page stores nothing from the earlier pages, and the retry starts again from the stored cursor
 * - a change to a transaction we do not have stores nothing from its sync and does not move the cursor
 */
test.describe("TRANSACTIONS sync edge cases", () => {
  test("a pending transaction is replaced by its posted version, not kept beside it", async ({ request }) => {
    // Arrange: a pending purchase is synced.
    const item = await seedLinkedItem();
    const pending = plaidTransaction(item.providerAccountId, { name: "Hotel", amount: 200, pending: true });
    const posted = plaidTransaction(item.providerAccountId, {
      name: "Hotel",
      amount: 204.5,
      pending: false,
      pending_transaction_id: pending.transaction_id,
    });
    await setPlaidSyncPages(item.accessToken, [
      { added: [pending], next_cursor: "c1" },
      // When it posts, Plaid removes the pending one and adds the posted one.
      { added: [posted], removed: [{ transaction_id: pending.transaction_id }], next_cursor: "c2" },
    ]);
    await deliverWebhook(request, syncWebhook(item.plaidItemId, 1));
    expect(await readSyncedTransactions(item.itemId)).toMatchObject([{ name: "Hotel", amount: 200, pending: true }]);

    // Act
    await deliverWebhook(request, syncWebhook(item.plaidItemId, 2));

    // Assert
    expect(await readSyncedTransactions(item.itemId)).toMatchObject([{ name: "Hotel", amount: 204.5, pending: false }]);
  });

  test("a transaction added and modified in one sync is stored as modified", async ({ request }) => {
    // Arrange
    const item = await seedLinkedItem();
    const added = plaidTransaction(item.providerAccountId, { name: "Original", amount: 10 });
    await setPlaidSyncPages(item.accessToken, [
      { added: [added], modified: [{ ...added, name: "Corrected", amount: 12 }], next_cursor: "c1" },
    ]);

    // Act
    await deliverWebhook(request, syncWebhook(item.plaidItemId));

    // Assert
    expect(await readSyncedTransactions(item.itemId)).toMatchObject([{ name: "Corrected", amount: 12 }]);
  });

  test("removing a transaction we never stored changes nothing else in that sync", async ({ request }) => {
    // Arrange
    const item = await seedLinkedItem();
    await setPlaidSyncPages(item.accessToken, [
      { added: [plaidTransaction(item.providerAccountId, { name: "Kept" })], removed: [{ transaction_id: "txn-we-never-had" }], next_cursor: "c1" },
    ]);

    // Act
    await deliverWebhook(request, syncWebhook(item.plaidItemId));

    // Assert
    expect((await readSyncedTransactions(item.itemId)).map((t) => t.name)).toEqual(["Kept"]);
    expect((await readItemSync(item.itemId)).transactionCursor).toBe("c1");
  });

  test("a failure on a later page stores nothing from the earlier pages, and the retry starts again from the stored cursor", async ({ request }) => {
    // Arrange: page one has more, page two fails; the retry gets both pages.
    const item = await seedLinkedItem();
    const first = plaidTransaction(item.providerAccountId, { name: "First page" });
    const second = plaidTransaction(item.providerAccountId, { name: "Second page" });
    await setPlaidSyncPages(item.accessToken, [
      { added: [first], next_cursor: "c1", has_more: true },
      { error_code: "INTERNAL_SERVER_ERROR" },
      { added: [first], next_cursor: "c1", has_more: true },
      { added: [second], next_cursor: "c2", has_more: false },
    ]);

    // Act: the first attempt fails; the queue tries again after its backoff.
    await deliverWebhook(request, syncWebhook(item.plaidItemId));

    // Assert: stored once, whole, and both attempts asked from the same stored cursor (none).
    expect((await readSyncedTransactions(item.itemId)).map((t) => t.name)).toEqual(["First page", "Second page"]);
    expect(await syncCursorsAskedFor(item.accessToken)).toEqual([null, "c1", null, "c1"]);
    expect((await readItemSync(item.itemId)).transactionCursor).toBe("c2");
    expect(await readWebhookEvents(item.plaidItemId)).toMatchObject([{ status: "processed", attempts: 2 }]);
  });

  test("a change to a transaction we do not have stores nothing from its sync and does not move the cursor", async ({ request }) => {
    // Arrange: a page that adds one transaction and modifies another that was never stored, on every attempt.
    const item = await seedLinkedItem();
    const page = {
      added: [plaidTransaction(item.providerAccountId, { name: "Would be added" })],
      modified: [plaidTransaction(item.providerAccountId, { name: "Never stored" })],
      next_cursor: "c1",
    };
    await setPlaidSyncPages(item.accessToken, [page, page, page]);

    // Act: it fails on its first attempt and is put off to retry.
    await postSignedWebhook(request, syncWebhook(item.plaidItemId));
    await waitForWebhookEvents(item.plaidItemId, "retrying");

    // Assert: all or nothing.
    expect(await readSyncedTransactions(item.itemId)).toEqual([]);
    expect((await readItemSync(item.itemId)).transactionCursor).toBeNull();
  });
});
