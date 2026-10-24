import { expect, test, type APIRequestContext } from "@playwright/test";
import { SpendingHabitsResponseSchema } from "@opulus/core";
import { withSession } from "../../../shared/client.js";
import {
  expectMatchesSchema,
  expectValidationError,
} from "../../../shared/assertions.js";
import {
  clearExchangeRates,
  createAuthedUser,
  seedItemWithAccount,
  seedTransactions,
  type SeedTransactionRow,
} from "../../../shared/fixtures/index.js";

/** GET /api/transactions/spending-habits with an optional query string; returns `data`. */
async function getHabits(
  request: APIRequestContext,
  cookie: string,
  query = "?date=2026-10-15",
) {
  const res = await request.get(`/api/transactions/spending-habits${query}`, {
    headers: withSession(cookie),
  });
  const body = await expectMatchesSchema(res, SpendingHabitsResponseSchema);
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

const on = (month: number, day: number) =>
  new Date(
    `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00.000Z`,
  );

/**
 * This file: the spending-habits endpoint (this month's spending so far per
 * category against the average of the same days in the 3 months before,
 * flagged at 20% and $50 over). Every spec measures up to October 15, 2026
 * (`date=2026-10-15`), so the windows are Oct 1-15, Sep 1-15, Aug 1-15 and
 * Jul 1-15. All amounts are in CAD, the base currency, so no rates are read.
 */
test.describe("GET /api/transactions/spending-habits", () => {
  test.beforeAll(async () => {
    await clearExchangeRates();
  });

  test("returns nothing for a user with no transactions", async ({
    request,
  }) => {
    const { cookie } = await createAuthedUser(request);
    const data = await getHabits(request, cookie);
    expect(data).toMatchObject({
      baseCurrency: "CAD",
      rule: { months: 3, minIncreaseRatio: 0.2, minIncrease: 50 },
      monthsCompared: 0,
      categories: [],
    });
  });

  test("compares this month so far with the same days of the 3 months before", async ({
    request,
  }) => {
    const { cookie } = await setup(request, [
      // Usual: (100 + 200 + 300) / 3 = 200. Spending after the 15th is ignored.
      { amount: 100, date: on(7, 10) },
      { amount: 999, date: on(7, 20) },
      { amount: 200, date: on(8, 15) },
      { amount: 300, date: on(9, 1) },
      { amount: 75, name: "Lunch", date: on(10, 2) },
      { amount: 75, name: "Dinner", date: on(10, 9) },
      { amount: 75, name: "Brunch", date: on(10, 12) },
      { amount: 75, name: "Snack", date: on(10, 15) },
      // After the date, so not counted yet.
      { amount: 500, date: on(10, 20) },
    ]);

    const data = await getHabits(request, cookie);

    expect(data.monthsCompared).toBe(3);
    expect(data.categories).toHaveLength(1);
    expect(data.categories[0]).toMatchObject({
      category: "FOOD_AND_DRINK",
      spent: 300,
      usual: 200,
      change: 100,
      changeRatio: 0.5,
      flagged: true,
      tag: "habit",
      topDetailedCategory: { category: "FOOD_AND_DRINK_FAST_FOOD", spent: 300 },
    });
    expect(data.categories[0]!.largestTransaction).toMatchObject({
      spent: 75,
      date: expect.stringMatching(/^2026-10-/),
    });
  });

  test("tags a flagged category driven by one transaction as a one-off", async ({
    request,
  }) => {
    const { cookie } = await setup(request, [
      { amount: 100, date: on(9, 5) },
      { amount: 20, date: on(10, 3) },
      { amount: 400, name: "Wedding gift", date: on(10, 8) },
    ]);

    const data = await getHabits(request, cookie);

    expect(data.categories[0]).toMatchObject({
      flagged: true,
      tag: "one-off",
      largestTransaction: { name: "Wedding gift", spent: 400 },
    });
  });

  test("does not flag a category under the 20% or $50 bounds", async ({
    request,
  }) => {
    const { cookie } = await setup(request, [
      // +$100 but only +10%.
      { amount: 1000, categoryPrimary: "RENT_AND_UTILITIES", date: on(9, 2) },
      { amount: 1100, categoryPrimary: "RENT_AND_UTILITIES", date: on(10, 2) },
      // +25% but only +$5.
      { amount: 20, categoryPrimary: "TRAVEL", date: on(9, 2) },
      { amount: 25, categoryPrimary: "TRAVEL", date: on(10, 2) },
    ]);

    const data = await getHabits(request, cookie);

    expect(data.categories.map((c) => [c.category, c.flagged, c.tag])).toEqual([
      ["RENT_AND_UTILITIES", false, null],
      ["TRAVEL", false, null],
    ]);
  });

  test("does not compare or flag a user with no earlier spending", async ({
    request,
  }) => {
    const { cookie } = await setup(request, [{ amount: 900, date: on(10, 3) }]);

    const data = await getHabits(request, cookie);

    expect(data.monthsCompared).toBe(0);
    expect(data.categories[0]).toMatchObject({
      spent: 900,
      usual: null,
      change: null,
      flagged: false,
    });
  });

  test("lists a category with usual spending but none this month", async ({
    request,
  }) => {
    const { cookie } = await setup(request, [
      { amount: 90, categoryPrimary: "TRAVEL", date: on(9, 2) },
    ]);

    const data = await getHabits(request, cookie);

    expect(data.categories).toEqual([
      expect.objectContaining({
        category: "TRAVEL",
        spent: 0,
        usual: 90,
        flagged: false,
      }),
    ]);
  });

  test("stops at a short month's last day when the date is later than it", async ({
    request,
  }) => {
    const { cookie } = await setup(request, [
      // February 2026 has 28 days, so for date=2026-03-31 its window is the
      // whole month.
      { amount: 60, date: on(2, 28) },
      { amount: 70, date: on(3, 1) },
    ]);

    const data = await getHabits(request, cookie, "?date=2026-03-31");

    expect(data.monthsCompared).toBe(1);
    expect(data.categories[0]).toMatchObject({ spent: 70, usual: 60 });
  });

  test("honours the transaction filters and ignores money in", async ({
    request,
  }) => {
    const { cookie } = await setup(request, [
      { amount: 100, categoryPrimary: "TRAVEL", date: on(9, 2) },
      { amount: 300, categoryPrimary: "TRAVEL", date: on(10, 2) },
      { amount: 100, categoryPrimary: "FOOD_AND_DRINK", date: on(10, 2) },
      { amount: -2000, categoryPrimary: "INCOME", date: on(10, 2) },
    ]);

    const data = await getHabits(
      request,
      cookie,
      "?date=2026-10-15&category=TRAVEL",
    );

    expect(data.categories.map((c) => c.category)).toEqual(["TRAVEL"]);
  });

  test("rejects an invalid date", async ({ request }) => {
    const { cookie } = await createAuthedUser(request);
    for (const date of ["garbage", "2026-02-30", "2026-1-5"]) {
      const res = await request.get(
        `/api/transactions/spending-habits?date=${date}`,
        { headers: withSession(cookie) },
      );
      await expectValidationError(res);
    }
  });

  test("requires a session", async ({ request }) => {
    const res = await request.get("/api/transactions/spending-habits");
    expect(res.status()).toBe(401);
  });
});
