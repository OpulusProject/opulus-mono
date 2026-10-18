import { expect, test } from "@playwright/test";
import { expectOk } from "../../../shared/assertions.js";

/**
 * This file: the two checks a platform makes of the backend. /health says the
 * process is up and touches nothing else; /ready also reads the database, and
 * is what a deploy waits on. (That /ready answers 503 when the database is gone
 * is in deployment/backend/dependencies.spec.ts.)
 *
 * Test cases:
 * - /health answers ok, naming the service
 * - /ready answers ready once the database answers (both are open: these requests carry no session)
 */
test.describe("backend health checks", () => {
  test("/health answers ok, naming the service", async ({ request }) => {
    const res = await request.get("/health");

    await expectOk(res);
    expect(await res.json()).toMatchObject({ status: "ok", service: "backend" });
  });

  test("/ready answers ready once the database answers", async ({ request }) => {
    const res = await request.get("/ready");

    await expectOk(res);
    expect(await res.json()).toMatchObject({ status: "ready", database: "connected" });
  });
});
