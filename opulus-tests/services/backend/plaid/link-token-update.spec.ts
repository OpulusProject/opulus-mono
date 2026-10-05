import { test } from "@playwright/test";
import { withSession } from "../../../shared/client.js";
import { expectStatus, expectValidationError } from "../../../shared/assertions.js";
import { createAuthedUser } from "../../../shared/fixtures/index.js";

/**
 * This file: the Plaid link-token update-mode endpoint. Its happy path proxies
 * Plaid, so this suite covers the service-owned boundary that runs before any
 * Plaid call: authentication gating and request-body validation.
 */
test.describe("POST /api/plaid/link-token/update", () => {
  test("requires authentication (401)", async ({ request }) => {
    const res = await request.post("/api/plaid/link-token/update", {
      data: { itemId: "item_1" },
    });
    await expectStatus(res, 401);
  });

  test("rejects a missing itemId before contacting Plaid (validation)", async ({
    request,
  }) => {
    const { cookie } = await createAuthedUser(request);

    const res = await request.post("/api/plaid/link-token/update", {
      headers: withSession(cookie),
      data: {},
    });

    await expectValidationError(res);
  });
});
