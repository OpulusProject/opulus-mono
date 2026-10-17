import { Queue, type JobsOptions } from "bullmq";

/**
 * The webhook queue, from the test side.
 *
 * Real webhooks arrive over HTTP with a JWT signed by Plaid, which a test
 * cannot make, so a test puts the event straight on the queue the receiver
 * feeds (the same Redis the receiver's worker reads) and watches what the
 * worker does with it. The job options are the test's: it can have a job give
 * up after two attempts and a short backoff instead of waiting 2s, 4s, 8s.
 */
let queue: Queue | undefined;

function webhookQueue(): Queue {
  queue ??= new Queue("webhooks", {
    connection: {
      host: process.env.REDIS_HOST ?? "localhost",
      port: Number(process.env.REDIS_PORT ?? 6379),
    },
  });
  return queue;
}

/** Put a webhook event on the queue. Returns the job id. */
export async function enqueueWebhook(
  event: Record<string, unknown>,
  options: JobsOptions = {},
): Promise<string> {
  const job = await webhookQueue().add(
    `process-${String(event.webhook_type).toLowerCase()}`,
    event,
    options,
  );
  return job.id as string;
}

/** The state BullMQ has a job in ("delayed" while it waits to retry). */
export async function jobState(jobId: string): Promise<string | undefined> {
  const job = await webhookQueue().getJob(jobId);
  return job ? await job.getState() : undefined;
}

/** Remove a job, so a test leaves nothing waiting in Redis. */
export async function removeJob(jobId: string): Promise<void> {
  await (await webhookQueue().getJob(jobId))?.remove();
}

/** Close the queue connection; call once when the suite ends. */
export async function closeQueue(): Promise<void> {
  await queue?.close();
  queue = undefined;
}
