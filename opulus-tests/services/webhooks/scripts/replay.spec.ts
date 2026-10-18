import { expect, test } from "@playwright/test";
import { readItemAccessToken } from "../../../shared/db.js";
import {
  readSyncedTransactions,
  readWebhookEvents,
  seedItemWithAccount,
  seedUser,
  waitForWebhookEvents,
} from "../../../shared/fixtures/index.js";
import { resetPlaidStub, setPlaidSyncPages } from "../../../shared/plaid-stub.js";
import { plaidTransaction } from "../../../shared/scenarios/plaid-sync.js";
import { closeQueue, enqueueWebhook } from "../helpers/queue.js";
import { runWebhooksScript } from "../helpers/script.js";

/**
 * This file: the replay script, which an operator runs to put a dead webhook
 * event back on the queue after a fix or an outage. (Refusing an event that was
 * handled, that does not exist or was already replayed is in
 * webhook-events/webhook-events.spec.ts.)
 *
 * Test cases:
 * - says how to use it, and does nothing, when no event id is given
 * - runs a replayed event again, and once the cause is fixed it is handled
 */
test.describe("replay script", () => {
  test.beforeEach(async () => {
    await resetPlaidStub();
  });

  test.afterAll(async () => {
    await closeQueue();
  });

  test("says how to use it, and does nothing, when no event id is given", async () => {
    const result = await runWebhooksScript("replay");

    expect(result.code).not.toBe(0);
    expect(result.output).toContain("Usage: pnpm --filter @opulus/webhooks replay <webhookEventId>");
  });

  test("runs a replayed event again, and once the cause is fixed it is handled", async () => {
    // Arrange: Plaid fails the item's sync once, so the event dies on its only attempt.
    const user = await seedUser();
    const item = await seedItemWithAccount(user.id);
    await setPlaidSyncPages(await readItemAccessToken(item.itemId), [
      { error_code: "INTERNAL_SERVER_ERROR" },
      { added: [plaidTransaction(item.providerAccountId, { name: "After the fix" })], next_cursor: "cursor-1" },
    ]);
    await enqueueWebhook(
      { webhook_type: "TRANSACTIONS", webhook_code: "SYNC_UPDATES_AVAILABLE", item_id: item.plaidItemId },
      { attempts: 1 },
    );
    const [dead] = await waitForWebhookEvents(item.plaidItemId, "dead");
    expect(await readSyncedTransactions(item.itemId)).toEqual([]);

    // Act
    const result = await runWebhooksScript("replay", [dead.id]);

    // Assert: the replay is a new event of its own, handled this time, and the sync happened.
    expect(result.code).toBe(0);
    await waitForWebhookEvents(item.plaidItemId, "processed");
    expect((await readWebhookEvents(item.plaidItemId)).map((e) => e.status).sort()).toEqual(["dead", "processed"]);
    expect((await readSyncedTransactions(item.itemId)).map((t) => t.name)).toEqual(["After the fix"]);
  });
});
