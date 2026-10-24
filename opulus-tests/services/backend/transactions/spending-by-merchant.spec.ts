import { expect, test, type APIRequestContext } from "@playwright/test";
import { SpendingByMerchantResponseSchema } from "@opulus/core";
import { withSession } from "../../../shared/client.js";
import {
  expectMatchesSchema,
  expectValidationError,
} from "../../../shared/assertions.js";
import {
  clearExchangeRates,
  createAuthedUser,
  seedExchangeRates,
  seedItemWithAccount,
  seedTransactions,
  type SeedTransactionRow,
} from "../../../shared/fixtures/index.js";

/** GET /api/transactions/spending-by-merchant with an optional query string; returns `data`. */
async function getSpending(
  request: APIRequestContext,
  cookie: string,
  query = "",
) {
  const res = await request.get(
    `/api/transactions/spending-by-merchant${query}`,
    { headers: withSession(cookie) },
  );
  const body = await expectMatchesSchema(res, SpendingByMerchantResponseSchema);
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

const iso = (d: number) => `2026-06-${String(d).padStart(2, "0")}`;

/**
 * The rates in exchange_rate for these specs, per euro: on every weekday of
 * June 2026, CAD 1.5 and USD 1.2 (so 1 USD = 1.25 CAD and 1 EUR = 1.5 CAD),
 * except June 15 (USD 1.0: 1 USD = 1.5 CAD) and Friday June 19 (USD 0.75:
 * 1 USD = 2 CAD). Weekends have none, like the real rates.
 */
function juneRates() {
  const rates: { date: string; currency: string; perEur: number }[] = [];
  for (let d = 1; d <= 30; d++) {
    const weekday = day(d).getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    const usd = d === 15 ? 1.0 : d === 19 ? 0.75 : 1.2;
    rates.push(
      { date: iso(d), currency: "EUR", perEur: 1 },
      { date: iso(d), currency: "CAD", perEur: 1.5 },
      { date: iso(d), currency: "USD", perEur: usd },
    );
  }
  return rates;
}

/**
 * This file: the spending-by-merchant endpoint (each merchant's spending, share
 * of the total and main category for the filtered transactions, in the base
 * currency, with an optional top N). Conversions read exchange_rate, seeded
 * once for the file with known rates (see juneRates).
 */
test.describe("GET /api/transactions/spending-by-merchant", () => {
  test.beforeAll(async () => {
    await clearExchangeRates();
    await seedExchangeRates(juneRates());
  });

  test("returns no spending for a user with no transactions", async ({
    request,
  }) => {
    const { cookie } = await createAuthedUser(request);
    expect(await getSpending(request, cookie)).toEqual({
      baseCurrency: "CAD",
      spent: 0,
      merchants: [],
      other: null,
    });
  });

  test("lists each merchant largest first with its share, count and category", async ({
    request,
  }) => {
    const { cookie } = await setup(request, [
      {
        amount: 30,
        merchantName: "Starbucks",
        categoryPrimary: "FOOD_AND_DRINK",
        date: day(1),
      },
      {
        amount: 20,
        merchantName: "Starbucks",
        categoryPrimary: "FOOD_AND_DRINK",
        date: day(2),
      },
      {
        amount: 100,
        merchantName: "Air Canada",
        categoryPrimary: "TRAVEL",
        date: day(2),
      },
      {
        amount: 50,
        merchantName: null,
        categoryPrimary: null,
        categoryDetailed: null,
        date: day(3),
      },
      // Money in is not spending.
      {
        amount: -500,
        merchantName: "Employer",
        categoryPrimary: "INCOME",
        date: day(3),
      },
    ]);

    const data = await getSpending(request, cookie);

    expect(data).toEqual({
      baseCurrency: "CAD",
      spent: 200,
      merchants: [
        {
          merchant: "Air Canada",
          category: "TRAVEL",
          spent: 100,
          count: 1,
          share: 0.5,
        },
        {
          merchant: "Starbucks",
          category: "FOOD_AND_DRINK",
          spent: 50,
          count: 2,
          share: 0.25,
        },
        { merchant: null, category: null, spent: 50, count: 1, share: 0.25 },
      ],
      other: null,
    });
  });

  test("lists a merchant once, adding up each currency and day at that day's rate", async ({
    request,
  }) => {
    // 100 USD on June 15 is 150 CAD, on June 16 is 125 CAD, plus 50 CAD.
    const { cookie } = await setup(request, [
      {
        amount: 100,
        isoCurrencyCode: "USD",
        merchantName: "Hotel",
        categoryPrimary: "TRAVEL",
        date: day(15),
      },
      {
        amount: 100,
        isoCurrencyCode: "USD",
        merchantName: "Hotel",
        categoryPrimary: "TRAVEL",
        date: day(16),
      },
      {
        amount: 50,
        isoCurrencyCode: "CAD",
        merchantName: "Hotel",
        categoryPrimary: "TRAVEL",
        date: day(16),
      },
    ]);

    const data = await getSpending(request, cookie);

    expect(data.merchants).toEqual([
      { merchant: "Hotel", category: "TRAVEL", spent: 325, count: 3, share: 1 },
    ]);
  });

  test("a merchant's category is the one it spent most in", async ({
    request,
  }) => {
    const { cookie } = await setup(request, [
      {
        amount: 30,
        merchantName: "Costco",
        categoryPrimary: "GENERAL_MERCHANDISE",
        date: day(1),
      },
      {
        amount: 80,
        merchantName: "Costco",
        categoryPrimary: "FOOD_AND_DRINK",
        date: day(2),
      },
    ]);

    const data = await getSpending(request, cookie);

    expect(data.merchants).toMatchObject([
      { merchant: "Costco", category: "FOOD_AND_DRINK", spent: 110, count: 2 },
    ]);
  });

  test("top lists only that many merchants and adds up the rest", async ({
    request,
  }) => {
    const { cookie } = await setup(request, [
      { amount: 50, merchantName: "A", date: day(1) },
      { amount: 30, merchantName: "B", date: day(1) },
      { amount: 8, isoCurrencyCode: "USD", merchantName: "C", date: day(1) },
      { amount: 5, merchantName: "C", date: day(2) },
      { amount: 5, merchantName: "D", date: day(1) },
    ]);

    const data = await getSpending(request, cookie, "?top=2");

    // C is 8 USD (10 CAD) + 5 CAD; D is 5 CAD.
    expect(data.spent).toBe(100);
    expect(data.merchants.map((m) => [m.merchant, m.spent, m.share])).toEqual([
      ["A", 50, 0.5],
      ["B", 30, 0.3],
    ]);
    expect(data.other).toEqual({
      merchants: 2,
      spent: 20,
      count: 3,
      share: 0.2,
    });
  });

  test("applies the same filters as the list", async ({ request }) => {
    const { cookie } = await setup(request, [
      {
        amount: 30,
        merchantName: "Coffee Shop",
        name: "Coffee Shop",
        date: day(1),
      },
      {
        amount: 20,
        merchantName: "Coffee Roasters",
        name: "Coffee Roasters",
        date: day(10),
      },
      {
        amount: 100,
        merchantName: "Hotel",
        name: "Hotel",
        categoryPrimary: "TRAVEL",
        date: day(10),
      },
      {
        amount: 1000,
        merchantName: "Bank",
        categoryPrimary: "TRANSFER_OUT",
        categoryDetailed: "TRANSFER_OUT_ACCOUNT_TRANSFER",
        date: day(10),
      },
    ]);

    const byDate = await getSpending(
      request,
      cookie,
      "?startDate=2026-06-05&hideTransfers=true",
    );
    const bySearch = await getSpending(request, cookie, "?search=coffee");
    const byCategory = await getSpending(request, cookie, "?category=TRAVEL");

    expect(byDate.spent).toBe(120);
    expect(bySearch.merchants.map((m) => m.merchant)).toEqual([
      "Coffee Shop",
      "Coffee Roasters",
    ]);
    expect(byCategory.merchants).toMatchObject([
      { merchant: "Hotel", share: 1 },
    ]);
  });

  test("scopes the spending to the requesting user", async ({ request }) => {
    const mine = await setup(request, [
      { amount: 10, merchantName: "A", date: day(1) },
    ]);
    await setup(request, [{ amount: 9999, merchantName: "B", date: day(1) }]);

    const data = await getSpending(request, mine.cookie);

    expect(data.merchants.map((m) => m.merchant)).toEqual(["A"]);
  });

  test("rejects invalid filters and top (validation)", async ({ request }) => {
    const { cookie } = await createAuthedUser(request);
    for (const query of [
      "?startDate=garbage",
      "?category=NOPE",
      "?top=0",
      "?top=abc",
      "?top=51",
    ]) {
      const res = await request.get(
        `/api/transactions/spending-by-merchant${query}`,
        {
          headers: withSession(cookie),
        },
      );
      await expectValidationError(res);
    }
  });
});
