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
  maxRetriesPerRequest: 3,
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
    console.error("[REDIS] Connection check failed:", error);
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

      console.log(
        `[WEBHOOK QUEUE] Processing ${webhook_type}:${webhook_code} (attempt ${job.attemptsMade + 1}/${job.opts.attempts})`
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
            console.warn(
              `[WEBHOOK QUEUE] Unhandled webhook type: ${webhook_type}`
            );
        }

        console.log(
          `[WEBHOOK QUEUE] Successfully processed ${webhook_type}:${webhook_code}`
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error(
          `[WEBHOOK QUEUE] Failed to process ${webhook_type}:${webhook_code}:`,
          errorMessage
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
      console.log(`[WEBHOOK QUEUE] Job ${jobId} completed`);
    });

    queueEvents.on("failed", ({ jobId, failedReason }) => {
      console.error(`[WEBHOOK QUEUE] Job ${jobId} failed: ${failedReason}`);
    });

    queueEvents.on("stalled", ({ jobId }) => {
      console.warn(`[WEBHOOK QUEUE] Job ${jobId} stalled`);
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

