import { expect, test } from "@playwright/test";
import { get, startService, stopService, type RunningService } from "../helpers/service.js";

const PORT = 18295;

/**
 * This file: the webhooks receiver when Redis is not there. It says it is
 * alive (`/health`) but not ready (`/ready`, 503) and answers promptly, so a
 * platform stops sending it traffic instead of waiting on a hung check.
 */
test.describe("webhooks without Redis", () => {
  let receiver: RunningService;
  test.afterEach(() => stopService(receiver));

  test("is alive but not ready when Redis is unreachable", async () => {
    // Arrange: a Redis address nothing listens on.
    receiver = await startService({
      workspace: "opulus-webhooks",
      port: PORT,
      portVariable: "WEBHOOK_PORT",
      env: { REDIS_HOST: "localhost", REDIS_PORT: "1" },
    });

    // Act
    const health = await get(PORT, "/health");
    const ready = await get(PORT, "/ready", 8_000);

    // Assert
    expect(health.status).toBe(200);
    expect(ready.status).toBe(503);
    expect(ready.body.redis).toBe("disconnected");
  });
});
