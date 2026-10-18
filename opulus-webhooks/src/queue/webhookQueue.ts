import { logger, redisConnection } from "@opulus/core";
import {
  Queue,
  UnrecoverableError,
  Worker,
  type Job,
} from "bullmq";
import {
  eventFailed,
  eventProcessed,
  eventStarted,
} from "../services/webhookEvents.js";
import type { PlaidWebhookEvent } from "../types/plaid/webhookSchema.js";

/**
 * Webhook handler function type
 */
export type WebhookHandler = (
  webhook_code: string,
  event: PlaidWebhookEvent
) => Promise<void>;

/**
 * Webhook queue for processing Plaid webhook events
 * Stores events temporarily and processes them asynchronously with retry support
 */
export const webhookQueue = new Queue<PlaidWebhookEvent>("webhooks", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3, // Retry failed jobs 3 times
    backoff: {
      type: "exponential",
      delay: 2000, // Start with 2 seconds, then 4s, then 8s
    },
    removeOnComplete: {
      age: 3600 * 24, // Keep completed jobs for 24 hours
      count: 1000, // Keep last 1000 completed jobs
    },
    removeOnFail: {
      age: 3600 * 24 * 7, // Keep failed jobs for 7 days
    },
  },
});

/**
 * Create and start webhook worker with handlers
 * Handlers are provided directly, eliminating the need for setWebhookHandlers()
 *
 * @param handlers - Webhook handlers for ITEM, LIABILITIES, and TRANSACTIONS events
 * @returns Worker instance
 */
export function createWebhookWorker(handlers: {
  handleHoldingsWebhook: WebhookHandler;
  handleInvestmentsTransactionsWebhook: WebhookHandler;
  handleItemWebhook: WebhookHandler;
  handleLiabilitiesWebhook: WebhookHandler;
  handleTransactionsWebhook: WebhookHandler;
}): Worker<PlaidWebhookEvent> {
  const {
    handleHoldingsWebhook,
    handleInvestmentsTransactionsWebhook,
    handleItemWebhook,
    handleLiabilitiesWebhook,
    handleTransactionsWebhook,
  } = handlers;

  const worker = new Worker<PlaidWebhookEvent>(
    "webhooks",
    async (job) => {
      const event = job.data;
      const { webhook_type, webhook_code } = event;
      const jobStartTime = Date.now();

      // Log job processing started
      logger.info(
        {
          job_id: job.id,
          webhook_type,
          webhook_code,
          attempt: job.attemptsMade + 1,
          max_attempts: job.opts.attempts || 3,
        },
        "Webhook job processing started"
      );
      // The audit trail: this attempt is recorded before it runs.
      await eventStarted(job);

      try {
        // Route to appropriate handler based on webhook type
        switch (webhook_type) {
          case "HOLDINGS":
            await handleHoldingsWebhook(webhook_code, event);
            break;
          case "INVESTMENTS_TRANSACTIONS":
            await handleInvestmentsTransactionsWebhook(webhook_code, event);
            break;
          case "ITEM":
            await handleItemWebhook(webhook_code, event);
            break;
          case "LIABILITIES":
            await handleLiabilitiesWebhook(webhook_code, event);
            break;
          case "TRANSACTIONS":
            await handleTransactionsWebhook(webhook_code, event);
            break;
          default:
            logger.warn(
              {
                job_id: job.id,
                webhook_type,
                webhook_code,
              },
              "Unhandled webhook type"
            );
        }

        await eventProcessed(job);

        // Log job completed successfully
        logger.info(
          {
            job_id: job.id,
            webhook_type,
            webhook_code,
            duration_ms: Date.now() - jobStartTime,
          },
          "Webhook job completed successfully"
        );
      } catch (error) {
        // Log job failed
        logger.error(
          {
            job_id: job.id,
            webhook_type,
            webhook_code,
            attempt: job.attemptsMade + 1,
            error_type: error instanceof Error ? error.constructor.name : typeof error,
            error_message: error instanceof Error ? error.message : String(error),
            error_stack: error instanceof Error ? error.stack : undefined,
            will_retry: job.attemptsMade < (job.opts.attempts || 3),
            duration_ms: Date.now() - jobStartTime,
          },
          "Webhook job failed"
        );
        throw error; // Re-throw to trigger BullMQ retry
      }
    },
    {
      connection: redisConnection,
      concurrency: 5, // Process up to 5 jobs concurrently
      limiter: {
        max: 10, // Max 10 jobs
        duration: 1000, // Per second
      },
    }
  );

  // The worker emits "failed" after every failed attempt. Each is recorded;
  // only a job that will not run again is final (dead, and replayable).
  worker.on("failed", (job, error) => {
    if (!job) return;
    void eventFailed(job, error, isTerminalFailure(job, error));
  });

  return worker;
}

/**
 * Whether a failed job will not run again: its attempts are used up, or it
 * failed with an UnrecoverableError, which BullMQ never retries.
 */
export function isTerminalFailure(
  job: Pick<Job, "attemptsMade" | "opts">,
  error: Error
): boolean {
  return (
    error instanceof UnrecoverableError ||
    job.attemptsMade >= (job.opts.attempts ?? 1)
  );
}

/**
 * Gracefully shutdown queue and worker
 * Call this when shutting down the application
 */
export async function shutdownQueue(
  worker: Worker<PlaidWebhookEvent>
): Promise<void> {
  await worker.close();
  await webhookQueue.close();
}
