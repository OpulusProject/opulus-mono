import { expect, test } from "@playwright/test";
import { withSession } from "../helpers/client.js";
import {
  expectOk,
  expectStatus,
  expectValidationError,
} from "../helpers/assertions.js";
import {
  createAuthedUser,
  seedItemWithAccount,
  seedTransactions,
} from "../helpers/fixtures/index.js";

/**
 * This file: the transactions list endpoint (authenticated, query-validated).
 * Transactions have no create endpoint — they are seeded into the isolated test
 * DB (helpers/db.ts) and verified over HTTP.
 */
test.describe("GET /api/transactions", () => {
  test("returns an empty, paginated list for a fresh user", async ({
    request,
  }) => {
    // Arrange
    const { cookie } = await createAuthedUser(request);

    // Act
    const res = await request.get("/api/transactions", {
      headers: withSession(cookie),
    });

    // Assert
    await expectOk(res);
    const body = await res.json();
    expect(body.data.transactions).toEqual([]);
    expect(body.data.pagination).toMatchObject({ total: 0 });
  });

  test("returns the user's seeded transactions", async ({ request }) => {
    // Arrange: user via API, then item/account/transactions seeded directly.
    const { cookie, userId } = await createAuthedUser(request);
    const item = await seedItemWithAccount(userId);
    const { names, count } = await seedTransactions({
      userId,
      itemId: item.itemId,
      accountId: item.accountId,
      count: 3,
    });

    // Act
    const res = await request.get("/api/transactions", {
      headers: withSession(cookie),
    });

    // Assert
    await expectOk(res);
    const body = await res.json();
    expect(body.data.pagination.total).toBe(count);
    const returnedNames = (
      body.data.transactions as Array<{ name: string }>
    ).map((t) => t.name);
    for (const name of names) {
      expect(returnedNames).toContain(name);
    }
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

  test("requires authentication (401)", async ({ request }) => {
    const res = await request.get("/api/transactions");
    await expectStatus(res, 401);
  });
});
