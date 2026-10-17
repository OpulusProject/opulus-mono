import { config, logger, TooManyRequestsError } from "@opulus/core";
import { Redis } from "ioredis";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import type { Request, RequestHandler, Response } from "express";
import { RedisStore } from "rate-limit-redis";

const WINDOW_MS = 60_000;

/**
 * One connection for every limiter, made when the first one is. The counters
 * live in Redis when RATE_LIMIT_STORE is "redis", so every instance of the
 * backend counts together; otherwise each instance counts for itself, in memory.
 */
let redis: Redis | undefined;
function redisClient(): Redis {
  redis ??= new Redis({
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD,
    ...(process.env.REDIS_TLS === "true" ? { tls: {} } : {}),
    // A limiter must not hold a request up when Redis is slow or down: a command
    // gives up after one retry. The offline queue stays on, because the store
    // loads its scripts as soon as it is made, before the connection is up.
    maxRetriesPerRequest: 1,
  });
  redis.on("error", (error: Error) =>
    logger.error({ error_message: error.message }, "Rate limit Redis error")
  );
  return redis;
}

/** Who is counted: the signed-in user if there is one, otherwise the address. */
function keyOf(req: Request, res: Response): string {
  const userId = (res.locals.session as { user?: { id: string } } | undefined)
    ?.user?.id;
  return userId ? `user:${userId}` : `ip:${ipKeyGenerator(req.ip ?? "")}`;
}

interface LimiterOptions {
  /** Names the counters, so two limiters never share one. */
  name: string;
  /** Requests allowed per window for one key. */
  limit: number;
  /** How long a window lasts, in milliseconds (a minute by default). */
  windowMs?: number;
}

/**
 * A limiter for one key per minute: over the limit a request gets a 429 in the
 * API's error shape with a Retry-After header, and the RateLimit headers say
 * how much is left. If the counter store fails the request goes through: a
 * limiter that breaks the API is worse than one that is briefly off.
 */
function createLimiter({
  name,
  limit,
  windowMs = WINDOW_MS,
}: LimiterOptions): RequestHandler {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    passOnStoreError: true,
    keyGenerator: (req, res) => keyOf(req, res),
    store: config.rateLimitUsesRedis
      ? new RedisStore({
          prefix: `rate-limit:${name}:`,
          sendCommand: (...args: string[]) =>
            redisClient().call(args[0]!, ...args.slice(1)) as Promise<never>,
        })
      : undefined,
    handler: (req, res, next, options) => {
      const retryAfter = Math.ceil(options.windowMs / 1000);
      logger.warn(
        { limiter: name, key: keyOf(req, res), path: req.path },
        "Rate limit exceeded"
      );
      next(
        new TooManyRequestsError(
          "Too many requests, try again later",
          retryAfter
        )
      );
    },
  });
}

/** Every request to the API, counted by IP address (or user, once signed in). */
export const apiRateLimit: RequestHandler = createLimiter({
  name: "api",
  limit: config.rateLimitPerIp,
});

/**
 * Routes that call Plaid (link tokens, connecting an institution, updating its accounts),
 * counted per signed-in user. Mount it after `requireSession`: without a
 * session it would count by IP address instead.
 */
export const plaidRateLimit: RequestHandler = createLimiter({
  name: "plaid",
  limit: config.rateLimitPlaidPerUser,
});

/**
 * The data export, which reads everything a user has: three an hour per
 * signed-in user. Mount it after `requireSession`.
 */
export const exportRateLimit: RequestHandler = createLimiter({
  name: "export",
  limit: 3,
  windowMs: 60 * 60_000,
});
