import {
  config,
  logger,
  redisConnection,
  TooManyRequestsError,
} from "@opulus/core";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { Redis } from "ioredis";
import type { RequestHandler } from "express";
import { RedisStore } from "rate-limit-redis";

/**
 * The counters live in Redis, which the receiver needs anyway for its queue, so
 * every instance counts together. A limiter must not hold a request up when
 * Redis is slow or down: a command gives up after one retry and the request is
 * let through. (The offline queue stays on: the store loads its scripts as soon
 * as it is made, before the connection is up, and those must wait for it.)
 */
const redis = new Redis({
  host: redisConnection.host,
  port: redisConnection.port,
  password: redisConnection.password,
  ...("tls" in redisConnection ? { tls: {} } : {}),
  maxRetriesPerRequest: 1,
});
redis.on("error", (error: Error) =>
  logger.error({ error_message: error.message }, "Rate limit Redis error")
);

/**
 * Webhooks are public, so anyone can post to the receiver. This counts requests
 * per IP address (the real one, from the proxy: `trust proxy` is set) and
 * answers 429 over the limit. Mount it first on the route: checking a
 * signature fetches Plaid's verification key, so a flood of bad requests would
 * otherwise cost a Plaid call each.
 */
export const webhookRateLimit: RequestHandler = rateLimit({
  windowMs: 60_000,
  limit: config.webhookRateLimitPerIp,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  passOnStoreError: true,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? ""),
  store: new RedisStore({
    prefix: "rate-limit:webhooks:",
    sendCommand: (...args: string[]) =>
      redis.call(args[0]!, ...args.slice(1)) as Promise<never>,
  }),
  handler: (req, _res, next, options) => {
    logger.warn({ ip: req.ip, path: req.path }, "Webhook rate limit exceeded");
    next(
      new TooManyRequestsError(
        "Too many requests, try again in a minute",
        Math.ceil(options.windowMs / 1000)
      )
    );
  },
});
