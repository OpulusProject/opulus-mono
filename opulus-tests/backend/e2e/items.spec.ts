import { expect, test } from "@playwright/test";
import { withSession } from "./helpers/client.js";
import { expectOk } from "./helpers/assertions.js";
import { createAuthedUser } from "./helpers/fixtures.js";

/**
 * GET /api/items — authenticated list of a user's linked institutions. A fresh
 * user has linked nothing, so the happy path asserts an empty, well-shaped list.
 */

test.describe("GET /api/items", () => {
  test("returns an empty item list for a fresh user (happy path)", async ({
    request,
  }) => {
    const { cookie } = await createAuthedUser(request);
    const res = await request.get("/api/items", {
      headers: withSession(cookie),
    });
    await expectOk(res);

    const body = await res.json();
    expect(Array.isArray(body.data.items)).toBe(true);
    expect(body.data.items).toHaveLength(0);
  });

  test("requires authentication (401)", async ({ request }) => {
    const res = await request.get("/api/items");
    expect(res.status()).toBe(401);
  });
});
