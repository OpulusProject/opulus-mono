import { expect, test, type APIRequestContext } from "@playwright/test";
import { NetWorthHistoryResponseSchema } from "@opulus/core";
import {
  expectMatchesSchema,
  expectOk,
  expectValidationError,
} from "../../../shared/assertions.js";
import { withSession } from "../../../shared/client.js";
import {
  clearExchangeRates,
  createAuthedUser,
  seedExchangeRates,
  seedItemWithAccount,
  seedTransactions,
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

/** A posted transaction on a day (Plaid's sign: positive is money out). */
const txn = (offset: number, amount: number, extra = {}) => ({
  date: new Date(`${day(offset)}T00:00:00Z`),
  amount,
  ...extra,
});

/** Seed transactions for one of a user's seeded accounts. */
const seedChanges = (
  userId: string,
  seeded: { itemId: string; accountId: string },
  rows: ReturnType<typeof txn>[],
) =>
  seedTransactions({
    userId,
    itemId: seeded.itemId,
    accountId: seeded.accountId,
    rows,
  });

/**
 * This file: the net worth history endpoint. Accounts and transactions have no
 * create endpoint, so they are seeded directly into the isolated test DB and
 * verified over HTTP. A past day's balance is worked out from the account's
 * live balance and the posted transactions since, so the specs seed
 * transactions and expect the balances they imply.
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

  test("holds an account with no transactions at its live balance", async ({
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

  test("works past days out from the live balance and the transactions since", async ({
    request,
  }) => {
    // Arrange: live balance 1000, after 100 came in yesterday and 100 today.
    const { cookie, userId } = await createAuthedUser(request);
    const account = await seedItemWithAccount(userId, {
      account: { balanceCurrent: 1000 },
    });
    await seedChanges(userId, account, [txn(-1, -100), txn(0, -100)]);

    // Act
    const { points } = await getNetWorth(request, cookie, "?range=1w");

    // Assert: 800 before yesterday's deposit (days -7 to -2), 900 at yesterday's
    // close, then today's live balance. 1w is 8 days.
    expect(netWorths(points)).toEqual([800, 800, 800, 800, 800, 800, 900, 1000]);
  });

  test("a day with no transactions has the balance the day before it closed with", async ({
    request,
  }) => {
    // Arrange: 200 came in on day -1 and 100 today, nothing on day -2.
    const { cookie, userId } = await createAuthedUser(request);
    const account = await seedItemWithAccount(userId, {
      account: { balanceCurrent: 1000 },
    });
    await seedChanges(userId, account, [txn(-1, -200), txn(0, -100)]);

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

  test("counts a transaction dated today in the live balance, not on top of it", async ({
    request,
  }) => {
    // Arrange: 50 spent today.
    const { cookie, userId } = await createAuthedUser(request);
    const account = await seedItemWithAccount(userId, {
      account: { balanceCurrent: 1000 },
    });
    await seedChanges(userId, account, [txn(0, 50)]);

    // Act
    const { points } = await getNetWorth(request, cookie, "?range=1w");

    // Assert: today is the live balance; yesterday is what it was before the 50.
    expect(points.slice(-2)).toEqual([
      { date: day(-1), netWorth: 1050 },
      { date: day(), netWorth: 1000 },
    ]);
  });

  test("leaves pending transactions out, since the balance does not have them yet", async ({
    request,
  }) => {
    // Arrange: a pending 500 yesterday, and a posted 100 today.
    const { cookie, userId } = await createAuthedUser(request);
    const account = await seedItemWithAccount(userId, {
      account: { balanceCurrent: 1000 },
    });
    await seedChanges(userId, account, [
      txn(-1, 500, { pending: true }),
      txn(0, 100),
    ]);

    // Act
    const { points } = await getNetWorth(request, cookie, "?range=1w");

    // Assert: only the posted 100 is undone.
    expect(points.slice(-2)).toEqual([
      { date: day(-1), netWorth: 1100 },
      { date: day(), netWorth: 1000 },
    ]);
  });

  test("before the first transaction, a balance is what it was before it", async ({
    request,
  }) => {
    // Arrange: 200 came in three days ago.
    const { cookie, userId } = await createAuthedUser(request);
    const account = await seedItemWithAccount(userId, {
      account: { balanceCurrent: 1000 },
    });
    await seedChanges(userId, account, [txn(-3, -200)]);

    // Act
    const { points } = await getNetWorth(request, cookie, "?range=1w");

    // Assert: 800 until the deposit, which is in the balance of its own day.
    expect(netWorths(points)).toEqual([800, 800, 800, 800, 1000, 1000, 1000, 1000]);
  });

  test("ignores transactions from before the range, which cannot change the days in it", async ({
    request,
  }) => {
    // Arrange: a deposit twenty days ago, and the range is a week.
    const { cookie, userId } = await createAuthedUser(request);
    const account = await seedItemWithAccount(userId, {
      account: { balanceCurrent: 1000 },
    });
    await seedChanges(userId, account, [txn(-20, -300)]);

    // Act
    const { points } = await getNetWorth(request, cookie, "?range=1w");

    // Assert
    expect(netWorths(points)).toEqual(Array(8).fill(1000));
  });

  test("holds an account its transactions do not explain (an investment) at its live balance", async ({
    request,
  }) => {
    // Arrange
    const { cookie, userId } = await createAuthedUser(request);
    const account = await seedItemWithAccount(userId, {
      account: { type: "investment", balanceCurrent: 1000 },
    });
    await seedChanges(userId, account, [txn(-2, -100), txn(0, 40)]);

    // Act
    const { points } = await getNetWorth(request, cookie, "?range=1w");

    // Assert
    expect(netWorths(points)).toEqual(Array(8).fill(1000));
  });

  test("subtracts credit and loan balances, which are what is owed", async ({
    request,
  }) => {
    // Arrange: 1000 in checking (100 came in today), 300 owed on a card (50
    // spent on it today).
    const { cookie, userId } = await createAuthedUser(request);
    const checking = await seedItemWithAccount(userId, {
      account: { balanceCurrent: 1000 },
    });
    const card = await seedItemWithAccount(userId, {
      account: { type: "credit", balanceCurrent: 300 },
    });
    await seedChanges(userId, checking, [txn(0, -100)]);
    await seedChanges(userId, card, [txn(0, 50)]);

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
    // Arrange: 400 CAD held flat; 100 USD live, 80 USD at yesterday's close (20
    // came in today).
    // A USD is 1.25 CAD, except yesterday when it is 1.5 CAD.
    const { cookie, userId } = await createAuthedUser(request);
    await seedItemWithAccount(userId, {
      account: { balanceCurrent: 400, isoCurrencyCode: "CAD" },
    });
    const usd = await seedItemWithAccount(userId, {
      account: { balanceCurrent: 100, isoCurrencyCode: "USD" },
    });
    await seedChanges(userId, usd, [txn(0, -20, { isoCurrencyCode: "USD" })]);

    // Act
    const { baseCurrency, points } = await getNetWorth(
      request,
      cookie,
      "?range=1w",
    );

    // Assert: 80 USD (100 CAD) before yesterday, 80 USD at 1.5 yesterday,
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

  test("'all' starts at the earliest transaction, or is just today without any", async ({
    request,
  }) => {
    // Arrange: one user with transactions, one without.
    const withHistory = await createAuthedUser(request);
    const account = await seedItemWithAccount(withHistory.userId, {
      account: { balanceCurrent: 1000 },
    });
    await seedChanges(withHistory.userId, account, [
      txn(-10, 25),
      txn(-4, -425),
    ]);
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

    // Assert: on the first day the 425 that came in later is not yet in.
    expect(history.points).toHaveLength(11);
    expect(history.points[0]).toEqual({
      date: day(-10),
      netWorth: 575,
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

  test("applies the same rules to the accounts it is limited to", async ({
    request,
  }) => {
    // Arrange: two accounts; only one has transactions.
    const { cookie, userId } = await createAuthedUser(request);
    const withHistory = await seedItemWithAccount(userId, {
      account: { balanceCurrent: 1000 },
    });
    await seedItemWithAccount(userId, { account: { balanceCurrent: 500 } });
    await seedChanges(userId, withHistory, [txn(0, -100)]);

    // Act
    const { points } = await getNetWorth(
      request,
      cookie,
      `?range=1w&accountId=${withHistory.accountId}`,
    );

    // Assert: yesterday worked out from today's 100, today live; the other
    // account is out.
    expect(points.slice(-2)).toEqual([
      { date: day(-1), netWorth: 900 },
      { date: day(), netWorth: 1000 },
    ]);
  });

  test("never includes another user's accounts or transactions", async ({
    request,
  }) => {
    // Arrange: another user with an account and transactions.
    const other = await createAuthedUser(request);
    const account = await seedItemWithAccount(other.userId, {
      account: { balanceCurrent: 9999 },
    });
    await seedChanges(other.userId, account, [txn(-1, -9000)]);
    const { cookie } = await createAuthedUser(request);

    // Act + Assert
    expect(await getNetWorth(request, cookie, "?range=all")).toEqual({
      range: "all",
      baseCurrency: "CAD",
      points: [],
    });
  });
});
