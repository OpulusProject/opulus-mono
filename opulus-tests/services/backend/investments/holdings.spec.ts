import { expect, test } from "@playwright/test";
import { HoldingsResponseSchema } from "@opulus/core";
import { expectMatchesSchema, expectValidationError } from "../../../shared/assertions.js";
import { withSession } from "../../../shared/client.js";
import {
  clearExchangeRates,
  seedInvestmentTransaction,
  createAuthedUser,
  seedExchangeRates,
  seedHolding,
  seedItemWithAccount,
} from "../../../shared/fixtures/index.js";

/** The day this many days from today, "YYYY-MM-DD" (UTC). */
const day = (offset = 0) =>
  new Date(Date.now() + offset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

/** A fraction as the API rounds it (6 places). */
const r6 = (x: number) => Math.round(x * 1e6) / 1e6;

/** A user with an investment account (and its item). */
async function setup(request: Parameters<typeof createAuthedUser>[0]) {
  const { cookie, userId } = await createAuthedUser(request);
  const item = await seedItemWithAccount(userId, {
    institutionName: "Maple Brokerage",
    accountName: "TFSA",
    account: { type: "investment", subtype: "tfsa", mask: "7714" },
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
 * (as an amount and as a fraction), and what they add up to in CAD, split by
 * kind, currency and account. Exchange rates are seeded (a USD is 1.25 CAD)
 * because this file clears and seeds the shared table itself.
 *
 * Test cases:
 * - gives nothing for a user with no holdings
 * - gives a holding's value, cost basis, gain and gain as a fraction, with its security and account
 * - a holding that lost value has a negative gain and a negative fraction
 * - gives no gain for a holding the institution sent no cost basis for
 * - adds the holdings up in CAD, converting USD at today's rate, and counts the gain only over those with a cost basis
 * - lists the largest holding first, by its value in CAD
 * - splits the value by kind, largest first, with each kind's share
 * - splits the value by currency, converted to CAD, with each currency's share
 * - gives each holding's share of the total and the share of the three largest that are not cash
 * - gives each account's value, share and gain, largest first
 * - counts an investment account with no holdings by its balance, and says it has no holdings
 * - flags a price older than five days as stale, and not one with no date
 * - gives an option's contract and a bond's terms, and exchange
 * - gives the dividends of the last twelve months in total and per holding, the dividend yield, and the total return (gain plus dividends)
 * - ranks the holdings by what they earned (in CAD, not as a fraction), largest first, leaving out those without a cost basis
 * - filters to one account with accountId
 * - filters to accounts of one subtype, with the summary over just those
 * - filters to the holdings of one security
 * - sorts account by account, the largest account first, each account's holdings largest first
 * - contains only the requesting user's holdings, even with another user's accountId
 * - rejects an empty accountId (validation)
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
      summary: {
        value: 0, accountCount: 0, holdingCount: 0, allocation: [], currencies: [], topHoldingsShare: 0,
        dividends: 0, dividendYield: 0, totalReturn: 0, totalReturnPercent: null, gainRanking: [],
        costBasis: 0, gain: 0, gainPercent: null, holdingsWithoutCostBasis: 0,
      },
      accounts: [],
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
      accountSubtype: "tfsa",
      security: { tickerSymbol: "XEQT", name: "iShares Core Equity ETF", type: "etf", kind: "etf", isCashEquivalent: false, option: null, bond: null },
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
    expect(summary).toMatchObject({
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

  test("splits the value by kind, largest first, with each kind's share", async ({ request }) => {
    // Arrange: 600 of ETFs, 300 of stock, 100 of cash.
    const { cookie, userId, item } = await setup(request);
    const base = { userId, itemId: item.itemId, accountId: item.accountId, currency: "CAD" };
    await seedHolding({ ...base, tickerSymbol: "E1", type: "etf", value: 400 });
    await seedHolding({ ...base, tickerSymbol: "E2", type: "etf", value: 200 });
    await seedHolding({ ...base, tickerSymbol: "S1", type: "equity", value: 300 });
    await seedHolding({ ...base, tickerSymbol: "CASH", type: "cash", isCashEquivalent: true, value: 100 });

    // Act
    const { summary } = await getHoldings(request, cookie);

    // Assert
    expect(summary.allocation).toEqual([
      { kind: "etf", value: 600, share: 0.6 },
      { kind: "stock", value: 300, share: 0.3 },
      { kind: "cash", value: 100, share: 0.1 },
    ]);
    expect(summary.holdingCount).toBe(4);
  });

  test("splits the value by currency, converted to CAD, with each currency's share", async ({ request }) => {
    // Arrange: 750 CAD and 800 USD (1,000 CAD); a holding with no currency counts as CAD.
    const { cookie, userId, item } = await setup(request);
    const base = { userId, itemId: item.itemId, accountId: item.accountId };
    await seedHolding({ ...base, tickerSymbol: "A", value: 500, currency: "CAD" });
    await seedHolding({ ...base, tickerSymbol: "B", value: 250, currency: null });
    await seedHolding({ ...base, tickerSymbol: "C", value: 800, currency: "USD" });

    // Act
    const { summary } = await getHoldings(request, cookie);

    // Assert
    expect(summary.currencies).toEqual([
      { currency: "USD", value: 1000, share: r6(1000 / 1750) },
      { currency: "CAD", value: 750, share: r6(750 / 1750) },
    ]);
  });

  test("gives each holding's share of the total and the share of the three largest that are not cash", async ({ request }) => {
    // Arrange: total 1,000: cash 400, then 300, 150, 100, 50.
    const { cookie, userId, item } = await setup(request);
    const base = { userId, itemId: item.itemId, accountId: item.accountId, currency: "CAD" };
    await seedHolding({ ...base, tickerSymbol: "CASH", type: "cash", isCashEquivalent: true, value: 400 });
    for (const [tickerSymbol, value] of [["A", 300], ["B", 150], ["C", 100], ["D", 50]] as const) {
      await seedHolding({ ...base, tickerSymbol, value });
    }

    // Act
    const { holdings, summary } = await getHoldings(request, cookie);

    // Assert: the top three that are not cash are A, B and C: 550 of 1,000.
    expect(summary.topHoldingsShare).toBe(0.55);
    expect(holdings.map((h) => [h.security.tickerSymbol, h.share])).toEqual([
      ["CASH", 0.4],
      ["A", 0.3],
      ["B", 0.15],
      ["C", 0.1],
      ["D", 0.05],
    ]);
  });

  test("gives each account's value, share and gain, largest first", async ({ request }) => {
    // Arrange: a TFSA (1,200 worth, 1,000 paid) and an RRSP (800 worth, no cost basis).
    const { cookie, userId, item } = await setup(request);
    const rrsp = await seedItemWithAccount(userId, {
      institutionName: "Other Brokerage",
      accountName: "RRSP",
      account: { type: "investment", subtype: "rrsp", mask: "4321" },
    });
    await seedHolding({ userId, itemId: item.itemId, accountId: item.accountId, tickerSymbol: "T", value: 1200, costBasis: 1000, currency: "CAD" });
    await seedHolding({ userId, itemId: rrsp.itemId, accountId: rrsp.accountId, tickerSymbol: "R", value: 800, currency: "CAD" });

    // Act
    const { accounts, summary } = await getHoldings(request, cookie);

    // Assert
    expect(accounts).toEqual([
      { id: item.accountId, name: "TFSA", institutionName: "Maple Brokerage", subtype: "tfsa", mask: "7714", value: 1200, share: 0.6, hasHoldings: true, gain: 200, gainPercent: 0.2 },
      { id: rrsp.accountId, name: "RRSP", institutionName: "Other Brokerage", subtype: "rrsp", mask: "4321", value: 800, share: 0.4, hasHoldings: true, gain: null, gainPercent: null },
    ]);
    expect(summary.accountCount).toBe(2);
  });

  test("counts an investment account with no holdings by its balance, and says it has no holdings", async ({ request }) => {
    // Arrange: one account with a holding (500) and one RESP that reports only a balance (1,500; 1,000 USD is 1,250 CAD).
    const { cookie, userId, item } = await setup(request);
    const resp = await seedItemWithAccount(userId, {
      accountName: "RESP",
      account: { type: "investment", subtype: "resp", balanceCurrent: 1000, isoCurrencyCode: "USD" },
    });
    await seedHolding({ userId, itemId: item.itemId, accountId: item.accountId, tickerSymbol: "A", value: 500, currency: "CAD" });

    // Act
    const { summary, accounts, holdings } = await getHoldings(request, cookie);

    // Assert: it is in the total and the split, but has no holding rows.
    expect(summary.value).toBe(1750);
    expect(summary.accountCount).toBe(2);
    expect(summary.allocation).toEqual([
      { kind: "balance", value: 1250, share: r6(1250 / 1750) },
      { kind: "stock", value: 500, share: r6(500 / 1750) },
    ]);
    expect(accounts[0]).toMatchObject({ id: resp.accountId, name: "RESP", value: 1250, hasHoldings: false, gain: null });
    expect(holdings).toHaveLength(1);
  });

  test("flags a price older than five days as stale, and not one with no date", async ({ request }) => {
    // Arrange
    const { cookie, userId, item } = await setup(request);
    const base = { userId, itemId: item.itemId, accountId: item.accountId, currency: "CAD" };
    await seedHolding({ ...base, tickerSymbol: "FRESH", priceAsOf: new Date(Date.now() - 2 * 86_400_000) });
    await seedHolding({ ...base, tickerSymbol: "OLD", priceAsOf: new Date(Date.now() - 9 * 86_400_000) });
    await seedHolding({ ...base, tickerSymbol: "NODATE", priceAsOf: null });

    // Act
    const { holdings } = await getHoldings(request, cookie);

    // Assert
    const stale = Object.fromEntries(holdings.map((h) => [h.security.tickerSymbol, h.priceStale]));
    expect(stale).toEqual({ FRESH: false, OLD: true, NODATE: false });
  });

  test("gives an option's contract and a bond's terms, and exchange", async ({ request }) => {
    // Arrange
    const { cookie, userId, item } = await setup(request);
    const base = { userId, itemId: item.itemId, accountId: item.accountId, currency: "USD" };
    await seedHolding({
      ...base, tickerSymbol: "AAPL27", type: "derivative", value: 2840,
      details: {
        marketIdentifierCode: "XNAS", optionContractType: "call", optionExpirationDate: new Date("2027-01-15T00:00:00Z"),
        optionStrikePrice: 250, optionUnderlyingTicker: "AAPL",
      },
    });
    await seedHolding({
      ...base, tickerSymbol: "GOC30", type: "fixed income", value: 4920, currency: "CAD",
      details: {
        bondMaturityDate: new Date("2030-06-01T00:00:00Z"), bondIssueDate: new Date("2020-06-01T00:00:00Z"),
        bondFaceValue: 5000, bondYieldRate: 2.75, bondYieldType: "coupon",
      },
    });

    // Act
    const { holdings } = await getHoldings(request, cookie);

    // Assert
    const option = holdings.find((h) => h.security.tickerSymbol === "AAPL27")!.security;
    const bond = holdings.find((h) => h.security.tickerSymbol === "GOC30")!.security;
    expect(option).toMatchObject({
      kind: "option", exchange: "XNAS", bond: null,
      option: { contractType: "call", expirationDate: "2027-01-15T00:00:00.000Z", strikePrice: 250, underlyingTicker: "AAPL" },
    });
    expect(bond).toMatchObject({
      kind: "bond", option: null,
      bond: { maturityDate: "2030-06-01T00:00:00.000Z", issueDate: "2020-06-01T00:00:00.000Z", faceValue: 5000, yieldRate: 2.75, yieldType: "coupon" },
    });
  });

  test("gives the dividends of the last twelve months in total and per holding, the dividend yield, and the total return (gain plus dividends)", async ({ request }) => {
    // Arrange: 1,000 worth, 800 paid (gain 200); XIC paid 30 + 20 this year and 99 two years ago; a 10 USD interest payment (12.50 CAD) belongs to no holding.
    const { cookie, userId, item } = await setup(request);
    const base = { userId, itemId: item.itemId, accountId: item.accountId };
    const xic = await seedHolding({ ...base, tickerSymbol: "XIC", value: 1000, costBasis: 800, currency: "CAD" });
    const recent = (amount: number, daysAgo: number, extra = {}) =>
      seedInvestmentTransaction({ ...base, type: "cash", subtype: "dividend", amount: -amount, date: day(-daysAgo), ...extra });
    await recent(30, 40, { securityId: xic.securityId });
    await recent(20, 10, { securityId: xic.securityId });
    await recent(99, 800, { securityId: xic.securityId });
    await seedInvestmentTransaction({ ...base, type: "cash", subtype: "interest", amount: -10, currency: "USD", date: day(-5) });
    await seedInvestmentTransaction({ ...base, type: "buy", amount: 500, securityId: xic.securityId });

    // Act
    const { summary, holdings } = await getHoldings(request, cookie);

    // Assert
    expect(holdings[0]!.dividends).toBe(50);
    expect(summary).toMatchObject({ gain: 200, dividends: 62.5, totalReturn: 262.5 });
    expect(summary.dividendYield).toBeCloseTo(62.5 / 1000, 6);
    expect(summary.totalReturnPercent).toBeCloseTo(262.5 / 800, 10);
  });

  test("ranks the holdings by what they earned (in CAD, not as a fraction), largest first, leaving out those without a cost basis", async ({ request }) => {
    // Arrange: A earned 50 (+50%), B 500 (+10%), C lost 20, D has no cost basis, and a USD holding earned 400 USD (500 CAD).
    // Eight more with small gains push the list past six.
    const { cookie, userId, item } = await setup(request);
    const base = { userId, itemId: item.itemId, accountId: item.accountId, currency: "CAD" };
    const ids: Record<string, string> = {};
    for (const [tickerSymbol, value, costBasis] of [["A", 150, 100], ["B", 5500, 5000], ["C", 80, 100], ["D", 100, null]] as const) {
      ids[tickerSymbol] = (await seedHolding({ ...base, tickerSymbol, value, costBasis })).id;
    }
    ids.USD = (await seedHolding({ ...base, currency: "USD", tickerSymbol: "USD1", value: 1400, costBasis: 1000 })).id;
    for (let i = 0; i < 8; i++) {
      ids[`S${i}`] = (await seedHolding({ ...base, tickerSymbol: `S${i}`, value: 100 + i, costBasis: 100 })).id;
    }

    // Act
    const { summary, holdings } = await getHoldings(request, cookie);

    // Assert: B and the USD holding (500 CAD each; the tie goes by id), then A (50), S7 (7), S6 (6), S5 (5): six in all, D never.
    const tied = [ids.B!, ids.USD!].sort();
    expect(summary.gainRanking).toEqual([...tied, ids.A, ids.S7, ids.S6, ids.S5]);
    expect(holdings.find((h) => h.id === ids.USD)).toMatchObject({ gain: 400, gainInBase: 500 });
  });

  test("filters to accounts of one subtype, with the summary over just those", async ({ request }) => {
    // Arrange: a TFSA (setup) and an RRSP, 300 and 700.
    const { cookie, userId, item } = await setup(request);
    const rrsp = await seedItemWithAccount(userId, { account: { type: "investment", subtype: "rrsp" } });
    await seedHolding({ userId, itemId: item.itemId, accountId: item.accountId, tickerSymbol: "T", value: 300, currency: "CAD" });
    await seedHolding({ userId, itemId: rrsp.itemId, accountId: rrsp.accountId, tickerSymbol: "R", value: 700, currency: "CAD" });

    // Act
    const { holdings, summary, accounts } = await getHoldings(request, cookie, "?accountSubtype=rrsp");

    // Assert
    expect(holdings.map((h) => h.security.tickerSymbol)).toEqual(["R"]);
    expect(accounts.map((a) => a.id)).toEqual([rrsp.accountId]);
    expect(summary).toMatchObject({ value: 700, accountCount: 1 });
  });

  test("filters to the holdings of one security", async ({ request }) => {
    // Arrange: the same security held in two accounts, and another security.
    const { cookie, userId, item } = await setup(request);
    const other = await seedItemWithAccount(userId, { account: { type: "investment" } });
    const one = await seedHolding({ userId, itemId: item.itemId, accountId: item.accountId, plaidSecurityId: "sec_shared", tickerSymbol: "SH", value: 100, currency: "CAD" });
    await seedHolding({ userId, itemId: other.itemId, accountId: other.accountId, plaidSecurityId: "sec_shared", tickerSymbol: "SH", value: 200, currency: "CAD" });
    await seedHolding({ userId, itemId: item.itemId, accountId: item.accountId, tickerSymbol: "ELSE", value: 50, currency: "CAD" });

    // Act
    const { holdings, summary } = await getHoldings(request, cookie, `?securityId=${one.securityId}`);

    // Assert
    expect(holdings.map((h) => h.value)).toEqual([200, 100]);
    expect(summary.holdingCount).toBe(2);
  });

  test("sorts account by account, the largest account first, each account's holdings largest first", async ({ request }) => {
    // Arrange: account X holds 300 + 100, account Y holds 500 and 50; by value alone Y500, X300, X100, Y50.
    const { cookie, userId, item } = await setup(request);
    const y = await seedItemWithAccount(userId, { account: { type: "investment" } });
    const x = { userId, itemId: item.itemId, accountId: item.accountId, currency: "CAD" };
    const yy = { userId, itemId: y.itemId, accountId: y.accountId, currency: "CAD" };
    await seedHolding({ ...x, tickerSymbol: "X300", value: 300 });
    await seedHolding({ ...x, tickerSymbol: "X100", value: 100 });
    await seedHolding({ ...yy, tickerSymbol: "Y500", value: 500 });
    await seedHolding({ ...yy, tickerSymbol: "Y50", value: 50 });

    // Act
    const byValue = await getHoldings(request, cookie);
    const byAccount = await getHoldings(request, cookie, "?sort=account");

    // Assert: X is worth 400 and Y 550, so Y comes first.
    expect(byValue.holdings.map((h) => h.security.tickerSymbol)).toEqual(["Y500", "X300", "X100", "Y50"]);
    expect(byAccount.holdings.map((h) => h.security.tickerSymbol)).toEqual(["Y500", "Y50", "X300", "X100"]);
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
