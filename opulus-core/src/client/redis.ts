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

/**
 * Check Redis connection health
 * Used by the services' readiness endpoints
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
        error_type:
          error instanceof Error ? error.constructor.name : typeof error,
        error_message: error instanceof Error ? error.message : String(error),
      },
      "Redis connection check failed"
    );
    return false;
  }
}
