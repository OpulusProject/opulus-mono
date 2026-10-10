import { expect, test, type APIRequestContext } from "@playwright/test";
import { NetWorthHistoryResponseSchema } from "@opulus/core";
import {
  expectMatchesSchema,
  expectOk,
  expectStatus,
  expectValidationError,
} from "../../../shared/assertions.js";
import { withSession } from "../../../shared/client.js";
import {
  createAuthedUser,
  seedHistoricBalances,
  seedItemWithAccount,
} from "../../../shared/fixtures/index.js";

interface Point {
  date: string;
  netWorth: number;
}
interface Series {
  currency: string | null;
  points: Point[];
}

/** The day this many days from today, "YYYY-MM-DD" (UTC), as the server counts. */
const day = (offset = 0) =>
  new Date(Date.now() + offset * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

async function getNetWorth(
  request: APIRequestContext,
  cookie: string,
  query = "",
): Promise<{ range: string; series: Series[] }> {
  const res = await request.get(`/api/accounts/net-worth${query}`, {
    headers: withSession(cookie),
  });
  await expectOk(res);
  // Every call must match the documented shape exactly.
  await expectMatchesSchema(res, NetWorthHistoryResponseSchema);
  return (await res.json()).data;
}

const netWorths = (series: Series) => series.points.map((p) => p.netWorth);

/**
 * This file: the net worth history endpoint. Accounts and their daily balance
 * historic balances have no create endpoint, so they are seeded directly into the
 * isolated test DB and verified over HTTP.
 */
test.describe("GET /api/accounts/net-worth", () => {
  test("requires authentication (401)", async ({ request }) => {
    const res = await request.get("/api/accounts/net-worth");
    await expectStatus(res, 401);
  });

  test("rejects an unknown range (400)", async ({ request }) => {
    // Arrange
    const { cookie } = await createAuthedUser(request);

    // Act
    const res = await request.get("/api/accounts/net-worth?range=5y", {
      headers: withSession(cookie),
    });

    // Assert
    await expectValidationError(res);
  });

  test("returns no series for a user with no accounts", async ({ request }) => {
    // Arrange
    const { cookie } = await createAuthedUser(request);

    // Act + Assert
    expect(await getNetWorth(request, cookie)).toEqual({
      range: "1m",
      series: [],
    });
  });

  test("returns a point for every day, oldest first, ending today", async ({
    request,
  }) => {
    // Arrange
    const { cookie, userId } = await createAuthedUser(request);
    await seedItemWithAccount(userId);

    // Act + Assert: each range is the days back from today, today included.
    for (const [range, days] of [
      ["1w", 7],
      ["1m", 30],
      ["3m", 90],
      ["1y", 365],
    ] as const) {
      const { series } = await getNetWorth(request, cookie, `?range=${range}`);
      expect(series).toHaveLength(1);
      expect(series[0].points).toHaveLength(days + 1);
      expect(series[0].points[0].date).toBe(day(-days));
      expect(series[0].points.at(-1)?.date).toBe(day());
    }
  });

  test("defaults to a month", async ({ request }) => {
    // Arrange
    const { cookie, userId } = await createAuthedUser(request);
    await seedItemWithAccount(userId);

    // Act
    const { range, series } = await getNetWorth(request, cookie);

    // Assert
    expect(range).toBe("1m");
    expect(series[0].points).toHaveLength(31);
  });

  test("holds an account with no historic balances at its live balance", async ({
    request,
  }) => {
    // Arrange
    const { cookie, userId } = await createAuthedUser(request);
    await seedItemWithAccount(userId, { account: { balanceCurrent: 1234.56 } });

    // Act
    const { series } = await getNetWorth(request, cookie, "?range=1w");

    // Assert
    expect(netWorths(series[0])).toEqual(Array(8).fill(1234.56));
  });

  test("uses the historic balances for past days and the live balance for today", async ({
    request,
  }) => {
    // Arrange: live balance 1000; closing balances for the last two days.
    const { cookie, userId } = await createAuthedUser(request);
    const { accountId } = await seedItemWithAccount(userId, {
      account: { balanceCurrent: 1000 },
    });
    await seedHistoricBalances({
      userId,
      accountId,
      balances: [
        { date: day(-2), balanceCurrent: 800 },
        { date: day(-1), balanceCurrent: 900 },
      ],
    });

    // Act
    const { series } = await getNetWorth(request, cookie, "?range=1w");

    // Assert: flat at the first historic balance before the history starts, then the
    // historic balances, then today's live balance.
    // 1w is 8 days: days -7 to -3 (flat), -2, -1, today.
    expect(netWorths(series[0])).toEqual([
      800, 800, 800, 800, 800, 800, 900, 1000,
    ]);
  });

  test("carries the last historic balance across a day with none", async ({
    request,
  }) => {
    // Arrange: a night was missed (nothing on day -2).
    const { cookie, userId } = await createAuthedUser(request);
    const { accountId } = await seedItemWithAccount(userId, {
      account: { balanceCurrent: 1000 },
    });
    await seedHistoricBalances({
      userId,
      accountId,
      balances: [
        { date: day(-3), balanceCurrent: 700 },
        { date: day(-1), balanceCurrent: 900 },
      ],
    });

    // Act
    const { series } = await getNetWorth(request, cookie, "?range=1w");
    const byDate = Object.fromEntries(
      series[0].points.map((p) => [p.date, p.netWorth]),
    );

    // Assert
    expect(byDate[day(-3)]).toBe(700);
    expect(byDate[day(-2)]).toBe(700);
    expect(byDate[day(-1)]).toBe(900);
    expect(byDate[day()]).toBe(1000);
  });

  test("ignores a historic balance dated today: today is the live balance", async ({
    request,
  }) => {
    // Arrange
    const { cookie, userId } = await createAuthedUser(request);
    const { accountId } = await seedItemWithAccount(userId, {
      account: { balanceCurrent: 1000 },
    });
    await seedHistoricBalances({
      userId,
      accountId,
      balances: [{ date: day(), balanceCurrent: 5 }],
    });

    // Act
    const { series } = await getNetWorth(request, cookie, "?range=1w");

    // Assert
    expect(series[0].points.at(-1)).toEqual({ date: day(), netWorth: 1000 });
  });

  test("subtracts credit and loan balances, which are what is owed", async ({
    request,
  }) => {
    // Arrange: 1000 in checking, 300 owed on a card.
    const { cookie, userId } = await createAuthedUser(request);
    const checking = await seedItemWithAccount(userId, {
      account: { balanceCurrent: 1000 },
    });
    const card = await seedItemWithAccount(userId, {
      account: { type: "credit", balanceCurrent: 300 },
    });
    await seedHistoricBalances({
      userId,
      accountId: checking.accountId,
      balances: [{ date: day(-1), balanceCurrent: 900 }],
    });
    await seedHistoricBalances({
      userId,
      accountId: card.accountId,
      balances: [{ date: day(-1), balanceCurrent: 250 }],
    });

    // Act
    const { series } = await getNetWorth(request, cookie, "?range=1w");
    const last = series[0].points.slice(-2);

    // Assert: yesterday 900 - 250, today 1000 - 300.
    expect(last).toEqual([
      { date: day(-1), netWorth: 650 },
      { date: day(), netWorth: 700 },
    ]);
  });

  test("keeps currencies apart, one series each, sorted by code", async ({
    request,
  }) => {
    // Arrange
    const { cookie, userId } = await createAuthedUser(request);
    await seedItemWithAccount(userId, {
      account: { balanceCurrent: 100, isoCurrencyCode: "USD" },
    });
    await seedItemWithAccount(userId, {
      account: { balanceCurrent: 400, isoCurrencyCode: "CAD" },
    });

    // Act
    const { series } = await getNetWorth(request, cookie, "?range=1w");

    // Assert
    expect(series.map((s) => s.currency)).toEqual(["CAD", "USD"]);
    expect(series[0].points.at(-1)?.netWorth).toBe(400);
    expect(series[1].points.at(-1)?.netWorth).toBe(100);
  });

  test("skips an account that has no balance", async ({ request }) => {
    // Arrange
    const { cookie, userId } = await createAuthedUser(request);
    await seedItemWithAccount(userId, { account: { balanceCurrent: 250 } });
    await seedItemWithAccount(userId, { account: { balanceCurrent: null } });

    // Act
    const { series } = await getNetWorth(request, cookie, "?range=1w");

    // Assert
    expect(series[0].points.at(-1)?.netWorth).toBe(250);
  });

  test("'all' starts at the earliest historic balance, or is just today without any", async ({
    request,
  }) => {
    // Arrange: one user with history, one without.
    const withHistory = await createAuthedUser(request);
    const { accountId } = await seedItemWithAccount(withHistory.userId, {
      account: { balanceCurrent: 1000 },
    });
    await seedHistoricBalances({
      userId: withHistory.userId,
      accountId,
      balances: [{ date: day(-10), balanceCurrent: 600 }],
    });
    const withoutHistory = await createAuthedUser(request);
    await seedItemWithAccount(withoutHistory.userId, {
      account: { balanceCurrent: 1000 },
    });

    // Act
    const history = await getNetWorth(
      request,
      withHistory.cookie,
      "?range=all",
    );
    const none = await getNetWorth(
      request,
      withoutHistory.cookie,
      "?range=all",
    );

    // Assert
    expect(history.series[0].points).toHaveLength(11);
    expect(history.series[0].points[0]).toEqual({
      date: day(-10),
      netWorth: 600,
    });
    expect(none.series[0].points).toEqual([{ date: day(), netWorth: 1000 }]);
  });

  test("never includes another user's accounts or history", async ({
    request,
  }) => {
    // Arrange: another user with an account and history.
    const other = await createAuthedUser(request);
    const { accountId } = await seedItemWithAccount(other.userId, {
      account: { balanceCurrent: 9999 },
    });
    await seedHistoricBalances({
      userId: other.userId,
      accountId,
      balances: [{ date: day(-1), balanceCurrent: 9000 }],
    });
    const { cookie } = await createAuthedUser(request);

    // Act + Assert
    expect(await getNetWorth(request, cookie, "?range=all")).toEqual({
      range: "all",
      series: [],
    });
  });
});
