import { expect, test } from "@playwright/test";
import { withSession } from "./helpers/client.js";
import { expectValidationError } from "./helpers/assertions.js";
import { createAuthedUser } from "./helpers/fixtures.js";

/**
 * Plaid routes proxy an external third-party API, so this suite deliberately
 * stops at the boundaries the service owns and can answer deterministically
 * without Plaid: authentication gating (requireSession) and request-body
 * validation, both of which run before any Plaid call is made.
 */

test.describe("Plaid routes — authentication gating", () => {
  test("POST /api/plaid/link-token requires authentication (401)", async ({
    request,
  }) => {
    const res = await request.post("/api/plaid/link-token", { data: {} });
    expect(res.status()).toBe(401);
  });

  test("GET /api/plaid/institutions requires authentication (401)", async ({
    request,
  }) => {
    const res = await request.get("/api/plaid/institutions");
    expect(res.status()).toBe(401);
  });

  test("POST /api/plaid/transactions/refresh requires authentication (401)", async ({
    request,
  }) => {
    const res = await request.post("/api/plaid/transactions/refresh", {
      data: { itemId: "whatever" },
    });
    expect(res.status()).toBe(401);
  });
});

test.describe("POST /api/plaid/transactions/refresh — validation", () => {
  test("rejects a missing itemId before contacting Plaid (validation)", async ({
    request,
  }) => {
    const { cookie } = await createAuthedUser(request);
    const res = await request.post("/api/plaid/transactions/refresh", {
      headers: withSession(cookie),
      data: {},
    });
    await expectValidationError(res);
  });
});
