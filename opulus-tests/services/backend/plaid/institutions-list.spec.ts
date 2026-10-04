import { expect, test } from "@playwright/test";

/**
 * This file: the Plaid institutions list endpoint. Its happy path proxies the
 * external Plaid API, so this suite covers only the service-owned boundary:
 * authentication gating.
 */
test.describe("GET /api/plaid/institutions", () => {
  test("requires authentication (401)", async ({ request }) => {
    const res = await request.get("/api/plaid/institutions");
    expect(res.status()).toBe(401);
  });
});
