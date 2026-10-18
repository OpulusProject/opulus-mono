import { expect, test } from "@playwright/test";
import { expectOk } from "../../../shared/assertions.js";

/**
 * This file: the two checks a platform makes of the webhook receiver. /health
 * says the process is up; /ready also reads the database, reaches Redis and
 * checks that the queue worker is running, and is what a deploy waits on. (That
 * /ready answers 503 when the database is gone is in
 * deployment/webhooks/dependencies.spec.ts.)
 *
 * Test cases:
 * - /health answers ok, naming the service
 * - /ready answers ready once the database and Redis answer and the worker runs
 */
test.describe("webhook receiver health checks", () => {
  test("/health answers ok, naming the service", async ({ request }) => {
    const res = await request.get("/health");

    await expectOk(res);
    expect(await res.json()).toMatchObject({ status: "ok", service: "webhooks" });
  });

  test("/ready answers ready once the database and Redis answer and the worker runs", async ({ request }) => {
    const res = await request.get("/ready");

    await expectOk(res);
    expect(await res.json()).toMatchObject({ status: "ready", database: "connected", redis: "connected", queueWorker: "running" });
  });
});
