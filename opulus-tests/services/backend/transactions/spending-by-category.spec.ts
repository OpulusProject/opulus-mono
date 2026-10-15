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
 * share of the total for the filtered transactions, in the base currency, with
 * an optional top N). The backend is started with fixed exchange rates
 * (EXCHANGE_RATES_SOURCE=fixed, USD 1.25 and EUR 1.5 to the CAD base), so no
 * third party is involved.
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
    expect(data).toEqual({
      baseCurrency: "CAD",
      spent: 0,
      categories: [],
      other: null,
      rates: [],
      unconverted: [],
    });
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

    expect(data).toEqual({
      baseCurrency: "CAD",
      spent: 200,
      categories: [
        {
          category: "TRAVEL",
          spent: 100,
          count: 1,
          share: 0.5,
          amounts: [{ currency: "CAD", spent: 100 }],
        },
        {
          category: "FOOD_AND_DRINK",
          spent: 50,
          count: 2,
          share: 0.25,
          amounts: [{ currency: "CAD", spent: 50 }],
        },
        {
          category: null,
          spent: 50,
          count: 1,
          share: 0.25,
          amounts: [{ currency: "CAD", spent: 50 }],
        },
      ],
      other: null,
      rates: [],
      unconverted: [],
    });
  });

  test("converts other currencies to the base to rank and share, keeping what was paid", async ({
    request,
  }) => {
    // 100 USD is 125 CAD, so food outranks the 100 CAD of travel.
    const { cookie } = await setup(request, [
      { amount: 100, isoCurrencyCode: "CAD", categoryPrimary: "TRAVEL", date: day(1) },
      { amount: 100, isoCurrencyCode: "USD", categoryPrimary: "FOOD_AND_DRINK", date: day(1) },
    ]);

    const data = await getSpending(request, cookie);

    expect(data.spent).toBe(225);
    expect(data.categories.map((c) => [c.category, c.spent])).toEqual([
      ["FOOD_AND_DRINK", 125],
      ["TRAVEL", 100],
    ]);
    expect(data.categories[0].share).toBeCloseTo(125 / 225, 10);
    expect(data.categories[1].share).toBeCloseTo(100 / 225, 10);
    expect(data.categories[0].amounts).toEqual([{ currency: "USD", spent: 100 }]);
    expect(data.rates).toEqual([{ currency: "USD", rate: 1.25 }]);
  });

  test("lists a category once, with what was spent in each currency", async ({
    request,
  }) => {
    const { cookie } = await setup(request, [
      { amount: 50, isoCurrencyCode: "CAD", categoryPrimary: "TRAVEL", date: day(1) },
      { amount: 40, isoCurrencyCode: "USD", categoryPrimary: "TRAVEL", date: day(2) },
      { amount: 30, isoCurrencyCode: "EUR", categoryPrimary: "FOOD_AND_DRINK", date: day(2) },
    ]);

    const data = await getSpending(request, cookie);

    // Travel is 50 + 40 USD (50 CAD) = 100 CAD, once, with both amounts.
    expect(data.categories).toMatchObject([
      {
        category: "TRAVEL",
        spent: 100,
        count: 2,
        amounts: [
          { currency: "CAD", spent: 50 },
          { currency: "USD", spent: 40 },
        ],
      },
      { category: "FOOD_AND_DRINK", spent: 45, count: 1 },
    ]);
    expect(data.rates).toEqual([
      { currency: "EUR", rate: 1.5 },
      { currency: "USD", rate: 1.25 },
    ]);
  });

  test("takes spending with no currency as the base currency", async ({
    request,
  }) => {
    const { cookie } = await setup(request, [
      { amount: 25, isoCurrencyCode: null, categoryPrimary: "TRAVEL", date: day(1) },
      { amount: 25, isoCurrencyCode: "CAD", categoryPrimary: "TRAVEL", date: day(1) },
    ]);

    const data = await getSpending(request, cookie);

    expect(data.spent).toBe(50);
    expect(data.categories[0].amounts).toEqual([
      { currency: "CAD", spent: 25 },
      { currency: null, spent: 25 },
    ]);
  });

  test("leaves out currencies with no known rate, and reports them", async ({
    request,
  }) => {
    const { cookie } = await setup(request, [
      { amount: 40, isoCurrencyCode: "CAD", categoryPrimary: "TRAVEL", date: day(1) },
      { amount: 80, isoCurrencyCode: "XXX", categoryPrimary: "TRAVEL", date: day(1) },
    ]);

    const data = await getSpending(request, cookie);

    // Shares are of what could be converted.
    expect(data.spent).toBe(40);
    expect(data.categories).toMatchObject([
      { category: "TRAVEL", spent: 40, share: 1, amounts: [{ currency: "CAD", spent: 40 }] },
    ]);
    expect(data.unconverted).toEqual([{ currency: "XXX", spent: 80 }]);
  });

  test("top lists only that many categories and adds up the rest", async ({
    request,
  }) => {
    const { cookie } = await setup(request, [
      { amount: 50, categoryPrimary: "TRAVEL", date: day(1) },
      { amount: 30, categoryPrimary: "FOOD_AND_DRINK", date: day(1) },
      { amount: 8, isoCurrencyCode: "USD", categoryPrimary: "PERSONAL_CARE", date: day(1) },
      { amount: 5, categoryPrimary: "PERSONAL_CARE", date: day(2) },
      { amount: 5, categoryPrimary: "TRANSPORTATION", date: day(1) },
    ]);

    const data = await getSpending(request, cookie, "?top=2");

    // Personal care is 8 USD (10 CAD) + 5 CAD; transportation is 5 CAD.
    expect(data.spent).toBe(100);
    expect(data.categories.map((c) => [c.category, c.spent, c.share])).toEqual([
      ["TRAVEL", 50, 0.5],
      ["FOOD_AND_DRINK", 30, 0.3],
    ]);
    expect(data.other).toEqual({
      categories: 2,
      spent: 20,
      count: 3,
      share: 0.2,
      amounts: [
        { currency: "CAD", spent: 10 },
        { currency: "USD", spent: 8 },
      ],
    });
  });

  test("has no other row when top covers every category", async ({
    request,
  }) => {
    const { cookie } = await setup(request, [
      { amount: 50, categoryPrimary: "TRAVEL", date: day(1) },
      { amount: 30, categoryPrimary: "FOOD_AND_DRINK", date: day(1) },
    ]);

    const data = await getSpending(request, cookie, "?top=2");

    expect(data.categories).toHaveLength(2);
    expect(data.other).toBeNull();
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

    expect(byDate.spent).toBe(120);
    expect(bySearch.categories).toMatchObject([
      { category: "FOOD_AND_DRINK", spent: 50, count: 2, share: 1 },
    ]);
    expect(byCategory.categories).toMatchObject([
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

    expect(hidden.spent).toBe(25);
    expect(shown.spent).toBe(1325);
  });

  test("scopes the spending to the requesting user", async ({ request }) => {
    const mine = await setup(request, [{ amount: 10, date: day(1) }]);
    await setup(request, [{ amount: 9999, date: day(1) }]);

    const data = await getSpending(request, mine.cookie);

    expect(data.spent).toBe(10);
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
