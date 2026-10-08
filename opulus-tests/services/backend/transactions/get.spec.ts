import { expect, test, type APIRequestContext } from "@playwright/test";
import { TransactionsResponseSchema } from "@opulus/core";
import { withSession } from "../../../shared/client.js";
import {
  expectOk,
  expectStatus,
  expectValidationError,
  expectMatchesSchema,
} from "../../../shared/assertions.js";
import {
  createAuthedUser,
  seedItemWithAccount,
  seedTransactions,
} from "../../../shared/fixtures/index.js";

interface TransactionRow {
  name: string;
  amount: number;
  category: { primary: string; detailed: string | null } | null;
  logoUrl: string | null;
  location: Record<string, unknown> | null;
  paymentMeta: Record<string, unknown> | null;
}

/** GET /api/transactions with an optional query string; returns the `data` body. */
async function listTransactions(
  request: APIRequestContext,
  cookie: string,
  query = "",
): Promise<{
  transactions: TransactionRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}> {
  const res = await request.get(`/api/transactions${query}`, {
    headers: withSession(cookie),
  });
  await expectOk(res);
  return (await res.json()).data;
}

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

    // Assert: the body is exactly the documented shape (dates are ISO strings,
    // nothing outside the schema), and the amount is a number, not a decimal string.
    await expectOk(res);
    const body = await expectMatchesSchema(res, TransactionsResponseSchema);
    expect(body.data.transactions[0].amount).toBeCloseTo(12.34);
  });

  test("scopes results to the requesting user (does not leak another user's transactions)", async ({
    request,
  }) => {
    // Arrange: two users, each with their own item, account and transactions.
    const mine = await createAuthedUser(request);
    const theirs = await createAuthedUser(request);
    const myItem = await seedItemWithAccount(mine.userId);
    const theirItem = await seedItemWithAccount(theirs.userId);
    const myTxns = await seedTransactions({
      userId: mine.userId,
      itemId: myItem.itemId,
      accountId: myItem.accountId,
      count: 2,
    });
    const theirTxns = await seedTransactions({
      userId: theirs.userId,
      itemId: theirItem.itemId,
      accountId: theirItem.accountId,
      count: 3,
    });

    // Act
    const data = await listTransactions(request, mine.cookie);

    // Assert: only my own, and the total counts only mine.
    expect(data.transactions.map((t) => t.name).sort()).toEqual(
      [...myTxns.names].sort(),
    );
    for (const name of theirTxns.names) {
      expect(data.transactions.map((t) => t.name)).not.toContain(name);
    }
    expect(data.pagination.total).toBe(myTxns.count);
  });

  test("returns nothing when filtering by another user's item or account", async ({
    request,
  }) => {
    // Arrange: another user's item and account exist, with transactions.
    const mine = await createAuthedUser(request);
    const theirs = await createAuthedUser(request);
    const theirItem = await seedItemWithAccount(theirs.userId);
    await seedTransactions({
      userId: theirs.userId,
      itemId: theirItem.itemId,
      accountId: theirItem.accountId,
      count: 2,
    });

    // Act: ask for them by id.
    const byItem = await listTransactions(
      request,
      mine.cookie,
      `?itemId=${theirItem.itemId}`,
    );
    const byAccount = await listTransactions(
      request,
      mine.cookie,
      `?accountId=${theirItem.accountId}`,
    );

    // Assert: an empty result, not their data.
    expect(byItem.transactions).toEqual([]);
    expect(byItem.pagination.total).toBe(0);
    expect(byAccount.transactions).toEqual([]);
    expect(byAccount.pagination.total).toBe(0);
  });

  test("filters by itemId and by accountId", async ({ request }) => {
    // Arrange: one user with two connections, each with its own account.
    const { cookie, userId } = await createAuthedUser(request);
    const first = await seedItemWithAccount(userId);
    const second = await seedItemWithAccount(userId);
    const firstTxns = await seedTransactions({
      userId,
      itemId: first.itemId,
      accountId: first.accountId,
      count: 2,
    });
    const secondTxns = await seedTransactions({
      userId,
      itemId: second.itemId,
      accountId: second.accountId,
      count: 3,
    });

    // Act
    const byItem = await listTransactions(
      request,
      cookie,
      `?itemId=${second.itemId}`,
    );
    const byAccount = await listTransactions(
      request,
      cookie,
      `?accountId=${first.accountId}`,
    );
    const all = await listTransactions(request, cookie);

    // Assert
    expect(byItem.transactions.map((t) => t.name).sort()).toEqual(
      [...secondTxns.names].sort(),
    );
    expect(byItem.pagination.total).toBe(secondTxns.count);
    expect(byAccount.transactions.map((t) => t.name).sort()).toEqual(
      [...firstTxns.names].sort(),
    );
    expect(byAccount.pagination.total).toBe(firstTxns.count);
    expect(all.pagination.total).toBe(firstTxns.count + secondTxns.count);
  });

  test("filters by date range, including both ends", async ({ request }) => {
    // Arrange: four transactions on known days.
    const { cookie, userId } = await createAuthedUser(request);
    const item = await seedItemWithAccount(userId);
    const { names } = await seedTransactions({
      userId,
      itemId: item.itemId,
      accountId: item.accountId,
      dates: [
        new Date("2026-02-05T00:00:00.000Z"),
        new Date("2026-02-10T00:00:00.000Z"),
        new Date("2026-02-15T00:00:00.000Z"),
        new Date("2026-02-20T00:00:00.000Z"),
      ],
    });

    // Act
    const range = await listTransactions(
      request,
      cookie,
      "?startDate=2026-02-10&endDate=2026-02-15",
    );
    const from = await listTransactions(request, cookie, "?startDate=2026-02-15");
    const until = await listTransactions(request, cookie, "?endDate=2026-02-10");

    // Assert
    expect(range.transactions.map((t) => t.name).sort()).toEqual(
      [names[1], names[2]].sort(),
    );
    expect(from.transactions.map((t) => t.name).sort()).toEqual(
      [names[2], names[3]].sort(),
    );
    expect(until.transactions.map((t) => t.name).sort()).toEqual(
      [names[0], names[1]].sort(),
    );
  });

  test("returns the newest transactions first", async ({ request }) => {
    // Arrange: seeded oldest to newest.
    const { cookie, userId } = await createAuthedUser(request);
    const item = await seedItemWithAccount(userId);
    const { names } = await seedTransactions({
      userId,
      itemId: item.itemId,
      accountId: item.accountId,
      dates: [
        new Date("2026-03-01T00:00:00.000Z"),
        new Date("2026-03-04T00:00:00.000Z"),
        new Date("2026-03-02T00:00:00.000Z"),
        new Date("2026-03-03T00:00:00.000Z"),
      ],
    });

    // Act
    const data = await listTransactions(request, cookie);

    // Assert: by date, newest first (Mar 4, 3, 2, 1).
    expect(data.transactions.map((t) => t.name)).toEqual([
      names[1],
      names[3],
      names[2],
      names[0],
    ]);
  });

  test("pages through the results without overlap, and describes the whole set", async ({
    request,
  }) => {
    // Arrange: five transactions on five different days.
    const { cookie, userId } = await createAuthedUser(request);
    const item = await seedItemWithAccount(userId);
    const { names } = await seedTransactions({
      userId,
      itemId: item.itemId,
      accountId: item.accountId,
      dates: [1, 2, 3, 4, 5].map((day) => new Date(`2026-04-0${day}T00:00:00.000Z`)),
    });
    const newestFirst = [...names].reverse();

    // Act
    const page1 = await listTransactions(request, cookie, "?limit=2&page=1");
    const page2 = await listTransactions(request, cookie, "?limit=2&page=2");
    const page3 = await listTransactions(request, cookie, "?limit=2&page=3");

    // Assert: consecutive slices of the newest-first order, and the same totals
    // on every page.
    expect(page1.transactions.map((t) => t.name)).toEqual(newestFirst.slice(0, 2));
    expect(page2.transactions.map((t) => t.name)).toEqual(newestFirst.slice(2, 4));
    expect(page3.transactions.map((t) => t.name)).toEqual(newestFirst.slice(4));
    for (const [page, data] of [[1, page1], [2, page2], [3, page3]] as const) {
      expect(data.pagination).toEqual({ page, limit: 2, total: 5, totalPages: 3 });
    }
  });

  test("defaults to the first page with a limit of 50", async ({ request }) => {
    // Arrange
    const { cookie, userId } = await createAuthedUser(request);
    const item = await seedItemWithAccount(userId);
    await seedTransactions({
      userId,
      itemId: item.itemId,
      accountId: item.accountId,
      count: 3,
    });

    // Act
    const data = await listTransactions(request, cookie);

    // Assert
    expect(data.pagination).toEqual({ page: 1, limit: 50, total: 3, totalPages: 1 });
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

  test("rejects a date filter that is not a date (validation)", async ({
    request,
  }) => {
    // Arrange
    const { cookie } = await createAuthedUser(request);

    // Act + Assert: a bad value is an error, not silently ignored (which would
    // return everything, unfiltered).
    for (const query of ["?startDate=not-a-date", "?endDate=2026-13-45"]) {
      const res = await request.get(`/api/transactions${query}`, {
        headers: withSession(cookie),
      });
      await expectValidationError(res);
    }
  });

  test("rejects a page or limit that is not a whole number (validation)", async ({
    request,
  }) => {
    // Arrange
    const { cookie } = await createAuthedUser(request);

    // Act + Assert: none of these may quietly fall back to the defaults.
    for (const query of [
      "?page=abc",
      "?limit=abc",
      "?page=1.5",
      "?limit=2x",
    ]) {
      const res = await request.get(`/api/transactions${query}`, {
        headers: withSession(cookie),
      });
      await expectValidationError(res);
    }
  });

  test("treats empty filters as no filter", async ({ request }) => {
    // Arrange: a client may send the parameters with no value.
    const { cookie, userId } = await createAuthedUser(request);
    const item = await seedItemWithAccount(userId);
    await seedTransactions({
      userId,
      itemId: item.itemId,
      accountId: item.accountId,
      count: 2,
    });

    // Act
    const data = await listTransactions(
      request,
      cookie,
      "?itemId=&accountId=&startDate=&endDate=&page=&limit=",
    );

    // Assert
    expect(data.pagination).toEqual({ page: 1, limit: 50, total: 2, totalPages: 1 });
  });

  test("rejects a non-positive page (validation)", async ({ request }) => {
    const { cookie } = await createAuthedUser(request);
    const res = await request.get("/api/transactions?page=0", {
      headers: withSession(cookie),
    });
    await expectValidationError(res);
  });

  test("returns the category, merchant logo, location and payment details in their documented shape", async ({
    request,
  }) => {
    // Arrange
    const { cookie, userId } = await createAuthedUser(request);
    const item = await seedItemWithAccount(userId);
    await seedTransactions({
      userId,
      itemId: item.itemId,
      accountId: item.accountId,
      rows: [
        {
          date: new Date("2026-07-02T00:00:00.000Z"),
          categoryPrimary: "TRAVEL",
          categoryDetailed: "TRAVEL_FLIGHTS",
          logoUrl: "https://example.com/logo.png",
          website: "example.com",
          paymentChannel: "online",
          location: { city: "Toronto", postal_code: "M5V", lat: 43.6, store_number: "12" },
          paymentMeta: { reference_number: "R1", payer: "Ada" },
        },
        { date: new Date("2026-07-01T00:00:00.000Z"), categoryPrimary: null, categoryDetailed: null },
      ],
    });

    // Act (newest first, so the detailed transaction comes first)
    const res = await request.get("/api/transactions", {
      headers: withSession(cookie),
    });

    // Assert: the stored snake_case keys come back as camelCase, and a
    // transaction without a category has `category: null`.
    await expectOk(res);
    const body = await expectMatchesSchema(res, TransactionsResponseSchema);
    const [withDetails, bare] = body.data.transactions;
    expect(withDetails).toMatchObject({
      category: { primary: "TRAVEL", detailed: "TRAVEL_FLIGHTS" },
      logoUrl: "https://example.com/logo.png",
      website: "example.com",
      paymentChannel: "online",
      location: { city: "Toronto", postalCode: "M5V", lat: 43.6, storeNumber: "12" },
      paymentMeta: { referenceNumber: "R1", payer: "Ada" },
    });
    expect(bare.category).toBeNull();
    expect(bare.location).toBeNull();
    expect(bare.paymentMeta).toBeNull();
  });
});
