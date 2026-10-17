import { expect, test } from "@playwright/test";
import type { PurgeWebhookEventsResult } from "@opulus/core";
import { uniqueId } from "../../../shared/client.js";
import { readWebhookEvents, seedWebhookEvent } from "../../../shared/fixtures/index.js";
import { runToEnd } from "../../../shared/scheduler.js";

const JOB = "purge-webhook-events";
const DAY_MS = 24 * 60 * 60 * 1000;

/** A moment this many days ago. */
const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS);

/**
 * This file: the purge-webhook-events job, run through the scheduler. It checks
 * which rows of webhook_event are left (read from the test database: a job's
 * work has no other place to be seen). The table is shared with other specs, so
 * each test seeds events under an item id of its own and looks only at those;
 * the counts the job reports are not asserted for the same reason.
 */
test.describe("purge-webhook-events (job)", () => {
  test("deletes a handled event after 90 days and keeps a newer one", async ({ request }) => {
    // Arrange
    const itemId = uniqueId("item");
    await seedWebhookEvent({ plaidItemId: itemId, status: "processed", receivedAt: daysAgo(95) });
    const fresh = await seedWebhookEvent({ plaidItemId: itemId, status: "processed", receivedAt: daysAgo(85) });

    // Act
    const run = await runToEnd(request, JOB);

    // Assert
    expect(run.state).toBe("completed");
    expect((await readWebhookEvents(itemId)).map((e) => e.id)).toEqual([fresh.id]);
  });

  test("keeps a dead event for a year, longer than a handled one", async ({ request }) => {
    // Arrange: both are 120 days old; only the handled one is past its limit.
    const itemId = uniqueId("item");
    await seedWebhookEvent({ plaidItemId: itemId, status: "processed", receivedAt: daysAgo(120) });
    const dead = await seedWebhookEvent({ plaidItemId: itemId, status: "dead", receivedAt: daysAgo(120) });

    // Act
    await runToEnd(request, JOB);

    // Assert
    expect((await readWebhookEvents(itemId)).map((e) => e.id)).toEqual([dead.id]);
  });

  test("deletes an event that is not handled once it is over a year old", async ({ request }) => {
    // Arrange: one of each status that is not "processed".
    const itemId = uniqueId("item");
    for (const status of ["processing", "retrying", "dead"] as const) {
      await seedWebhookEvent({ plaidItemId: itemId, status, receivedAt: daysAgo(370) });
    }
    const recent = await seedWebhookEvent({ plaidItemId: itemId, status: "dead", receivedAt: daysAgo(360) });

    // Act
    await runToEnd(request, JOB);

    // Assert
    expect((await readWebhookEvents(itemId)).map((e) => e.id)).toEqual([recent.id]);
  });

  test("reports the cut-off days and is harmless to run again", async ({ request }) => {
    // Act
    const first = await runToEnd(request, JOB);
    const second = await runToEnd(request, JOB);

    // Assert
    const result = first.result as PurgeWebhookEventsResult;
    expect(result.processedBefore).toBe(new Date(Date.now() - 90 * DAY_MS).toISOString().slice(0, 10));
    expect(result.otherBefore).toBe(new Date(Date.now() - 365 * DAY_MS).toISOString().slice(0, 10));
    expect(second.state).toBe("completed");
    expect((second.result as PurgeWebhookEventsResult).processedDeleted).toBe(0);
  });
});
