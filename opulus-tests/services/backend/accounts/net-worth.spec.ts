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
  clearExchangeRates,
  createAuthedUser,
  seedExchangeRates,
  seedHistoricBalances,
  seedItemWithAccount,
} from "../../../shared/fixtures/index.js";

interface Point {
  date: string;
  netWorth: number;
}
interface NetWorthData {
  range: string;
  baseCurrency: string;
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
): Promise<NetWorthData> {
  const res = await request.get(`/api/accounts/net-worth${query}`, {
    headers: withSession(cookie),
  });
  await expectOk(res);
  // Every call must match the documented shape exactly.
  await expectMatchesSchema(res, NetWorthHistoryResponseSchema);
  return (await res.json()).data;
}

const netWorths = (points: Point[]) => points.map((p) => p.netWorth);

/**
 * This file: the net worth history endpoint. Accounts and their daily balance
 * historic balances have no create endpoint, so they are seeded directly into the
 * isolated test DB and verified over HTTP.
 */
test.describe("GET /api/accounts/net-worth", () => {
  test.beforeAll(async () => {
    // A USD is 1.25 CAD (1.2 USD and 1.5 CAD per euro), except yesterday when
    // it is 1.5 CAD (1.0 USD per euro). Every recent day has a rate.
    await clearExchangeRates();
    await seedExchangeRates(
      Array.from({ length: 40 }, (_, i) => day(-i)).flatMap((date, i) => [
        { date, currency: "EUR", perEur: 1 },
        { date, currency: "CAD", perEur: 1.5 },
        { date, currency: "USD", perEur: i === 1 ? 1.0 : 1.2 },
      ]),
    );
  });

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

  test("returns no points for a user with no accounts", async ({ request }) => {
    // Arrange
    const { cookie } = await createAuthedUser(request);

    // Act + Assert
    expect(await getNetWorth(request, cookie)).toEqual({
      range: "1m",
      baseCurrency: "CAD",
      points: [],
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
      const { points } = await getNetWorth(request, cookie, `?range=${range}`);
      expect(points).toHaveLength(days + 1);
      expect(points[0].date).toBe(day(-days));
      expect(points.at(-1)?.date).toBe(day());
    }
  });

  test("defaults to a month", async ({ request }) => {
    // Arrange
    const { cookie, userId } = await createAuthedUser(request);
    await seedItemWithAccount(userId);

    // Act
    const { range, points } = await getNetWorth(request, cookie);

    // Assert
    expect(range).toBe("1m");
    expect(points).toHaveLength(31);
  });

  test("holds an account with no historic balances at its live balance", async ({
    request,
  }) => {
    // Arrange
    const { cookie, userId } = await createAuthedUser(request);
    await seedItemWithAccount(userId, { account: { balanceCurrent: 1234.56 } });

    // Act
    const { points } = await getNetWorth(request, cookie, "?range=1w");

    // Assert
    expect(netWorths(points)).toEqual(Array(8).fill(1234.56));
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
    const { points } = await getNetWorth(request, cookie, "?range=1w");

    // Assert: flat at the first historic balance before the history starts, then the
    // historic balances, then today's live balance.
    // 1w is 8 days: days -7 to -3 (flat), -2, -1, today.
    expect(netWorths(points)).toEqual([
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
    const { points } = await getNetWorth(request, cookie, "?range=1w");
    const byDate = Object.fromEntries(
      points.map((p) => [p.date, p.netWorth]),
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
    const { points } = await getNetWorth(request, cookie, "?range=1w");

    // Assert
    expect(points.at(-1)).toEqual({ date: day(), netWorth: 1000 });
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
    const { points } = await getNetWorth(request, cookie, "?range=1w");
    const last = points.slice(-2);

    // Assert: yesterday 900 - 250, today 1000 - 300.
    expect(last).toEqual([
      { date: day(-1), netWorth: 650 },
      { date: day(), netWorth: 700 },
    ]);
  });

  test("converts other currencies to the base currency at each day's rate", async ({
    request,
  }) => {
    // Arrange: 400 CAD held flat; 100 USD live, 80 USD at yesterday's close.
    // A USD is 1.25 CAD, except yesterday when it is 1.5 CAD.
    const { cookie, userId } = await createAuthedUser(request);
    await seedItemWithAccount(userId, {
      account: { balanceCurrent: 400, isoCurrencyCode: "CAD" },
    });
    const usd = await seedItemWithAccount(userId, {
      account: { balanceCurrent: 100, isoCurrencyCode: "USD" },
    });
    await seedHistoricBalances({
      userId,
      accountId: usd.accountId,
      balances: [{ date: day(-1), balanceCurrent: 80 }],
    });

    // Act
    const { baseCurrency, points } = await getNetWorth(
      request,
      cookie,
      "?range=1w",
    );

    // Assert: flat 80 USD (100 CAD) before yesterday, 80 USD at 1.5 yesterday,
    // 100 USD at 1.25 today, each added to the 400 CAD.
    expect(baseCurrency).toBe("CAD");
    expect(netWorths(points)).toEqual([500, 500, 500, 500, 500, 500, 520, 525]);
  });

  test("subtracts what is owed in another currency, converted", async ({
    request,
  }) => {
    // Arrange: 1000 CAD in checking, 80 USD owed (100 CAD at 1.25).
    const { cookie, userId } = await createAuthedUser(request);
    await seedItemWithAccount(userId, {
      account: { balanceCurrent: 1000, isoCurrencyCode: "CAD" },
    });
    await seedItemWithAccount(userId, {
      account: { type: "credit", balanceCurrent: 80, isoCurrencyCode: "USD" },
    });

    // Act
    const { points } = await getNetWorth(request, cookie, "?range=1w");

    // Assert: the card is held at its live balance, so every day but yesterday
    // (rate 1.5) is 1000 - 100.
    expect(points.at(-1)?.netWorth).toBe(900);
    expect(points.at(-2)?.netWorth).toBe(880);
  });

  test("takes an account with no currency as the base currency", async ({
    request,
  }) => {
    // Arrange
    const { cookie, userId } = await createAuthedUser(request);
    await seedItemWithAccount(userId, {
      account: { balanceCurrent: 70, isoCurrencyCode: null },
    });
    await seedItemWithAccount(userId, {
      account: { balanceCurrent: 30, isoCurrencyCode: "CAD" },
    });

    // Act
    const { points } = await getNetWorth(request, cookie, "?range=1w");

    // Assert
    expect(points.at(-1)?.netWorth).toBe(100);
  });

  test("skips an account that has no balance", async ({ request }) => {
    // Arrange
    const { cookie, userId } = await createAuthedUser(request);
    await seedItemWithAccount(userId, { account: { balanceCurrent: 250 } });
    await seedItemWithAccount(userId, { account: { balanceCurrent: null } });

    // Act
    const { points } = await getNetWorth(request, cookie, "?range=1w");

    // Assert
    expect(points.at(-1)?.netWorth).toBe(250);
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
    expect(history.points).toHaveLength(11);
    expect(history.points[0]).toEqual({
      date: day(-10),
      netWorth: 600,
    });
    expect(none.points).toEqual([{ date: day(), netWorth: 1000 }]);
  });

  test("limits to the accounts given with accountId, which may be repeated", async ({
    request,
  }) => {
    // Arrange: three accounts worth 100, 20 and 3.
    const { cookie, userId } = await createAuthedUser(request);
    const small = await seedItemWithAccount(userId, {
      account: { balanceCurrent: 3 },
    });
    const medium = await seedItemWithAccount(userId, {
      account: { balanceCurrent: 20 },
    });
    await seedItemWithAccount(userId, { account: { balanceCurrent: 100 } });

    // Act
    const one = await getNetWorth(
      request,
      cookie,
      `?range=1w&accountId=${medium.accountId}`,
    );
    const two = await getNetWorth(
      request,
      cookie,
      `?range=1w&accountId=${small.accountId}&accountId=${medium.accountId}`,
    );

    // Assert
    expect(one.points.at(-1)?.netWorth).toBe(20);
    expect(two.points.at(-1)?.netWorth).toBe(23);
  });

  test("ignores an accountId that is not the user's, leaving nothing to add up", async ({
    request,
  }) => {
    // Arrange: another user's account, and the user's own.
    const other = await createAuthedUser(request);
    const theirs = await seedItemWithAccount(other.userId, {
      account: { balanceCurrent: 9999 },
    });
    const { cookie, userId } = await createAuthedUser(request);
    const mine = await seedItemWithAccount(userId, {
      account: { balanceCurrent: 50 },
    });

    // Act
    const onlyTheirs = await getNetWorth(
      request,
      cookie,
      `?range=1w&accountId=${theirs.accountId}`,
    );
    const both = await getNetWorth(
      request,
      cookie,
      `?range=1w&accountId=${theirs.accountId}&accountId=${mine.accountId}`,
    );

    // Assert
    expect(onlyTheirs.points).toEqual([]);
    expect(both.points.at(-1)?.netWorth).toBe(50);
  });

  test("applies the same fill rules to the accounts it is limited to", async ({
    request,
  }) => {
    // Arrange: two accounts; only one has history.
    const { cookie, userId } = await createAuthedUser(request);
    const withHistory = await seedItemWithAccount(userId, {
      account: { balanceCurrent: 1000 },
    });
    await seedItemWithAccount(userId, { account: { balanceCurrent: 500 } });
    await seedHistoricBalances({
      userId,
      accountId: withHistory.accountId,
      balances: [{ date: day(-1), balanceCurrent: 900 }],
    });

    // Act
    const { points } = await getNetWorth(
      request,
      cookie,
      `?range=1w&accountId=${withHistory.accountId}`,
    );

    // Assert: yesterday from its history, today live; the other account is out.
    expect(points.slice(-2)).toEqual([
      { date: day(-1), netWorth: 900 },
      { date: day(), netWorth: 1000 },
    ]);
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
      baseCurrency: "CAD",
      points: [],
    });
  });
});
