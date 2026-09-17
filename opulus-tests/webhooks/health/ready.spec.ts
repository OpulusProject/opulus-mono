import { expect, test } from "@playwright/test";
import { expectOk } from "../helpers/assertions.js";

/**
 * This file: the readiness endpoint (checks database, Redis, and the queue
 * worker).
 */
test.describe("GET /ready", () => {
  test("reports ready with database, redis, and worker up", async ({
    request,
  }) => {
    // Act
    const res = await request.get("/ready");

    // Assert
    await expectOk(res);
    expect(await res.json()).toMatchObject({
      status: "ready",
      database: "connected",
      redis: "connected",
      queueWorker: "running",
    });
  });
});
