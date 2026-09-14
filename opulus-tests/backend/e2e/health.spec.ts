import { expect, test } from "@playwright/test";
import { expectOk } from "./helpers/assertions.js";

/**
 * Liveness / readiness surface. These are unauthenticated and must always be
 * green when the service and its database are up — a fast smoke signal that the
 * pipeline booted the service correctly.
 */

test.describe("GET /health", () => {
  test("reports the service as ok without touching the database", async ({
    request,
  }) => {
    const res = await request.get("/health");
    await expectOk(res);
    expect(await res.json()).toMatchObject({ status: "ok", service: "backend" });
  });
});

test.describe("GET /ready", () => {
  test("reports ready with a connected database", async ({ request }) => {
    const res = await request.get("/ready");
    await expectOk(res);
    expect(await res.json()).toMatchObject({
      status: "ready",
      database: "connected",
    });
  });
});

test.describe("GET /api/healthcheck", () => {
  test("reports the API as healthy", async ({ request }) => {
    const res = await request.get("/api/healthcheck");
    await expectOk(res);
    expect(await res.json()).toMatchObject({ status: "OK" });
  });
});
