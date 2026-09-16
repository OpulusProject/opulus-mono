import { expect, test } from "@playwright/test";
import { withSession } from "../helpers/client.js";
import { expectValidationError } from "../helpers/assertions.js";
import { createAuthedUser } from "../helpers/fixtures.js";

/**
 * This file: the Plaid transactions-refresh endpoint. The happy path triggers an
 * external Plaid call, so this suite covers the service-owned boundaries that run
 * before it: authentication gating and request-body validation. Matrix rows:
 * authn, validation.
 */
test.describe("POST /api/plaid/transactions/refresh", () => {
  test("requires authentication (401)", async ({ request }) => {
    const res = await request.post("/api/plaid/transactions/refresh", {
      data: { itemId: "whatever" },
    });
    expect(res.status()).toBe(401);
  });

  test("rejects a missing itemId before contacting Plaid (validation)", async ({
    request,
  }) => {
    // Arrange
    const { cookie } = await createAuthedUser(request);

    // Act
    const res = await request.post("/api/plaid/transactions/refresh", {
      headers: withSession(cookie),
      data: {},
    });

    // Assert
    await expectValidationError(res);
  });
});
