import { expect, test, type APIRequestContext } from "@playwright/test";
import { SpendingByCategoryResponseSchema } from "@opulus/core";
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

/** GET /api/transactions/spending-by-category with an optional query string; returns `data`. */
async function getSpending(
  request: APIRequestContext,
  cookie: string,
  query = "",
) {
  const res = await request.get(
    `/api/transactions/spending-by-category${query}`,
    { headers: withSession(cookie) },
  );
  const body = await expectMatchesSchema(
    res,
    SpendingByCategoryResponseSchema,
  );
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

const day = (d: number) =>
  new Date(`2026-06-${String(d).padStart(2, "0")}T00:00:00.000Z`);

/**
 * This file: the spending-by-category endpoint (each category's spending and
 * share of the total for the filtered transactions, with an optional top N).
 */
test.describe("GET /api/transactions/spending-by-category", () => {
  test("requires authentication (401)", async ({ request }) => {
    const res = await request.get("/api/transactions/spending-by-category");
    await expectStatus(res, 401);
  });

  test("returns no spending for a user with no transactions", async ({
    request,
  }) => {
    const { cookie } = await createAuthedUser(request);
    const data = await getSpending(request, cookie);
    expect(data).toEqual({ spending: [] });
  });

  test("lists each category largest first with its share of the total", async ({
    request,
  }) => {
    const { cookie } = await setup(request, [
      { amount: 30, categoryPrimary: "FOOD_AND_DRINK", date: day(1) },
      { amount: 20, categoryPrimary: "FOOD_AND_DRINK", date: day(2) },
      { amount: 100, categoryPrimary: "TRAVEL", date: day(2) },
      { amount: 50, categoryPrimary: null, categoryDetailed: null, date: day(3) },
      // Money in is not spending.
      { amount: -500, categoryPrimary: "INCOME", date: day(3) },
    ]);

    const data = await getSpending(request, cookie);

    expect(data.spending).toEqual([
      {
        currency: "CAD",
        spent: 200,
        categories: [
          { category: "TRAVEL", spent: 100, count: 1, share: 0.5 },
          { category: "FOOD_AND_DRINK", spent: 50, count: 2, share: 0.25 },
          { category: null, spent: 50, count: 1, share: 0.25 },
        ],
        other: null,
      },
    ]);
  });

  test("keeps currencies apart, each with shares of its own total", async ({
    request,
  }) => {
    const { cookie } = await setup(request, [
      { amount: 10, isoCurrencyCode: "CAD", categoryPrimary: "TRAVEL", date: day(1) },
      { amount: 30, isoCurrencyCode: "USD", categoryPrimary: "TRAVEL", date: day(1) },
      { amount: 10, isoCurrencyCode: "USD", categoryPrimary: "FOOD_AND_DRINK", date: day(1) },
    ]);

    const data = await getSpending(request, cookie);

    expect(data.spending.map((entry) => [entry.currency, entry.spent])).toEqual([
      ["CAD", 10],
      ["USD", 40],
    ]);
    expect(data.spending[0].categories).toEqual([
      { category: "TRAVEL", spent: 10, count: 1, share: 1 },
    ]);
    expect(data.spending[1].categories.map((c) => c.share)).toEqual([0.75, 0.25]);
  });

  test("top lists only that many categories and adds up the rest", async ({
    request,
  }) => {
    const { cookie } = await setup(request, [
      { amount: 50, categoryPrimary: "TRAVEL", date: day(1) },
      { amount: 30, categoryPrimary: "FOOD_AND_DRINK", date: day(1) },
      { amount: 10, categoryPrimary: "PERSONAL_CARE", date: day(1) },
      { amount: 5, categoryPrimary: "PERSONAL_CARE", date: day(2) },
      { amount: 5, categoryPrimary: "TRANSPORTATION", date: day(1) },
    ]);

    const data = await getSpending(request, cookie, "?top=2");

    expect(data.spending).toEqual([
      {
        currency: "CAD",
        spent: 100,
        categories: [
          { category: "TRAVEL", spent: 50, count: 1, share: 0.5 },
          { category: "FOOD_AND_DRINK", spent: 30, count: 1, share: 0.3 },
        ],
        other: { categories: 2, spent: 20, count: 3, share: 0.2 },
      },
    ]);
  });

  test("has no other row when top covers every category", async ({
    request,
  }) => {
    const { cookie } = await setup(request, [
      { amount: 50, categoryPrimary: "TRAVEL", date: day(1) },
      { amount: 30, categoryPrimary: "FOOD_AND_DRINK", date: day(1) },
    ]);

    const data = await getSpending(request, cookie, "?top=2");

    expect(data.spending[0].categories).toHaveLength(2);
    expect(data.spending[0].other).toBeNull();
  });

  test("applies the same filters as the list, including category", async ({
    request,
  }) => {
    const { cookie } = await setup(request, [
      { amount: 30, categoryPrimary: "FOOD_AND_DRINK", date: day(1), name: "Coffee Shop" },
      { amount: 20, categoryPrimary: "FOOD_AND_DRINK", date: day(10), name: "Coffee Roasters" },
      { amount: 100, categoryPrimary: "TRAVEL", date: day(10), name: "Hotel" },
    ]);

    const byDate = await getSpending(request, cookie, "?startDate=2026-06-05");
    const bySearch = await getSpending(request, cookie, "?search=coffee");
    // Unlike the summary's categories, the category filter applies here.
    const byCategory = await getSpending(request, cookie, "?category=TRAVEL");

    expect(byDate.spending[0].spent).toBe(120);
    expect(bySearch.spending[0].categories).toEqual([
      { category: "FOOD_AND_DRINK", spent: 50, count: 2, share: 1 },
    ]);
    expect(byCategory.spending[0].categories).toEqual([
      { category: "TRAVEL", spent: 100, count: 1, share: 1 },
    ]);
  });

  test("hideTransfers takes transfers out of the spending", async ({
    request,
  }) => {
    const { cookie } = await setup(request, [
      { amount: 25, categoryPrimary: "FOOD_AND_DRINK", date: day(1) },
      { amount: 1000, date: day(1), categoryPrimary: "TRANSFER_OUT", categoryDetailed: "TRANSFER_OUT_ACCOUNT_TRANSFER" },
      { amount: 300, date: day(1), categoryPrimary: "LOAN_PAYMENTS", categoryDetailed: "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT" },
    ]);

    const hidden = await getSpending(request, cookie, "?hideTransfers=true");
    const shown = await getSpending(request, cookie);

    expect(hidden.spending[0].spent).toBe(25);
    expect(shown.spending[0].spent).toBe(1325);
  });

  test("scopes the spending to the requesting user", async ({ request }) => {
    const mine = await setup(request, [{ amount: 10, date: day(1) }]);
    await setup(request, [{ amount: 9999, date: day(1) }]);

    const data = await getSpending(request, mine.cookie);

    expect(data.spending[0].spent).toBe(10);
  });

  test("rejects invalid filters and top (validation)", async ({ request }) => {
    const { cookie } = await createAuthedUser(request);
    for (const query of [
      "?startDate=garbage",
      "?category=NOPE",
      "?hideTransfers=maybe",
      "?top=0",
      "?top=abc",
      "?top=51",
    ]) {
      const res = await request.get(
        `/api/transactions/spending-by-category${query}`,
        { headers: withSession(cookie) },
      );
      await expectValidationError(res);
    }
  });
});
