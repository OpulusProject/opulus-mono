import { expect, test } from "@playwright/test";
import { HoldingsResponseSchema } from "@opulus/core";
import { expectMatchesSchema, expectValidationError } from "../../../shared/assertions.js";
import { withSession } from "../../../shared/client.js";
import {
  clearExchangeRates,
  createAuthedUser,
  seedExchangeRates,
  seedHolding,
  seedItemWithAccount,
} from "../../../shared/fixtures/index.js";

/** The day this many days from today, "YYYY-MM-DD" (UTC). */
const day = (offset = 0) =>
  new Date(Date.now() + offset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

/** A user with an investment account (and its item). */
async function setup(request: Parameters<typeof createAuthedUser>[0]) {
  const { cookie, userId } = await createAuthedUser(request);
  const item = await seedItemWithAccount(userId, {
    institutionName: "Maple Brokerage",
    accountName: "TFSA",
    account: { type: "investment", subtype: "tfsa" },
  });
  return { cookie, userId, item };
}

async function getHoldings(
  request: Parameters<typeof createAuthedUser>[0],
  cookie: string,
  query = "",
) {
  const res = await request.get(`/api/investments/holdings${query}`, {
    headers: withSession(cookie),
  });
  return (await expectMatchesSchema(res, HoldingsResponseSchema)).data;
}

/**
 * This file: the holdings endpoint: each holding's value, cost basis and gain
 * (as an amount and as a fraction), and what they add up to in CAD. Exchange
 * rates are seeded (a USD is 1.25 CAD) because this file clears and seeds the
 * shared table itself.
 */
test.describe("GET /api/investments/holdings", () => {
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

  test("gives nothing for a user with no holdings", async ({ request }) => {
    const { cookie } = await createAuthedUser(request);

    const data = await getHoldings(request, cookie);

    expect(data).toEqual({
      baseCurrency: "CAD",
      summary: { value: 0, costBasis: 0, gain: 0, gainPercent: null, holdingsWithoutCostBasis: 0 },
      holdings: [],
    });
  });

  test("gives a holding's value, cost basis, gain and gain as a fraction, with its security and account", async ({
    request,
  }) => {
    // Arrange: 1,902.50 worth, 1,500 paid.
    const { cookie, userId, item } = await setup(request);
    await seedHolding({
      userId, itemId: item.itemId, accountId: item.accountId,
      tickerSymbol: "XEQT", securityName: "iShares Core Equity ETF", type: "etf",
      quantity: 50, price: 38.05, priceAsOf: new Date("2026-10-14T00:00:00Z"),
      value: 1902.5, costBasis: 1500, currency: "CAD",
    });

    // Act
    const { holdings } = await getHoldings(request, cookie);

    // Assert
    expect(holdings).toHaveLength(1);
    expect(holdings[0]).toMatchObject({
      accountId: item.accountId,
      accountName: "TFSA",
      institutionName: "Maple Brokerage",
      security: { tickerSymbol: "XEQT", name: "iShares Core Equity ETF", type: "etf", isCashEquivalent: false },
      quantity: 50,
      price: 38.05,
      priceAsOf: "2026-10-14T00:00:00.000Z",
      value: 1902.5,
      currency: "CAD",
      valueInBase: 1902.5,
      costBasis: 1500,
      gain: 402.5,
    });
    expect(holdings[0]!.gainPercent).toBeCloseTo(402.5 / 1500, 10);
  });

  test("a holding that lost value has a negative gain and a negative fraction", async ({
    request,
  }) => {
    const { cookie, userId, item } = await setup(request);
    await seedHolding({
      userId, itemId: item.itemId, accountId: item.accountId,
      value: 800, costBasis: 1000, currency: "CAD",
    });

    const { holdings, summary } = await getHoldings(request, cookie);

    expect(holdings[0]).toMatchObject({ gain: -200, gainPercent: -0.2 });
    expect(summary).toMatchObject({ gain: -200, gainPercent: -0.2 });
  });

  test("gives no gain for a holding the institution sent no cost basis for", async ({
    request,
  }) => {
    const { cookie, userId, item } = await setup(request);
    await seedHolding({
      userId, itemId: item.itemId, accountId: item.accountId,
      value: 250, costBasis: null, currency: "CAD",
    });

    const { holdings, summary } = await getHoldings(request, cookie);

    expect(holdings[0]).toMatchObject({ costBasis: null, gain: null, gainPercent: null, valueInBase: 250 });
    expect(summary).toEqual({
      value: 250, costBasis: 0, gain: 0, gainPercent: null, holdingsWithoutCostBasis: 1,
    });
  });

  test("adds the holdings up in CAD, converting USD at today's rate, and counts the gain only over those with a cost basis", async ({
    request,
  }) => {
    // Arrange: a CAD holding (1,200 worth, 1,000 paid), a USD one (800 USD = 1,000 CAD
    // worth, 600 USD = 750 CAD paid), and cash with no cost basis (300).
    const { cookie, userId, item } = await setup(request);
    const base = { userId, itemId: item.itemId, accountId: item.accountId };
    await seedHolding({ ...base, tickerSymbol: "CAD1", value: 1200, costBasis: 1000, currency: "CAD" });
    await seedHolding({ ...base, tickerSymbol: "USD1", value: 800, costBasis: 600, currency: "USD" });
    await seedHolding({ ...base, tickerSymbol: "CASH", type: "cash", isCashEquivalent: true, value: 300, costBasis: null, currency: "CAD" });

    // Act
    const { holdings, summary } = await getHoldings(request, cookie);

    // Assert: value 1200 + 1000 + 300; cost basis 1000 + 750; gain (1200-1000) + (1000-750) = 450.
    expect(summary.value).toBe(2500);
    expect(summary.costBasis).toBe(1750);
    expect(summary.gain).toBe(450);
    expect(summary.gainPercent).toBeCloseTo(450 / 1750, 10);
    expect(summary.holdingsWithoutCostBasis).toBe(1);
    // The USD holding shows its own currency and gain, and its value in CAD.
    const usd = holdings.find((h) => h.security.tickerSymbol === "USD1")!;
    expect(usd).toMatchObject({ currency: "USD", value: 800, valueInBase: 1000, gain: 200 });
  });

  test("lists the largest holding first, by its value in CAD", async ({ request }) => {
    // Arrange: 700 USD (875 CAD) is bigger than 800 CAD.
    const { cookie, userId, item } = await setup(request);
    const base = { userId, itemId: item.itemId, accountId: item.accountId };
    await seedHolding({ ...base, tickerSymbol: "SMALL", value: 800, currency: "CAD" });
    await seedHolding({ ...base, tickerSymbol: "BIG", value: 700, currency: "USD" });

    const { holdings } = await getHoldings(request, cookie);

    expect(holdings.map((h) => h.security.tickerSymbol)).toEqual(["BIG", "SMALL"]);
  });

  test("filters to one account with accountId", async ({ request }) => {
    // Arrange: two accounts with a holding each.
    const { cookie, userId, item } = await setup(request);
    const other = await seedItemWithAccount(userId, { account: { type: "investment" } });
    await seedHolding({ userId, itemId: item.itemId, accountId: item.accountId, tickerSymbol: "ONE" });
    await seedHolding({ userId, itemId: other.itemId, accountId: other.accountId, tickerSymbol: "TWO" });

    // Act
    const { holdings } = await getHoldings(request, cookie, `?accountId=${other.accountId}`);

    // Assert
    expect(holdings.map((h) => h.security.tickerSymbol)).toEqual(["TWO"]);
  });

  test("contains only the requesting user's holdings, even with another user's accountId", async ({
    request,
  }) => {
    // Arrange
    const owner = await setup(request);
    await seedHolding({ userId: owner.userId, itemId: owner.item.itemId, accountId: owner.item.accountId, tickerSymbol: "MINE" });
    const { cookie } = await createAuthedUser(request);

    // Act
    const scoped = await getHoldings(request, cookie);
    const byId = await getHoldings(request, cookie, `?accountId=${owner.item.accountId}`);

    // Assert
    expect(scoped.holdings).toEqual([]);
    expect(byId.holdings).toEqual([]);
  });

  test("rejects an empty accountId (validation)", async ({ request }) => {
    const { cookie } = await createAuthedUser(request);

    const res = await request.get("/api/investments/holdings?accountId=", {
      headers: withSession(cookie),
    });

    await expectValidationError(res);
  });
});
