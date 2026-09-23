import { logger } from "@opulus/core";
import { Queue, QueueEvents, Worker } from "bullmq";
import type { PlaidWebhookEvent } from "../types/plaid/webhookSchema.js";

/**
 * Webhook handler function type
 */
export type WebhookHandler = (
  webhook_code: string,
  event: PlaidWebhookEvent
) => Promise<void>;

/**
 * Redis connection configuration
 * Reads from environment variables with fallbacks for local development
 */
const redisConnection = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD,
  // BullMQ requires this to be null on worker connections: blocking commands
  // (BRPOPLPUSH etc.) must not be aborted mid-flight during a reconnect, or
  // in-flight jobs can be dropped/stalled. ioredis will keep retrying instead.
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  // Opt-in TLS for managed Redis providers (Upstash, Elasticache, etc.).
  ...(process.env.REDIS_TLS === "true" ? { tls: {} } : {}),
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
};

/**
 * Check Redis connection health
 * Used by health check endpoints
 */
export async function checkRedisConnection(): Promise<boolean> {
  try {
    const Redis = (await import("ioredis")).default;
    const testClient = new Redis(redisConnection);
    await testClient.ping();
    await testClient.quit();
    return true;
  } catch (error) {
    logger.error(
      {
        error_type: error instanceof Error ? error.constructor.name : typeof error,
        error_message: error instanceof Error ? error.message : String(error),
      },
      "Redis connection check failed"
    );
    return false;
  }
}

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
 * @param handlers - Webhook handlers for ITEM, LINK, and TRANSACTIONS events
 * @returns Worker instance
 */
export function createWebhookWorker(handlers: {
  handleItemWebhook: WebhookHandler;
  handleLinkWebhook: WebhookHandler;
  handleTransactionsWebhook: WebhookHandler;
}): Worker<PlaidWebhookEvent> {
  const { handleItemWebhook, handleLinkWebhook, handleTransactionsWebhook } =
    handlers;

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

      try {
        // Route to appropriate handler based on webhook type
        switch (webhook_type) {
          case "ITEM":
            await handleItemWebhook(webhook_code, event);
            break;
          case "LINK":
            await handleLinkWebhook(webhook_code, event);
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

  return worker;
}

/**
 * Queue events listener for monitoring
 * Logs job lifecycle events for debugging and monitoring
 */
export function createQueueEvents(): QueueEvents {
  const queueEvents = new QueueEvents("webhooks", {
    connection: redisConnection,
  });

  // Log queue events (optional - can be disabled in production)
  if (process.env.NODE_ENV === "development") {
    queueEvents.on("completed", ({ jobId }) => {
      logger.debug({ job_id: jobId }, "Queue event: job completed");
    });

    queueEvents.on("failed", ({ jobId, failedReason }) => {
      logger.error(
        { job_id: jobId, failed_reason: failedReason },
        "Queue event: job failed"
      );
    });

    queueEvents.on("stalled", ({ jobId }) => {
      logger.warn({ job_id: jobId }, "Queue event: job stalled");
    });
  }

  return queueEvents;
}

/**
 * Gracefully shutdown queue and worker
 * Call this when shutting down the application
 */
export async function shutdownQueue(
  worker: Worker<PlaidWebhookEvent>,
  queueEvents: QueueEvents
): Promise<void> {
  await worker.close();
  await webhookQueue.close();
  await queueEvents.close();
}
