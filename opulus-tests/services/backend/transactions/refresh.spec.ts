import { test } from "@playwright/test";
import { withSession } from "../../../shared/client.js";
import {
  expectStatus,
  expectValidationError,
} from "../../../shared/assertions.js";
import { createAuthedUser } from "../../../shared/fixtures/index.js";

/**
 * This file: the Plaid transactions-refresh endpoint. The happy path triggers an
 * external Plaid call, so this suite covers the service-owned boundaries that run
 * before it: authentication gating and request-body validation.
 */
test.describe("POST /api/transactions/refresh", () => {
  test("requires authentication (401)", async ({ request }) => {
    const res = await request.post("/api/transactions/refresh", {
      data: { itemId: "whatever" },
    });
    await expectStatus(res, 401);
  });

  test("rejects a missing itemId before contacting Plaid (validation)", async ({
    request,
  }) => {
    // Arrange
    const { cookie } = await createAuthedUser(request);

    // Act
    const res = await request.post("/api/transactions/refresh", {
      headers: withSession(cookie),
      data: {},
    });

    // Assert
    await expectValidationError(res);
  });
});
