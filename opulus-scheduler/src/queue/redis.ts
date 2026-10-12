import { logger } from "@opulus/core";

/**
 * Redis connection settings, from the same variables as the webhooks service
 * (REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_TLS).
 */
export const redisConnection = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD,
  // BullMQ requires this to be null on worker connections: blocking commands
  // must not be aborted mid-flight during a reconnect.
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  // Opt-in TLS for managed Redis providers.
  ...(process.env.REDIS_TLS === "true" ? { tls: {} } : {}),
  retryStrategy: (times: number) => Math.min(times * 50, 2000),
};

/** Whether Redis answers, for the readiness check. */
export async function checkRedisConnection(): Promise<boolean> {
  try {
    const Redis = (await import("ioredis")).default;
    const client = new Redis(redisConnection);
    await client.ping();
    await client.quit();
    return true;
  } catch (error) {
    logger.error(
      {
        error_message: error instanceof Error ? error.message : String(error),
      },
      "Redis connection check failed",
    );
    return false;
  }
}
