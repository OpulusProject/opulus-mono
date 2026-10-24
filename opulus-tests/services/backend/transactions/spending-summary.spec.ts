import { expect, test, type APIRequestContext } from "@playwright/test";
import { SpendingSummaryResponseSchema } from "@opulus/core";
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

/** GET /api/transactions/spending-summary with a query string; returns `data`. */
async function getSummary(
  request: APIRequestContext,
  cookie: string,
  query = "?month=2026-06",
) {
  const res = await request.get(`/api/transactions/spending-summary${query}`, {
    headers: withSession(cookie),
  });
  const body = await expectMatchesSchema(res, SpendingSummaryResponseSchema);
  return body.data;
}

async function setup(request: APIRequestContext, rows: SeedTransactionRow[]) {
  const { cookie, userId } = await createAuthedUser(request);
  const item = await seedItemWithAccount(userId);
  await seedTransactions({
    userId,
    itemId: item.itemId,
    accountId: item.accountId,
    rows,
  });
  return { cookie };
}

const on = (month: string, d: number) =>
  new Date(`${month}-${String(d).padStart(2, "0")}T00:00:00.000Z`);

/**
 * This file: the spending summary endpoint. June 2026 is over, so it counts in
 * full (30 days) and is compared with May (31 days). The exchange_rate table is
 * cleared and seeded once: every weekday of June has CAD 1.5 and USD 1.2 per
 * euro (1 USD = 1.25 CAD).
 */
test.describe("GET /api/transactions/spending-summary", () => {
  test.beforeAll(async () => {
    await clearExchangeRates();
    const rates: { date: string; currency: string; perEur: number }[] = [];
    for (let d = 1; d <= 30; d++) {
      const iso = `2026-06-${String(d).padStart(2, "0")}`;
      rates.push(
        { date: iso, currency: "EUR", perEur: 1 },
        { date: iso, currency: "CAD", perEur: 1.5 },
        { date: iso, currency: "USD", perEur: 1.2 },
      );
    }
    await seedExchangeRates(rates);
  });

  test("returns zeros for a user with no transactions", async ({ request }) => {
    const { cookie } = await createAuthedUser(request);
    expect(await getSummary(request, cookie)).toEqual({
      baseCurrency: "CAD",
      month: "2026-06",
      daysElapsed: 30,
      daysInMonth: 30,
      spentSoFar: 0,
      lastMonthSameDays: 0,
      changePercent: null,
      dailyAverage: 0,
      projectedMonthEnd: 0,
      lastMonthTotal: 0,
    });
  });

  test("compares a month with the one before it, in the base currency", async ({
    request,
  }) => {
    // June: 100 CAD + 10 USD (12.50 CAD) + a deposit that does not count.
    // May: 90 CAD in total, but the 40 on May 31 is past June's 30 days.
    const { cookie } = await setup(request, [
      { amount: 100, date: on("2026-06", 3) },
      { amount: 10, isoCurrencyCode: "USD", date: on("2026-06", 20) },
      { amount: -2000, date: on("2026-06", 5), categoryPrimary: "INCOME" },
      { amount: 50, date: on("2026-05", 1) },
      { amount: 40, date: on("2026-05", 31) },
      { amount: 999, date: on("2026-04", 30) },
    ]);

    expect(await getSummary(request, cookie)).toEqual({
      baseCurrency: "CAD",
      month: "2026-06",
      daysElapsed: 30,
      daysInMonth: 30,
      spentSoFar: 112.5,
      lastMonthSameDays: 50,
      changePercent: 125,
      dailyAverage: 3.75,
      projectedMonthEnd: 112.5,
      lastMonthTotal: 90,
    });
  });

  test("follows the filters", async ({ request }) => {
    const { cookie } = await setup(request, [
      { amount: 100, date: on("2026-06", 3), categoryPrimary: "FOOD_AND_DRINK" },
      { amount: 30, date: on("2026-06", 4), categoryPrimary: "TRAVEL" },
    ]);

    const data = await getSummary(
      request,
      cookie,
      "?month=2026-06&category=TRAVEL",
    );

    expect(data.spentSoFar).toBe(30);
  });

  test("rejects invalid or future months and filters (validation)", async ({
    request,
  }) => {
    const { cookie } = await createAuthedUser(request);
    for (const query of [
      "?month=garbage",
      "?month=2026-13",
      "?month=2999-01",
      "?category=NOPE",
      "?hideTransfers=maybe",
    ]) {
      const res = await request.get(
        `/api/transactions/spending-summary${query}`,
        { headers: withSession(cookie) },
      );
      await expectValidationError(res);
    }
  });
});
