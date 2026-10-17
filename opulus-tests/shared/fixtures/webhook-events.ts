import { testDb } from "../db.js";

/**
 * Webhook event fixtures.
 *
 * Webhook events are written by the webhooks worker as it handles jobs and have
 * no read endpoint (an operator replays dead ones from a script), so what the
 * worker kept is read from the ISOLATED test DB: the exception to "verify over
 * HTTP", as for the scheduler's jobs.
 */

/** Put an event straight into the table, as the worker would have left it. */
export async function seedWebhookEvent(params: {
  plaidItemId: string;
  status: "processing" | "processed" | "retrying" | "dead";
  receivedAt: Date;
}) {
  return testDb().webhookEvent.create({
    data: {
      jobId: `seed-${Math.random().toString(36).slice(2)}`,
      webhookType: "TRANSACTIONS",
      webhookCode: "SYNC_UPDATES_AVAILABLE",
      plaidItemId: params.plaidItemId,
      payload: { webhook_type: "TRANSACTIONS", webhook_code: "SYNC_UPDATES_AVAILABLE", item_id: params.plaidItemId },
      status: params.status,
      attempts: 1,
      receivedAt: params.receivedAt,
    },
  });
}

/** The events recorded for a Plaid item id, oldest first. */
export async function readWebhookEvents(plaidItemId: string) {
  return testDb().webhookEvent.findMany({
    where: { plaidItemId },
    orderBy: [{ receivedAt: "asc" }, { id: "asc" }],
  });
}

/** Wait until an item has `count` events in `status`, or throw. */
export async function waitForWebhookEvents(
  plaidItemId: string,
  status: string,
  count = 1,
  timeoutMs = 15_000,
) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const rows = (await readWebhookEvents(plaidItemId)).filter((row) => row.status === status);
    if (rows.length >= count) return rows;
    if (Date.now() > deadline) {
      throw new Error(
        `Expected ${count} ${status} webhook event(s) for ${plaidItemId} within ${timeoutMs}ms, found ${rows.length}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
