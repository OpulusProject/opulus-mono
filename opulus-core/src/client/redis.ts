import { logger } from "../utils/logger.js";

/**
 * Redis connection settings for BullMQ, from REDIS_HOST, REDIS_PORT,
 * REDIS_PASSWORD and REDIS_TLS, with defaults for local development. Shared by
 * every service that uses a queue (the webhooks receiver and the scheduler), so
 * they all read the same variables.
 */
export const redisConnection = {
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

/** How long a readiness check waits for Redis before it counts as down. */
const REDIS_CHECK_TIMEOUT_MS = 2000;

/**
 * Check Redis connection health
 * Used by the services' readiness endpoints. It gives up after
 * REDIS_CHECK_TIMEOUT_MS: the queue settings above retry forever, so without a
 * limit a check against a Redis that is down would never answer.
 */
export async function checkRedisConnection(): Promise<boolean> {
  const Redis = (await import("ioredis")).default;
  const testClient = new Redis(redisConnection);
  // A client that cannot connect emits "error" on every retry.
  testClient.on("error", () => undefined);
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      testClient.ping(),
      new Promise((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error(`no answer within ${REDIS_CHECK_TIMEOUT_MS}ms`)),
          REDIS_CHECK_TIMEOUT_MS
        );
      }),
    ]);
    return true;
  } catch (error) {
    logger.error(
      {
        error_type:
          error instanceof Error ? error.constructor.name : typeof error,
        error_message: error instanceof Error ? error.message : String(error),
      },
      "Redis connection check failed"
    );
    return false;
  } finally {
    clearTimeout(timer);
    testClient.disconnect();
  }
}
