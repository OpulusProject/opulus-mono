import { expect, test, type APIRequestContext } from "@playwright/test";
import { MonthlyTransactionTotalsResponseSchema } from "@opulus/core";
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

/** GET /api/transactions/monthly-totals with an optional query string; returns `data`. */
async function getMonthlyTotals(
  request: APIRequestContext,
  cookie: string,
  query = "",
) {
  const res = await request.get(`/api/transactions/monthly-totals${query}`, {
    headers: withSession(cookie),
  });
  const body = await expectMatchesSchema(
    res,
    MonthlyTransactionTotalsResponseSchema,
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

const at = (date: string) => new Date(`${date}T00:00:00.000Z`);

/**
 * The rates in exchange_rate for these specs, per euro: CAD 1.5 and USD 1.2
 * (1 USD = 1.25 CAD) on the weekdays Sep 30 and Oct 1 2026, except Oct 1 where
 * USD is 1.0 (1 USD = 1.5 CAD).
 */
function rates() {
  return [
    { date: "2026-09-30", currency: "EUR", perEur: 1 },
    { date: "2026-09-30", currency: "CAD", perEur: 1.5 },
    { date: "2026-09-30", currency: "USD", perEur: 1.2 },
    { date: "2026-10-01", currency: "EUR", perEur: 1 },
    { date: "2026-10-01", currency: "CAD", perEur: 1.5 },
    { date: "2026-10-01", currency: "USD", perEur: 1.0 },
  ];
}

/**
 * This file: the monthly transaction totals endpoint (each month's spending
 * for the filtered transactions). `byMonth` is in the base currency, each
 * transaction at its day's rate from exchange_rate, which this file clears and
 * seeds once: the table is shared by every user, and no third party is
 * involved.
 */
test.describe("GET /api/transactions/monthly-totals", () => {
  test.beforeAll(async () => {
    await clearExchangeRates();
    await seedExchangeRates(rates());
  });

  test("returns no months for a user with no transactions", async ({
    request,
  }) => {
    const { cookie } = await createAuthedUser(request);
    const data = await getMonthlyTotals(request, cookie);
    expect(data).toEqual({ baseCurrency: "CAD", byMonth: [] });
  });

  test("adds up money out by month, oldest first, and ignores money in", async ({
    request,
  }) => {
    const { cookie } = await setup(request, [
      { amount: 10, date: at("2026-10-05") },
      { amount: 2.5, date: at("2026-10-20") },
      { amount: 5, date: at("2026-09-02") },
      { amount: -2000, date: at("2026-10-03"), categoryPrimary: "INCOME" },
    ]);

    const data = await getMonthlyTotals(request, cookie);

    expect(data.byMonth).toEqual([
      { month: "2026-09", spent: 5 },
      { month: "2026-10", spent: 12.5 },
    ]);
  });

  test("converts each transaction at its day's rate, across a month boundary", async ({
    request,
  }) => {
    // 100 USD on Sep 30 (1.25 CAD each) and on Oct 1 (1.5 CAD each).
    const { cookie } = await setup(request, [
      { amount: 100, isoCurrencyCode: "USD", date: at("2026-09-30") },
      { amount: 100, isoCurrencyCode: "USD", date: at("2026-10-01") },
      { amount: 10, date: at("2026-10-01") },
    ]);

    const data = await getMonthlyTotals(request, cookie);

    expect(data.byMonth).toEqual([
      { month: "2026-09", spent: 125 },
      { month: "2026-10", spent: 160 },
    ]);
  });

  test("follows the list's filters", async ({ request }) => {
    const { cookie } = await setup(request, [
      { amount: 10, date: at("2026-09-02") },
      { amount: 20, date: at("2026-10-02") },
    ]);

    const data = await getMonthlyTotals(
      request,
      cookie,
      "?startDate=2026-10-01",
    );

    expect(data.byMonth).toEqual([{ month: "2026-10", spent: 20 }]);
  });

  test("only counts the signed-in user's transactions", async ({ request }) => {
    await setup(request, [{ amount: 99, date: at("2026-10-02") }]);
    const { cookie } = await createAuthedUser(request);

    const data = await getMonthlyTotals(request, cookie);

    expect(data.byMonth).toEqual([]);
  });

  test("rejects an invalid filter", async ({ request }) => {
    const { cookie } = await createAuthedUser(request);
    const res = await request.get(
      "/api/transactions/monthly-totals?startDate=nope",
      { headers: withSession(cookie) },
    );
    await expectValidationError(res);
  });

  test("requires a session", async ({ request }) => {
    const res = await request.get("/api/transactions/monthly-totals");
    expect(res.status()).toBe(401);
  });
});
