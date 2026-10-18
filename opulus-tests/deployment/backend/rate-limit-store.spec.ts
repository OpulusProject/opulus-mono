import { expect, test } from "@playwright/test";
import { exited, startService, type RunningService } from "../helpers/service.js";

/** Stop it the way a deploy does, so nothing is left holding the port (a kill would leave tsx's child running). */
async function stopService(service: RunningService) {
  service.child.kill("SIGTERM");
  await exited(service.child);
}

const FIRST = 18298;
const SECOND = 18299;
const LIMIT = 4;

const env = (overrides: Record<string, string> = {}) => ({
  RATE_LIMIT_STORE: "redis",
  RATE_LIMIT_PER_IP: String(LIMIT),
  ...overrides,
});

/** A request to an open route, counted against `ip` (the backend trusts one proxy, so the header is the address). */
const ping = (port: number, ip: string) =>
  fetch(`http://localhost:${port}/api/healthcheck`, { headers: { "x-forwarded-for": ip }, signal: AbortSignal.timeout(15_000) });

/** A documentation address no other spec uses, different for each test so counters in Redis never meet. */
const addressFor = (n: number) => `198.51.100.${n}`;

/**
 * This file: where the rate limit counters live. By default each backend counts
 * for itself, in memory; with RATE_LIMIT_STORE=redis every instance counts in
 * Redis, so a client cannot get a limit per instance by being sent to different
 * ones. It starts backends of its own, with a low limit, and Redis from the
 * environment.
 *
 * Test cases:
 * - instances sharing Redis count a client together
 * - a limiter does not hold requests up, or fail them with a server error, when Redis is down
 */
test.describe("rate limit store", () => {
  let backends: RunningService[] = [];
  test.afterEach(async () => {
    await Promise.all(backends.map(stopService));
    backends = [];
  });

  test("instances sharing Redis count a client together", async () => {
    // Arrange: two backends, one Redis.
    const common = { workspace: "opulus-backend", portVariable: "PORT", env: env() };
    backends = [await startService({ ...common, port: FIRST }), await startService({ ...common, port: SECOND })];
    const ip = addressFor(1);

    // Act: half the limit on each.
    const statuses = [
      (await ping(FIRST, ip)).status,
      (await ping(FIRST, ip)).status,
      (await ping(SECOND, ip)).status,
      (await ping(SECOND, ip)).status,
    ];
    const over = await ping(FIRST, ip);

    // Assert: together they used the limit, so either one now refuses.
    expect(statuses).toEqual([200, 200, 200, 200]);
    expect(over.status).toBe(429);
    expect((await ping(SECOND, ip)).status).toBe(429);
    expect((await ping(SECOND, addressFor(2))).status).toBe(200);
  });

  test("a limiter does not hold requests up, or fail them, when Redis is down", async () => {
    // Arrange: a Redis address nothing listens on.
    backends = [
      await startService({
        workspace: "opulus-backend",
        port: FIRST,
        portVariable: "PORT",
        env: env({ REDIS_HOST: "localhost", REDIS_PORT: "1" }),
      }),
    ];

    // Act
    const started = Date.now();
    const statuses: number[] = [];
    for (let i = 0; i < LIMIT + 2; i++) statuses.push((await ping(FIRST, addressFor(3))).status);

    // Assert: every request was answered promptly, with an answer (not a server error), and the failure was logged.
    expect(Date.now() - started).toBeLessThan(10_000);
    expect(statuses.every((status) => status === 200 || status === 429), statuses.join()).toBe(true);
    const deadline = Date.now() + 5_000;
    while (!backends[0]!.output().includes("Rate limit Redis error") && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect(backends[0]!.output()).toContain("Rate limit Redis error");
  });
});
