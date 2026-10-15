import { expect, test, type APIRequestContext } from "@playwright/test";
import { TransactionsSummaryResponseSchema } from "@opulus/core";
import { withSession } from "../../../shared/client.js";
import {
  expectMatchesSchema,
  expectStatus,
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

/** GET /api/transactions/summary with an optional query string; returns `data`. */
async function getSummary(
  request: APIRequestContext,
  cookie: string,
  query = "",
) {
  const res = await request.get(`/api/transactions/summary${query}`, {
    headers: withSession(cookie),
  });
  const body = await expectMatchesSchema(
    res,
    TransactionsSummaryResponseSchema,
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

const iso = (d: number) => `2026-06-${String(d).padStart(2, "0")}`;

/**
 * The rates in exchange_rate for these specs, per euro: on every weekday of
 * June 2026, CAD 1.5 and USD 1.2 (so 1 USD = 1.25 CAD), except June 15 (USD
 * 1.0: 1 USD = 1.5 CAD) and Friday June 19 (USD 0.75: 1 USD = 2 CAD). Weekends
 * have none, like the real rates.
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
 * This file: the transactions summary endpoint (totals, spending by category
 * and by day for the filtered transactions). `byDay` is in the base currency,
 * each day at its own rate from exchange_rate, which this file clears and
 * seeds once (see juneRates): the table is shared by every user, and no third
 * party is involved.
 */
test.describe("GET /api/transactions/summary", () => {
  test.beforeAll(async () => {
    await clearExchangeRates();
    await seedExchangeRates(juneRates());
  });

  test("requires authentication (401)", async ({ request }) => {
    const res = await request.get("/api/transactions/summary");
    await expectStatus(res, 401);
  });

  test("returns empty lists for a user with no transactions", async ({
    request,
  }) => {
    const { cookie } = await createAuthedUser(request);
    const data = await getSummary(request, cookie);
    expect(data).toEqual({
      baseCurrency: "CAD",
      totals: [],
      byCategory: [],
      byDay: [],
    });
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

  test("breaks spending down by category, largest first, and the days oldest first", async ({
    request,
  }) => {
    const { cookie } = await setup(request, [
      { amount: 30, categoryPrimary: "FOOD_AND_DRINK", date: day(1) },
      { amount: 20, categoryPrimary: "FOOD_AND_DRINK", date: day(2) },
      { amount: 100, categoryPrimary: "TRAVEL", date: day(2) },
      {
        amount: 7,
        categoryPrimary: null,
        categoryDetailed: null,
        date: day(3),
      },
      { amount: -500, categoryPrimary: "INCOME", date: day(3) },
    ]);

    const data = await getSummary(request, cookie);

    // Income is not spending, so it is not in the category breakdown.
    expect(data.byCategory).toEqual([
      { currency: "CAD", category: "TRAVEL", spent: 100, count: 1 },
      { currency: "CAD", category: "FOOD_AND_DRINK", spent: 50, count: 2 },
      { currency: "CAD", category: null, spent: 7, count: 1 },
    ]);
    expect(data.byDay).toEqual([
      { date: "2026-06-01", spent: 30, income: 0, net: -30 },
      { date: "2026-06-02", spent: 120, income: 0, net: -120 },
      { date: "2026-06-03", spent: 7, income: 500, net: 493 },
    ]);
  });

  test("gives each day's net in the base currency, including a day with only money in", async ({
    request,
  }) => {
    // Day 1: 12.50 CAD out, and in USD 5 out and 1.25 in (at 1.25 CAD each:
    // 6.25 out, 1.5625 in). Day 2: a 2,000 CAD deposit.
    const { cookie } = await setup(request, [
      { amount: 12.5, date: day(1) },
      { amount: -2000, date: day(2), categoryPrimary: "INCOME" },
      { amount: 5, isoCurrencyCode: "USD", date: day(1) },
      { amount: -1.25, isoCurrencyCode: "USD", date: day(1) },
    ]);

    const data = await getSummary(request, cookie);

    expect(data.baseCurrency).toBe("CAD");
    expect(data.byDay).toEqual([
      { date: "2026-06-01", spent: 18.75, income: 1.5625, net: -17.1875 },
      { date: "2026-06-02", spent: 0, income: 2000, net: 2000 },
    ]);
  });

  test("converts each day at that day's rate", async ({ request }) => {
    // 100 USD on June 15 (1.5 CAD each) and on June 16 (1.25 CAD each).
    const { cookie } = await setup(request, [
      { amount: 100, isoCurrencyCode: "USD", date: day(15) },
      { amount: 100, isoCurrencyCode: "USD", date: day(16) },
    ]);

    const data = await getSummary(request, cookie);

    expect(data.byDay).toEqual([
      { date: "2026-06-15", spent: 150, income: 0, net: -150 },
      { date: "2026-06-16", spent: 125, income: 0, net: -125 },
    ]);
  });

  test("uses the latest earlier rate on a day with none, like a weekend", async ({
    request,
  }) => {
    // Saturday June 20 has no rate, so Friday June 19's applies (2 CAD per USD).
    const { cookie } = await setup(request, [
      { amount: 10, isoCurrencyCode: "USD", date: day(20) },
    ]);

    const data = await getSummary(request, cookie);

    expect(data.byDay).toEqual([
      { date: "2026-06-20", spent: 20, income: 0, net: -20 },
    ]);
  });

  test("leaves currencies with no stored rate out of the days, but not out of the totals", async ({
    request,
  }) => {
    const { cookie } = await setup(request, [
      { amount: 10, date: day(1) },
      { amount: 80, isoCurrencyCode: "XXX", date: day(1) },
    ]);

    const data = await getSummary(request, cookie);

    expect(data.byDay).toEqual([
      { date: "2026-06-01", spent: 10, income: 0, net: -10 },
    ]);
    expect(data.totals.map((t) => [t.currency, t.spent])).toEqual([
      ["CAD", 10],
      ["XXX", 80],
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

  test("hideTransfers takes transfers out of the totals", async ({
    request,
  }) => {
    const { cookie } = await setup(request, [
      { amount: 25, date: day(1) },
      {
        amount: 1000,
        date: day(1),
        categoryPrimary: "TRANSFER_OUT",
        categoryDetailed: "TRANSFER_OUT_ACCOUNT_TRANSFER",
      },
      {
        amount: 300,
        date: day(1),
        categoryPrimary: "LOAN_PAYMENTS",
        categoryDetailed: "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT",
      },
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
    expect(data.byDay).toEqual([
      { date: "2026-06-01", spent: 100, income: 0, net: -100 },
    ]);
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
