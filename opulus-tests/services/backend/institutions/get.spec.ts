import { test } from "@playwright/test";
import { expectStatus } from "../../../shared/assertions.js";

/**
 * This file: the Plaid institutions list endpoint. Its happy path proxies the
 * external Plaid API, so this suite covers only the service-owned boundary:
 * authentication gating.
 */
test.describe("GET /api/institutions", () => {
  test("requires authentication (401)", async ({ request }) => {
    const res = await request.get("/api/institutions");
    await expectStatus(res, 401);
  });
});
