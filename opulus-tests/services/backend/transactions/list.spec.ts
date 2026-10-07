import { expect, test } from "@playwright/test";
import { withSession } from "../../../shared/client.js";
import {
  expectOk,
  expectStatus,
  expectValidationError,
} from "../../../shared/assertions.js";
import {
  createAuthedUser,
  seedItemWithAccount,
  seedTransactions,
} from "../../../shared/fixtures/index.js";

/**
 * This file: the transactions list endpoint (authenticated, query-validated).
 * Transactions have no create endpoint — they are seeded into the isolated test
 * DB (helpers/db.ts) and verified over HTTP.
 */
test.describe("GET /api/transactions", () => {
  test("requires authentication (401)", async ({ request }) => {
    const res = await request.get("/api/transactions");
    await expectStatus(res, 401);
  });

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

  test("returns a transaction in its documented shape (numeric amount, ISO dates, only the documented fields)", async ({
    request,
  }) => {
    // Arrange
    const { cookie, userId } = await createAuthedUser(request);
    const item = await seedItemWithAccount(userId);
    await seedTransactions({
      userId,
      itemId: item.itemId,
      accountId: item.accountId,
      count: 1,
    });

    // Act
    const res = await request.get("/api/transactions", {
      headers: withSession(cookie),
    });

    // Assert: amount is a number (not a decimal string), dates are ISO
    // strings, and nothing outside the documented fields is exposed.
    await expectOk(res);
    const [transaction] = (await res.json()).data.transactions as Array<
      Record<string, unknown>
    >;
    expect(typeof transaction.amount).toBe("number");
    expect(transaction.amount).toBeCloseTo(12.34);
    expect(new Date(transaction.date as string).toISOString()).toBe(
      transaction.date,
    );
    expect(new Date(transaction.createdAt as string).toISOString()).toBe(
      transaction.createdAt,
    );
    expect(Object.keys(transaction).sort()).toEqual(
      [
        "accountId",
        "accountOwner",
        "amount",
        "authorizedDate",
        "account",
        "category",
        "categoryId",
        "checkNumber",
        "createdAt",
        "date",
        "dateTransacted",
        "id",
        "isoCurrencyCode",
        "itemId",
        "location",
        "merchantEntityId",
        "merchantName",
        "name",
        "paymentMeta",
        "pending",
        "pendingTransactionId",
        "personalFinanceCategory",
        "providerTransactionId",
        "transactionCode",
        "unofficialCurrencyCode",
        "updatedAt",
        "userId",
      ].sort(),
    );
    expect(Object.keys(transaction.account as object).sort()).toEqual([
      "id",
      "mask",
      "name",
    ]);
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
