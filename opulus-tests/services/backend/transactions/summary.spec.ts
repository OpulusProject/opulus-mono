import { expect, test, type APIRequestContext } from "@playwright/test";
import { TransactionsSummaryResponseSchema } from "@opulus/core";
import { withSession } from "../../../shared/client.js";
import {
  expectMatchesSchema,
  expectStatus,
  expectValidationError,
} from "../../../shared/assertions.js";
import {
  createAuthedUser,
  seedItemWithAccount,
  seedTransactions,
  type SeedTransactionRow,
} from "../../../shared/fixtures/index.js";

/** GET /api/transactions/summary with an optional query string; returns `data`. */
async function getSummary(
  request: APIRequestContext,
  cookie: string,
  query = "",
) {
  const res = await request.get(`/api/transactions/summary${query}`, {
    headers: withSession(cookie),
  });
  const body = await expectMatchesSchema(res, TransactionsSummaryResponseSchema);
  return body.data;
}

/** A user with one account and the given transactions. */
async function setup(request: APIRequestContext, rows: SeedTransactionRow[]) {
  const { cookie, userId } = await createAuthedUser(request);
  const item = await seedItemWithAccount(userId);
  await seedTransactions({
    userId,
    itemId: item.itemId,
    accountId: item.accountId,
    rows,
  });
  return { cookie, userId, item };
}

const day = (d: number) => new Date(`2026-06-${String(d).padStart(2, "0")}T00:00:00.000Z`);

/**
 * This file: the transactions summary endpoint (totals, spending by category
 * and by day for the filtered transactions).
 */
test.describe("GET /api/transactions/summary", () => {
  test("requires authentication (401)", async ({ request }) => {
    const res = await request.get("/api/transactions/summary");
    await expectStatus(res, 401);
  });

  test("returns empty lists for a user with no transactions", async ({
    request,
  }) => {
    const { cookie } = await createAuthedUser(request);
    const data = await getSummary(request, cookie);
    expect(data).toEqual({ totals: [], byCategory: [], byDay: [] });
  });

  test("totals what was spent and what came in, with the net", async ({
    request,
  }) => {
    // Arrange: positive = money out, negative = money in.
    const { cookie } = await setup(request, [
      { amount: 40, date: day(1) },
      { amount: 10.5, date: day(2) },
      { amount: -2000, date: day(3), categoryPrimary: "INCOME" },
    ]);

    // Act
    const data = await getSummary(request, cookie);

    // Assert
    expect(data.totals).toEqual([
      { currency: "CAD", spent: 50.5, income: 2000, net: 1949.5, count: 3 },
    ]);
  });

  test("keeps currencies apart", async ({ request }) => {
    const { cookie } = await setup(request, [
      { amount: 10, isoCurrencyCode: "CAD", date: day(1) },
      { amount: 20, isoCurrencyCode: "USD", date: day(1) },
      { amount: 5, isoCurrencyCode: "USD", date: day(2) },
    ]);

    const data = await getSummary(request, cookie);

    expect(data.totals).toEqual([
      { currency: "CAD", spent: 10, income: 0, net: -10, count: 1 },
      { currency: "USD", spent: 25, income: 0, net: -25, count: 2 },
    ]);
  });

  test("breaks spending down by category, largest first, and by day, oldest first", async ({
    request,
  }) => {
    const { cookie } = await setup(request, [
      { amount: 30, categoryPrimary: "FOOD_AND_DRINK", date: day(1) },
      { amount: 20, categoryPrimary: "FOOD_AND_DRINK", date: day(2) },
      { amount: 100, categoryPrimary: "TRAVEL", date: day(2) },
      { amount: 7, categoryPrimary: null, categoryDetailed: null, date: day(3) },
      { amount: -500, categoryPrimary: "INCOME", date: day(3) },
    ]);

    const data = await getSummary(request, cookie);

    // Income is not spending, so it is not in the category or day breakdowns.
    expect(data.byCategory).toEqual([
      { currency: "CAD", category: "TRAVEL", spent: 100, count: 1 },
      { currency: "CAD", category: "FOOD_AND_DRINK", spent: 50, count: 2 },
      { currency: "CAD", category: null, spent: 7, count: 1 },
    ]);
    expect(data.byDay).toEqual([
      { currency: "CAD", date: "2026-06-01", spent: 30 },
      { currency: "CAD", date: "2026-06-02", spent: 120 },
      { currency: "CAD", date: "2026-06-03", spent: 7 },
    ]);
  });

  test("applies the same filters as the list", async ({ request }) => {
    const { cookie } = await setup(request, [
      { amount: 30, date: day(1), name: "Coffee Shop" },
      { amount: 20, date: day(10), name: "Coffee Roasters" },
      { amount: 99, date: day(10), name: "Hardware" },
    ]);

    const byDate = await getSummary(request, cookie, "?startDate=2026-06-05");
    const bySearch = await getSummary(request, cookie, "?search=coffee");

    expect(byDate.totals[0]).toMatchObject({ spent: 119, count: 2 });
    expect(bySearch.totals[0]).toMatchObject({ spent: 50, count: 2 });
  });

  test("hideTransfers takes transfers out of the totals", async ({ request }) => {
    const { cookie } = await setup(request, [
      { amount: 25, date: day(1) },
      { amount: 1000, date: day(1), categoryPrimary: "TRANSFER_OUT", categoryDetailed: "TRANSFER_OUT_ACCOUNT_TRANSFER" },
      { amount: 300, date: day(1), categoryPrimary: "LOAN_PAYMENTS", categoryDetailed: "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT" },
    ]);

    const hidden = await getSummary(request, cookie, "?hideTransfers=true");
    const shown = await getSummary(request, cookie);

    expect(hidden.totals[0]).toMatchObject({ spent: 25, count: 1 });
    expect(shown.totals[0]).toMatchObject({ spent: 1325, count: 3 });
  });

  test("the category breakdown ignores the category filter, so every category stays on screen", async ({
    request,
  }) => {
    const { cookie } = await setup(request, [
      { amount: 30, categoryPrimary: "FOOD_AND_DRINK", date: day(1) },
      { amount: 100, categoryPrimary: "TRAVEL", date: day(1) },
    ]);

    const data = await getSummary(request, cookie, "?category=TRAVEL");

    // Totals and days follow the filter; the category bars do not.
    expect(data.totals[0]).toMatchObject({ spent: 100, count: 1 });
    expect(data.byDay).toEqual([{ currency: "CAD", date: "2026-06-01", spent: 100 }]);
    expect(data.byCategory.map((c) => c.category).sort()).toEqual([
      "FOOD_AND_DRINK",
      "TRAVEL",
    ]);
  });

  test("scopes the summary to the requesting user", async ({ request }) => {
    const mine = await setup(request, [{ amount: 10, date: day(1) }]);
    await setup(request, [{ amount: 9999, date: day(1) }]);

    const data = await getSummary(request, mine.cookie);

    expect(data.totals).toEqual([
      { currency: "CAD", spent: 10, income: 0, net: -10, count: 1 },
    ]);
  });

  test("rejects invalid filters (validation)", async ({ request }) => {
    const { cookie } = await createAuthedUser(request);
    for (const query of [
      "?startDate=garbage",
      "?category=NOPE",
      "?hideTransfers=maybe",
      "?type=sideways",
    ]) {
      const res = await request.get(`/api/transactions/summary${query}`, {
        headers: withSession(cookie),
      });
      await expectValidationError(res);
    }
  });
});
