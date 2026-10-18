import { expect, test } from "@playwright/test";
import { exited, startService } from "../helpers/service.js";

const PORT = 18292;

const startWebhooks = () =>
  startService({ workspace: "opulus-webhooks", port: PORT, portVariable: "WEBHOOK_PORT" });

/**
 * This file: the webhooks receiver stops on SIGTERM or SIGINT (an interrupt, as in a terminal), as a deploy asks it to.
 * It starts a receiver of its own and stops that one.
 */
test.describe("webhooks graceful shutdown", () => {
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    test(`exits cleanly on ${signal} and stops accepting connections`, async () => {
      // Arrange
      const { child, output } = await startWebhooks();

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
    // Arrange: one request, whose connection the client keeps open afterwards.
    const { child } = await startWebhooks();
    expect((await fetch(`http://localhost:${PORT}/health`)).ok).toBe(true);

    // Act
    child.kill("SIGTERM");
    const code = await exited(child, 5_000);

    // Assert
    expect(code).toBe(0);
  });
});
