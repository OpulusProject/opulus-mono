import { expect, test } from "@playwright/test";
import { expectOk } from "../helpers/assertions.js";

/**
 * This file: the readiness endpoint (includes a DB connectivity check).
 */
test.describe("GET /ready", () => {
  test("reports ready with a connected database", async ({ request }) => {
    // Act
    const res = await request.get("/ready");

    // Assert
    await expectOk(res);
    expect(await res.json()).toMatchObject({
      status: "ready",
      database: "connected",
    });
  });
});
