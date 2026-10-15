import { expect, test } from "@playwright/test";
import { startService, stopService, type RunningService } from "../helpers/service.js";

const PORT = 18296;

/**
 * This file: the scheduler when Redis is not there. A scheduler is nothing
 * without its queue, so it must not look healthy: it never starts listening,
 * and the platform's health check fails and restarts it.
 */
test.describe("scheduler without Redis", () => {
  let scheduler: RunningService;
  test.afterEach(() => stopService(scheduler));

  test("never answers /health while its queue is unreachable", async () => {
    // Arrange / Act: a Redis address nothing listens on; give it time to try.
    scheduler = await startService({
      workspace: "opulus-scheduler",
      port: PORT,
      portVariable: "SCHEDULER_PORT",
      env: { REDIS_HOST: "localhost", REDIS_PORT: "1", SCHEDULER_RUN_ON_START: "false" },
      waitMs: 6_000,
    });

    // Assert
    await expect(fetch(`http://localhost:${PORT}/health`)).rejects.toThrow();
  });
});
