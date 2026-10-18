import { expect, test } from "@playwright/test";
import { expectOk } from "../../../shared/assertions.js";

/**
 * This file: the two checks a platform makes of the scheduler. /health says the
 * process is up; /ready also reads the database, reaches Redis and checks that
 * the worker that runs the jobs is running, and is what a deploy waits on.
 * Neither needs the admin token.
 *
 * Test cases:
 * - /health answers ok, naming the service
 * - /ready answers ready once the database and Redis answer and the worker runs
 */
test.describe("scheduler health checks", () => {
  test("/health answers ok, naming the service", async ({ request }) => {
    const res = await request.get("/health");

    await expectOk(res);
    expect(await res.json()).toMatchObject({ status: "ok", service: "scheduler" });
  });

  test("/ready answers ready once the database and Redis answer and the worker runs", async ({ request }) => {
    const res = await request.get("/ready");

    await expectOk(res);
    expect(await res.json()).toMatchObject({ status: "ready", database: "connected", redis: "connected", worker: "running" });
  });
});
