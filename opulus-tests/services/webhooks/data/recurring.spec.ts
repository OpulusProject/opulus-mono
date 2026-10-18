import { expect, test } from "@playwright/test";
import { uniqueId } from "../../../shared/client.js";
import { readItemAccessToken } from "../../../shared/db.js";
import { seedItemWithAccount, seedUser, readWebhookEvents, readStreams } from "../../../shared/fixtures/index.js";
import { recurringRequests, resetPlaidStub, setPlaidRecurring } from "../../../shared/plaid-stub.js";
import { payroll, stream } from "../../../shared/scenarios/plaid-recurring.js";
import { deliverWebhook } from "../helpers/fixtures/index.js";

/** A user with one linked item and its account, and the access token the stub knows them by. */
async function linkedItem() {
  const user = await seedUser();
  const item = await seedItemWithAccount(user.id);
  return { ...item, accessToken: await readItemAccessToken(item.itemId) };
}

const recurringWebhook = (plaidItemId: string, accountIds: string[]) => ({
  webhook_type: "TRANSACTIONS",
  webhook_code: "RECURRING_TRANSACTIONS_UPDATE",
  item_id: plaidItemId,
  account_ids: accountIds,
});

/**
 * This file: what the worker does with a TRANSACTIONS RECURRING_TRANSACTIONS_UPDATE
 * webhook, which says Plaid found or changed an item's recurring payments and
 * income. The worker asks Plaid (the stub) for the item's streams and stores
 * them in place of the old ones. What it stored is read from the test DB.
 *
 * Test cases:
 * - asks Plaid about the item's accounts and stores the inflow and outflow streams it reports
 * - replaces the streams it stored before, dropping one Plaid no longer reports
 * - keeps what it had when Plaid has none to give yet
 */
test.describe("RECURRING_TRANSACTIONS_UPDATE webhooks", () => {
  test.beforeEach(async () => {
    await resetPlaidStub();
  });

  test("asks Plaid about the item's accounts and stores the inflow and outflow streams it reports", async ({ request }) => {
    // Arrange: a subscription (outflow) and a salary (inflow).
    const item = await linkedItem();
    await setPlaidRecurring({
      response: {
        inflow_streams: [payroll(item.providerAccountId, uniqueId("stream"))],
        outflow_streams: [stream(item.providerAccountId, uniqueId("stream"))],
      },
    });

    // Act
    await deliverWebhook(request, recurringWebhook(item.plaidItemId, [item.providerAccountId]));

    // Assert
    expect(await recurringRequests()).toMatchObject([{ account_ids: [item.providerAccountId] }]);
    const stored = await readStreams(item.itemId);
    expect(stored.map((s) => [s.description, s.direction, s.frequency])).toEqual([
      ["Payroll", "inflow", "BIWEEKLY"],
      ["Streaming Service", "outflow", "MONTHLY"],
    ]);
    expect(stored.map((s) => Number(s.averageAmount))).toEqual([2100, 15.99]);
  });

  test("replaces the streams it stored before, dropping one Plaid no longer reports", async ({ request }) => {
    // Arrange: two streams stored by a first update.
    const item = await linkedItem();
    const [keep, drop] = [uniqueId("stream"), uniqueId("stream")];
    await setPlaidRecurring({
      response: {
        inflow_streams: [],
        outflow_streams: [stream(item.providerAccountId, keep, { description: "Gym" }), stream(item.providerAccountId, drop, { description: "Magazine" })],
      },
    });
    await deliverWebhook(request, recurringWebhook(item.plaidItemId, [item.providerAccountId]));

    // Act: the magazine was cancelled.
    await setPlaidRecurring({
      response: { inflow_streams: [], outflow_streams: [stream(item.providerAccountId, keep, { description: "Gym" })] },
    });
    await deliverWebhook(request, { ...recurringWebhook(item.plaidItemId, [item.providerAccountId]), environment: "again" });

    // Assert
    expect((await readStreams(item.itemId)).map((s) => s.description)).toEqual(["Gym"]);
  });

  test("keeps what it had when Plaid has none to give yet", async ({ request }) => {
    // Arrange
    const item = await linkedItem();
    await setPlaidRecurring({
      response: { inflow_streams: [], outflow_streams: [stream(item.providerAccountId, uniqueId("stream"), { description: "Gym" })] },
    });
    await deliverWebhook(request, recurringWebhook(item.plaidItemId, [item.providerAccountId]));
    await setPlaidRecurring({ error_code: "PRODUCT_NOT_READY" });

    // Act
    await deliverWebhook(request, { ...recurringWebhook(item.plaidItemId, [item.providerAccountId]), environment: "again" });

    // Assert: handled in one attempt, and the stream is still there.
    expect((await readWebhookEvents(item.plaidItemId)).map((e) => [e.status, e.attempts])).toEqual([
      ["processed", 1],
      ["processed", 1],
    ]);
    expect((await readStreams(item.itemId)).map((s) => s.description)).toEqual(["Gym"]);
  });
});
