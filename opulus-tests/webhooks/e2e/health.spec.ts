import { expect, test } from "@playwright/test";
import { expectOk } from "./helpers/assertions.js";

/**
 * Liveness / readiness surface. `/ready` additionally proves the pipeline
 * brought up Postgres, Redis, and the BullMQ worker the receiver depends on.
 */

test.describe("GET /health", () => {
  test("reports the receiver as ok", async ({ request }) => {
    const res = await request.get("/health");
    await expectOk(res);
    expect(await res.json()).toMatchObject({ status: "ok", service: "webhooks" });
  });
});

test.describe("GET /ready", () => {
  test("reports ready with database, redis, and worker up", async ({
    request,
  }) => {
    const res = await request.get("/ready");
    await expectOk(res);
    expect(await res.json()).toMatchObject({
      status: "ready",
      database: "connected",
      redis: "connected",
      queueWorker: "running",
    });
  });
});
