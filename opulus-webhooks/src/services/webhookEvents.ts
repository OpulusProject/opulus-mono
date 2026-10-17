import { logger, webhookEventRepository } from "@opulus/core";
import type { Job } from "bullmq";
import type { PlaidWebhookEvent } from "../types/plaid/webhookSchema.js";

/** The queue job's identity for the event table: its id and when it was queued. */
function jobKey(job: Pick<Job, "id" | "timestamp">) {
  return { jobId: String(job.id), receivedAt: new Date(job.timestamp) };
}

/**
 * The audit trail of handled webhooks. Every function is best effort: if the
 * database cannot be written that is logged, never thrown, so a database problem
 * cannot also fail the webhook or take the worker down.
 */
async function bestEffort(
  what: string,
  job: Pick<Job, "id" | "name">,
  write: () => Promise<unknown>
): Promise<void> {
  try {
    await write();
  } catch (error) {
    logger.error(
      {
        job_id: job.id,
        job_name: job.name,
        error_message: error instanceof Error ? error.message : String(error),
      },
      `Failed to ${what}`
    );
  }
}

/** A job is about to run (its first attempt, or a retry). */
export function eventStarted(job: Job<PlaidWebhookEvent>) {
  const event = job.data;
  return bestEffort("record a webhook event", job, () =>
    webhookEventRepository.start({
      ...jobKey(job),
      webhookType: event.webhook_type,
      webhookCode: event.webhook_code,
      plaidItemId: event.item_id,
      payload: event,
      attempt: job.attemptsMade + 1,
    })
  );
}

/** A job ran to the end. */
export function eventProcessed(job: Job<PlaidWebhookEvent>) {
  return bestEffort("record a handled webhook event", job, () =>
    webhookEventRepository.markProcessed(jobKey(job))
  );
}

/** A job's attempt failed; `final` when it will not run again. */
export async function eventFailed(
  job: Job<PlaidWebhookEvent>,
  error: Error,
  final: boolean
) {
  await bestEffort("record a failed webhook event", job, () =>
    webhookEventRepository.markFailed(jobKey(job), {
      error: error.message,
      attempts: job.attemptsMade,
      final,
    })
  );
  if (final) {
    logger.error(
      {
        job_id: job.id,
        webhook_type: job.data.webhook_type,
        webhook_code: job.data.webhook_code,
        item_id: job.data.item_id,
        attempts: job.attemptsMade,
      },
      "Webhook job gave up"
    );
  }
}

/**
 * Put a dead event back on the queue. It is marked replayed first, so it cannot
 * be replayed twice; if queueing it fails the mark is undone.
 *
 * @param id - The event id
 * @param enqueue - Puts the event on the webhook queue; returns the job id
 * @throws NotFoundError if there is no such event
 * @throws AppError (409) if it is not dead, or was already replayed
 */
export async function replayWebhookEvent(
  id: string,
  enqueue: (name: string, event: PlaidWebhookEvent) => Promise<string | undefined>
): Promise<{ jobId: string | undefined; event: PlaidWebhookEvent }> {
  const stored = await webhookEventRepository.claimForReplay(id);
  const event = stored.payload as unknown as PlaidWebhookEvent;
  try {
    const name = `process-${event.webhook_type.toLowerCase()}`;
    return { jobId: await enqueue(name, event), event };
  } catch (error) {
    await webhookEventRepository.releaseReplay(id);
    throw error;
  }
}
