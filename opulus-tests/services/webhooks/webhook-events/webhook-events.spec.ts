import { expect, test } from "@playwright/test";
import { uniqueId } from "../../../shared/client.js";
import { readItemAccessToken } from "../../../shared/db.js";
import {
  readWebhookEvents,
  seedItemWithAccount,
  seedUser,
  waitForWebhookEvents,
} from "../../../shared/fixtures/index.js";
import { setPlaidSyncPages } from "../../../shared/plaid-stub.js";
import {
  closeQueue,
  enqueueWebhook,
  jobState,
  removeJob,
} from "../helpers/queue.js";
import { runWebhooksScript } from "../helpers/script.js";

/** A TRANSACTIONS webhook for an item whose sync Plaid always fails: its handler always fails. */
async function failingEvent() {
  const user = await seedUser();
  const item = await seedItemWithAccount(user.id);
  await setPlaidSyncPages(
    await readItemAccessToken(item.itemId),
    Array.from({ length: 10 }, () => ({ error_code: "INTERNAL_SERVER_ERROR" })),
  );
  return {
    itemId: item.plaidItemId,
    event: { webhook_type: "TRANSACTIONS", webhook_code: "SYNC_UPDATES_AVAILABLE", item_id: item.plaidItemId },
  };
}

/** A webhook of a type we do not handle: the worker logs it and finishes. */
const unhandledEvent = (itemId: string) => ({
  webhook_type: "AUTH",
  webhook_code: "AUTOMATICALLY_VERIFIED",
  item_id: itemId,
});

const replay = (eventId: string) => runWebhooksScript("replay", [eventId]);

/**
 * This file: the audit trail of webhooks. The jobs are put on the queue directly
 * (a real webhook needs a JWT signed by Plaid), with a short backoff, and what
 * the worker recorded is read from the test DB. Each test uses its own item id,
 * so the events it looks at are only its own.
 */
test.describe("webhook events", () => {
  test.afterAll(async () => {
    await closeQueue();
  });

  test("records a webhook the worker handled, with the whole event", async () => {
    // Arrange
    const itemId = uniqueId("item");
    const event = unhandledEvent(itemId);

    // Act
    const jobId = await enqueueWebhook(event);
    const [recorded] = await waitForWebhookEvents(itemId, "processed");

    // Assert
    expect(recorded).toMatchObject({
      source: "plaid",
      jobId,
      webhookType: "AUTH",
      webhookCode: "AUTOMATICALLY_VERIFIED",
      plaidItemId: itemId,
      payload: event,
      status: "processed",
      attempts: 1,
      error: null,
      replayedAt: null,
    });
    expect(recorded.processedAt).not.toBeNull();
    expect(recorded.receivedAt.getTime()).toBeLessThanOrEqual(recorded.processedAt!.getTime());
  });

  test("marks a job dead once its attempts are used up, with why it failed", async () => {
    // Arrange
    const { itemId, event } = await failingEvent();

    // Act: two attempts, 100ms apart, both fail.
    await enqueueWebhook(event, { attempts: 2, backoff: { type: "fixed", delay: 100 } });
    const [dead] = await waitForWebhookEvents(itemId, "dead");

    // Assert
    expect(dead).toMatchObject({ webhookType: "TRANSACTIONS", plaidItemId: itemId, attempts: 2, payload: event, replayedAt: null });
    expect(dead.error!.length).toBeGreaterThan(0);
    expect(dead.processedAt).not.toBeNull();
  });

  test("keeps one event for all of a job's attempts", async () => {
    // Arrange
    const { itemId, event } = await failingEvent();

    // Act
    await enqueueWebhook(event, { attempts: 3, backoff: { type: "fixed", delay: 100 } });
    await waitForWebhookEvents(itemId, "dead");
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Assert
    expect(await readWebhookEvents(itemId)).toHaveLength(1);
  });

  test("shows a job that failed but will run again as retrying, not dead", async () => {
    // Arrange: a long backoff, so after the first failed attempt the job waits.
    const { itemId, event } = await failingEvent();
    const jobId = await enqueueWebhook(event, { attempts: 3, backoff: { type: "fixed", delay: 60_000 } });

    // Act: wait for the first attempt to fail and the job to be put off.
    for (let i = 0; i < 100 && (await jobState(jobId)) !== "delayed"; i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const [retrying] = await waitForWebhookEvents(itemId, "retrying");

    // Assert
    expect(await jobState(jobId)).toBe("delayed");
    expect(retrying).toMatchObject({ attempts: 1, processedAt: null });
    expect(retrying.error!.length).toBeGreaterThan(0);

    // Cleanup: do not leave the job waiting in Redis.
    await removeJob(jobId);
  });

  test("replays a dead event once, and says why when asked again", async () => {
    // Arrange
    const { itemId, event } = await failingEvent();
    await enqueueWebhook(event, { attempts: 1 });
    const [dead] = await waitForWebhookEvents(itemId, "dead");

    // Act
    const first = await replay(dead.id);
    const second = await replay(dead.id);

    // Assert: the first puts it back on the queue and marks it replayed...
    expect(first.code).toBe(0);
    expect(first.output).toContain(`Replayed webhook event ${dead.id}`);
    const events = await readWebhookEvents(itemId);
    expect(events.find((e) => e.id === dead.id)!.replayedAt).not.toBeNull();
    // ...the new job fails too and is recorded as an event of its own...
    expect(await waitForWebhookEvents(itemId, "dead", 2)).toHaveLength(2);
    // ...and the second replay is refused.
    expect(second.code).not.toBe(0);
    expect(second.output).toContain("already replayed");
  });

  test("refuses to replay an event that was handled", async () => {
    // Arrange
    const itemId = uniqueId("item");
    await enqueueWebhook(unhandledEvent(itemId));
    const [processed] = await waitForWebhookEvents(itemId, "processed");

    // Act
    const result = await replay(processed.id);

    // Assert
    expect(result.code).not.toBe(0);
    expect(result.output).toContain("is not dead (it is processed)");
  });

  test("refuses to replay an event that does not exist", async () => {
    const result = await replay("no-such-event");

    expect(result.code).not.toBe(0);
    expect(result.output).toContain("No webhook event with id no-such-event");
  });
});
