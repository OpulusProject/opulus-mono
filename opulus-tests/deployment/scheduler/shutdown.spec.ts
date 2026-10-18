import { expect, test } from "@playwright/test";
import { exited, startService } from "../helpers/service.js";

const PORT = 18293;

const startScheduler = () =>
  startService({
    workspace: "opulus-scheduler",
    port: PORT,
    portVariable: "SCHEDULER_PORT",
    // No start-up run: this file is about stopping, not about the jobs.
    env: { SCHEDULER_RUN_ON_START: "false" },
  });

/**
 * This file: the scheduler stops on SIGTERM or SIGINT (an interrupt, as in a terminal), as a deploy asks it to. It starts
 * a scheduler of its own and stops that one.
 */
test.describe("scheduler graceful shutdown", () => {
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    test(`exits cleanly on ${signal} and stops accepting connections`, async () => {
      // Arrange
      const { child, output } = await startScheduler();

      // Act
      child.kill(signal);
      const code = await exited(child);

      // Assert
      expect(code).toBe(0);
      expect(output()).toContain("Server closed");
      await expect(fetch(`http://localhost:${PORT}/health`)).rejects.toThrow();
    });
  }

  test("is not held open by a connection a client keeps alive", async () => {
    // Arrange
    const { child } = await startScheduler();
    expect((await fetch(`http://localhost:${PORT}/health`)).ok).toBe(true);

    // Act
    const stopped = Date.now();
    child.kill("SIGTERM");
    const code = await exited(child, 5_000);

    // Assert
    expect(code).toBe(0);
    expect(Date.now() - stopped).toBeLessThan(5_000);
  });
});
