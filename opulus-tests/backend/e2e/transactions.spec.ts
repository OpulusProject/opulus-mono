import { expect, test } from "@playwright/test";
import { withSession } from "./helpers/client.js";
import { expectOk, expectValidationError } from "./helpers/assertions.js";
import { createAuthedUser } from "./helpers/fixtures.js";

/**
 * GET /api/transactions — authenticated, query-validated read. A brand-new user
 * owns no transactions, so the happy path asserts an empty, well-shaped page
 * rather than a global count (black-box isolation via a fresh account).
 */

test.describe("GET /api/transactions", () => {
  test("returns an empty, paginated list for a fresh user (happy path)", async ({
    request,
  }) => {
    const { cookie } = await createAuthedUser(request);
    const res = await request.get("/api/transactions", {
      headers: withSession(cookie),
    });
    await expectOk(res);

    const body = await res.json();
    expect(Array.isArray(body.data.transactions)).toBe(true);
    expect(body.data.transactions).toHaveLength(0);
    expect(body.data.pagination).toBeTruthy();
  });

  test("requires authentication (401)", async ({ request }) => {
    const res = await request.get("/api/transactions");
    expect(res.status()).toBe(401);
  });

  test("rejects a limit above the allowed maximum (validation)", async ({
    request,
  }) => {
    const { cookie } = await createAuthedUser(request);
    const res = await request.get("/api/transactions?limit=20000", {
      headers: withSession(cookie),
    });
    await expectValidationError(res);
  });

  test("rejects a non-positive page (validation)", async ({ request }) => {
    const { cookie } = await createAuthedUser(request);
    const res = await request.get("/api/transactions?page=0", {
      headers: withSession(cookie),
    });
    await expectValidationError(res);
  });
});
