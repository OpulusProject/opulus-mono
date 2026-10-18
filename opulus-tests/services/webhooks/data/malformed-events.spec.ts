import { expect, test } from "@playwright/test";
import { uniqueId } from "../../../shared/client.js";
import {
  readItemStatus,
  readSyncedTransactions,
  readWebhookEvents,
  seedLinkedItem,
  waitForWebhookEvents,
  waitForWebhookEventWithPayload,
} from "../../../shared/fixtures/index.js";
import { resetPlaidStub, setPlaidSyncPages } from "../../../shared/plaid-stub.js";
import { closeQueue, enqueueWebhook } from "../helpers/queue.js";
import { deliverWebhook } from "../helpers/fixtures/index.js";

/**
 * This file: webhooks the worker cannot do anything with, and what it records
 * (a dead event with the reason, never a stored half-result). They are put on
 * the queue directly, for one attempt: a real webhook names its item and carries
 * valid fields, so none of these can be sent through the signed route.
 *
 * Test cases:
 * - a TRANSACTIONS, HOLDINGS, LIABILITIES, ITEM or RECURRING_TRANSACTIONS_UPDATE webhook without an item id fails with that reason
 * - an unexpected error while syncing is reported as a failed sync, with what went wrong
 * - an ITEM webhook with a consent time that is not a date fails, and records nothing
 * - a LIABILITIES webhook code it has no action for is processed without asking Plaid
 */
test.describe("webhooks the worker cannot act on", () => {
  test.beforeEach(async () => {
    await resetPlaidStub();
  });

  test.afterAll(async () => {
    await closeQueue();
  });

  const withoutItem: [string, string][] = [
    ["TRANSACTIONS", "SYNC_UPDATES_AVAILABLE"],
    ["TRANSACTIONS", "RECURRING_TRANSACTIONS_UPDATE"],
    ["HOLDINGS", "DEFAULT_UPDATE"],
    ["LIABILITIES", "DEFAULT_UPDATE"],
    ["ITEM", "ERROR"],
  ];
  for (const [webhook_type, webhook_code] of withoutItem) {
    test(`a ${webhook_type} ${webhook_code} webhook without an item id fails with that reason`, async () => {
      // Arrange: with no item id, a field of the test's own tells its event from the others.
      const marker = uniqueId("marker");

      // Act
      await enqueueWebhook({ webhook_type, webhook_code, environment: marker }, { attempts: 1 });

      // Assert
      const dead = await waitForWebhookEventWithPayload("environment", marker, "dead");
      expect(dead.error).toContain("item_id is required");
    });
  }

  test("an unexpected error while syncing is reported as a failed sync, with what went wrong", async () => {
    // Arrange: Plaid answers a page that is not what its API promises.
    const item = await seedLinkedItem();
    await setPlaidSyncPages(item.accessToken, [{ added: [null as never], next_cursor: "c1" }]);

    // Act
    await enqueueWebhook(
      { webhook_type: "TRANSACTIONS", webhook_code: "SYNC_UPDATES_AVAILABLE", item_id: item.plaidItemId },
      { attempts: 1 },
    );

    // Assert: dead, with the reason; nothing stored.
    const [dead] = await waitForWebhookEvents(item.plaidItemId, "dead");
    expect(dead!.error).toContain("Failed to sync transactions");
    expect(await readSyncedTransactions(item.itemId)).toEqual([]);
  });

  test("an ITEM webhook with a consent time that is not a date fails, and records nothing", async () => {
    // Arrange
    const item = await seedLinkedItem();

    // Act
    await enqueueWebhook(
      { webhook_type: "ITEM", webhook_code: "PENDING_EXPIRATION", item_id: item.plaidItemId, consent_expiration_time: "next tuesday" },
      { attempts: 1 },
    );

    // Assert
    await waitForWebhookEvents(item.plaidItemId, "dead");
    expect(await readItemStatus(item.itemId)).toMatchObject({ errorCode: null, consentExpirationTime: null });
  });

  test("a LIABILITIES webhook code it has no action for is processed without asking Plaid", async ({ request }) => {
    // Arrange
    const item = await seedLinkedItem();

    // Act
    await deliverWebhook(request, { webhook_type: "LIABILITIES", webhook_code: "SOMETHING_NEW", item_id: item.plaidItemId });

    // Assert
    expect(await readWebhookEvents(item.plaidItemId)).toMatchObject([{ status: "processed", attempts: 1 }]);
  });
});
