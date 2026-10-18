import { expect, test } from "@playwright/test";
import { ActivitySummaryResponseSchema } from "@opulus/core";
import { expectMatchesSchema } from "../../../shared/assertions.js";
import { withSession } from "../../../shared/client.js";
import {
  clearExchangeRates,
  createAuthedUser,
  seedExchangeRates,
  seedInvestmentTransaction,
  seedItemWithAccount,
} from "../../../shared/fixtures/index.js";

/** The day this many days from today, "YYYY-MM-DD" (UTC). */
const day = (offset = 0) => new Date(Date.now() + offset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

async function setup(request: Parameters<typeof createAuthedUser>[0]) {
  const { cookie, userId } = await createAuthedUser(request);
  const item = await seedItemWithAccount(userId, { account: { type: "investment", subtype: "tfsa" } });
  return { cookie, userId, item, base: { userId, itemId: item.itemId, accountId: item.accountId } };
}

async function getSummary(request: Parameters<typeof createAuthedUser>[0], cookie: string, query = "") {
  const res = await request.get(`/api/investments/activity/summary${query}`, { headers: withSession(cookie) });
  return (await expectMatchesSchema(res, ActivitySummaryResponseSchema)).data;
}

/**
 * This file: the activity summary: what a user's investment accounts paid out
 * (dividends, interest, capital gains), charged (fee transactions and fees on
 * trades), took in and gave back over the last twelve months, and what was put
 * in so far this calendar year, in CAD. Rates are seeded (a USD is 1.25 CAD).
 *
 * Test cases:
 * - gives zeros for a user with no activity
 * - adds up dividends, fees, money added and money removed over the last twelve months
 * - counts the fees charged on a trade as fees, and ignores a trade's amount
 * - leaves out what is older than twelve months, but counts money added this year even when the year began earlier than that
 * - converts USD to CAD at today's rate
 * - filters to one account with accountId
 * - contains only the requesting user's activity
 */
test.describe("GET /api/investments/activity/summary", () => {
  test.beforeAll(async () => {
    await clearExchangeRates();
    await seedExchangeRates(
      Array.from({ length: 5 }, (_, i) => day(-i)).flatMap((date) => [
        { date, currency: "EUR", perEur: 1 },
        { date, currency: "CAD", perEur: 1.5 },
        { date, currency: "USD", perEur: 1.2 },
      ]),
    );
  });

  test("gives zeros for a user with no activity", async ({ request }) => {
    const { cookie } = await createAuthedUser(request);

    const data = await getSummary(request, cookie);

    expect(data).toMatchObject({ baseCurrency: "CAD", dividends: 0, fees: 0, added: 0, removed: 0, addedThisYear: 0, since: day(-364) });
    expect(data.year).toBe(Number(day().slice(0, 4)));
  });

  test("adds up dividends, fees, money added and money removed over the last twelve months", async ({ request }) => {
    // Arrange
    const { cookie, base } = await setup(request);
    await seedInvestmentTransaction({ ...base, type: "cash", subtype: "dividend", amount: -60, date: day(-30) });
    await seedInvestmentTransaction({ ...base, type: "cash", subtype: "interest", amount: -2.5, date: day(-10) });
    await seedInvestmentTransaction({ ...base, type: "fee", subtype: "account fee", amount: 1.49, date: day(-20) });
    await seedInvestmentTransaction({ ...base, type: "cash", subtype: "contribution", amount: -500, date: day(-5) });
    await seedInvestmentTransaction({ ...base, type: "cash", subtype: "withdrawal", amount: 200, date: day(-4) });

    // Act
    const data = await getSummary(request, cookie);

    // Assert
    expect(data).toMatchObject({ dividends: 62.5, fees: 1.49, added: 500, removed: 200 });
  });

  test("counts the fees charged on a trade as fees, and ignores a trade's amount", async ({ request }) => {
    // Arrange
    const { cookie, base } = await setup(request);
    await seedInvestmentTransaction({ ...base, type: "buy", amount: 338, fees: 4.95, tickerSymbol: "XEQT" });
    await seedInvestmentTransaction({ ...base, type: "sell", amount: -730.5, fees: 9.99, tickerSymbol: "SHOP" });
    await seedInvestmentTransaction({ ...base, type: "buy", amount: 10, fees: null, tickerSymbol: "NOFEE" });

    // Act
    const data = await getSummary(request, cookie);

    // Assert
    expect(data).toMatchObject({ fees: 14.94, dividends: 0, added: 0 });
  });

  test("leaves out what is older than twelve months, but counts money added this year even when the year began earlier than that", async ({ request }) => {
    // Arrange: 400 days ago is outside the twelve months; Jan 1 of this year is the start of "this year".
    const { cookie, base } = await setup(request);
    const year = day().slice(0, 4);
    await seedInvestmentTransaction({ ...base, type: "cash", subtype: "dividend", amount: -50, date: day(-400) });
    await seedInvestmentTransaction({ ...base, type: "cash", subtype: "contribution", amount: -300, date: day(-400) });
    await seedInvestmentTransaction({ ...base, type: "cash", subtype: "contribution", amount: -1000, date: `${year}-01-01` });
    await seedInvestmentTransaction({ ...base, type: "cash", subtype: "contribution", amount: -700, date: `${Number(year) - 1}-12-31` });

    // Act
    const data = await getSummary(request, cookie);

    // Assert: the old dividend is out; Dec 31 of last year is not "this year"; Jan 1 is.
    expect(data.dividends).toBe(0);
    expect(data.addedThisYear).toBe(1000);
  });

  test("converts USD to CAD at today's rate", async ({ request }) => {
    // Arrange
    const { cookie, base } = await setup(request);
    await seedInvestmentTransaction({ ...base, type: "cash", subtype: "dividend", amount: -100, currency: "USD" });

    // Act
    const data = await getSummary(request, cookie);

    // Assert
    expect(data.dividends).toBe(125);
  });

  test("filters to one account with accountId", async ({ request }) => {
    // Arrange
    const { cookie, userId, base } = await setup(request);
    const other = await seedItemWithAccount(userId, { account: { type: "investment" } });
    await seedInvestmentTransaction({ ...base, type: "cash", subtype: "dividend", amount: -10 });
    await seedInvestmentTransaction({ userId, itemId: other.itemId, accountId: other.accountId, type: "cash", subtype: "dividend", amount: -99 });

    // Act
    const data = await getSummary(request, cookie, `?accountId=${other.accountId}`);

    // Assert
    expect(data.dividends).toBe(99);
  });

  test("contains only the requesting user's activity", async ({ request }) => {
    // Arrange
    const owner = await setup(request);
    await seedInvestmentTransaction({ ...owner.base, type: "cash", subtype: "dividend", amount: -10 });
    const { cookie } = await createAuthedUser(request);

    // Act
    const data = await getSummary(request, cookie);

    // Assert
    expect(data.dividends).toBe(0);
  });
});
