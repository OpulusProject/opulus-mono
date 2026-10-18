import { webhookEventRepository } from "@opulus/core";
import { expect, test } from "@playwright/test";
import {
  eventFailed,
  eventProcessed,
  eventStarted,
  replayWebhookEvent,
} from "../../../opulus-webhooks/src/services/webhookEvents.js";

type Job = Parameters<typeof eventStarted>[0];

const job = {
  id: "job-1",
  name: "process-transactions",
  timestamp: Date.UTC(2026, 9, 17),
  attemptsMade: 1,
  data: { webhook_type: "TRANSACTIONS", webhook_code: "SYNC_UPDATES_AVAILABLE", item_id: "item-1" },
} as unknown as Job;

const original = {
  start: webhookEventRepository.start,
  markProcessed: webhookEventRepository.markProcessed,
  markFailed: webhookEventRepository.markFailed,
  claimForReplay: webhookEventRepository.claimForReplay,
  releaseReplay: webhookEventRepository.releaseReplay,
};

/**
 * The webhook audit trail's failure behaviour
 * (opulus-webhooks/src/services/webhookEvents.ts). The repository is replaced
 * for each test, so a failing database is a thrown error and no database is
 * needed. The ordinary recording is in the service suite
 * (services/webhooks/webhook-events).
 *
 * Test cases:
 * - a database that cannot be written never fails the webhook: starting, finishing and failing are all best effort
 * - a replay that cannot be queued gives the claim back and says why
 * - a replay that is queued names the job it became
 */
test.describe("webhook event records", () => {
  test.afterEach(() => {
    Object.assign(webhookEventRepository, original);
  });

  test("a database that cannot be written never fails the webhook: starting, finishing and failing are all best effort", async () => {
    // Arrange
    const refuse = async () => {
      throw new Error("the database is down");
    };
    Object.assign(webhookEventRepository, { start: refuse, markProcessed: refuse, markFailed: refuse });

    // Act + Assert: none of them throws, whether or not the job will run again.
    await expect(eventStarted(job)).resolves.toBeUndefined();
    await expect(eventProcessed(job)).resolves.toBeUndefined();
    await expect(eventFailed(job, new Error("sync failed"), false)).resolves.toBeUndefined();
    await expect(eventFailed(job, new Error("sync failed"), true)).resolves.toBeUndefined();
  });

  test("a replay that cannot be queued gives the claim back and says why", async () => {
    // Arrange
    const released: string[] = [];
    Object.assign(webhookEventRepository, {
      claimForReplay: async () => ({ payload: job.data }),
      releaseReplay: async (id: string) => void released.push(id),
    });

    // Act
    const replay = replayWebhookEvent("event-1", async () => {
      throw new Error("Redis is down");
    });

    // Assert
    await expect(replay).rejects.toThrow("Redis is down");
    expect(released).toEqual(["event-1"]);
  });

  test("a replay that is queued names the job it became", async () => {
    // Arrange
    const queued: string[] = [];
    Object.assign(webhookEventRepository, { claimForReplay: async () => ({ payload: job.data }) });

    // Act
    const result = await replayWebhookEvent("event-1", async (name) => {
      queued.push(name);
      return "job-9";
    });

    // Assert
    expect(result).toMatchObject({ jobId: "job-9", event: { webhook_code: "SYNC_UPDATES_AVAILABLE" } });
    expect(queued).toEqual(["process-transactions"]);
  });
});
