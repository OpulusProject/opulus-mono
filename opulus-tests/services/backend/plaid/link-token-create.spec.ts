import { expect, test } from "@playwright/test";

/**
 * This file: the Plaid link-token create endpoint. Its happy path proxies the
 * external Plaid API, so this suite (single-service, black-box) covers only the
 * boundary the service itself owns and answers deterministically: authentication
 * gating, which runs before any Plaid call.
 */
test.describe("POST /api/plaid/link-token", () => {
  test("requires authentication (401)", async ({ request }) => {
    const res = await request.post("/api/plaid/link-token", { data: {} });
    expect(res.status()).toBe(401);
  });
});
