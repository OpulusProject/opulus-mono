import { expect, test } from "@playwright/test";
import { get, startService, stopService, type RunningService } from "../helpers/service.js";

const PORT = 18294;

/**
 * This file: the backend when Postgres is not there. It still starts and says
 * it is alive (`/health`), but says it is not ready (`/ready`, 503), so a
 * platform keeps traffic away instead of sending it to a backend that cannot
 * answer.
 */
test.describe("backend without its database", () => {
  let backend: RunningService;
  test.afterEach(() => stopService(backend));

  test("is alive but not ready when Postgres is unreachable", async () => {
    // Arrange: a database URL nothing listens on.
    backend = await startService({
      workspace: "opulus-backend",
      port: PORT,
      portVariable: "PORT",
      env: { DATABASE_URL: "postgresql://app:app@localhost:1/none?schema=public&connect_timeout=2" },
    });

    // Act
    const health = await get(PORT, "/health");
    const ready = await get(PORT, "/ready");

    // Assert
    expect(health.status).toBe(200);
    expect(ready.status).toBe(503);
    expect(ready.body.database).toBe("disconnected");
  });
});
