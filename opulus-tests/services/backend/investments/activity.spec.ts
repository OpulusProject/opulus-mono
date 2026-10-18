import { expect, test } from "@playwright/test";
import { ActivityResponseSchema } from "@opulus/core";
import { expectMatchesSchema, expectValidationError } from "../../../shared/assertions.js";
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
  const item = await seedItemWithAccount(userId, {
    institutionName: "Maple Brokerage",
    accountName: "TFSA",
    account: { type: "investment", subtype: "tfsa", mask: "7714" },
  });
  return { cookie, userId, item, base: { userId, itemId: item.itemId, accountId: item.accountId } };
}

async function getActivity(request: Parameters<typeof createAuthedUser>[0], cookie: string, query = "") {
  const res = await request.get(`/api/investments/activity${query}`, { headers: withSession(cookie) });
  return (await expectMatchesSchema(res, ActivityResponseSchema)).data;
}

/**
 * This file: the activity endpoint: a user's investment transactions, newest
 * first, as the account's cash sees them (money in positive), classified into
 * buys, sells, dividends, money added or removed, and fees, and filterable by
 * kind, account and dates. Rates are seeded (a USD is 1.25 CAD).
 *
 * Test cases:
 * - gives nothing for a user with no activity
 * - gives a buy, a sale, a dividend and a deposit with the sign from the account's side, newest first
 * - gives an item's security, account and institution
 * - classifies cash by subtype: dividend and interest as dividends, deposits and contributions as added, withdrawals as removed, the rest as other
 * - filters by kind, including other
 * - filters by account
 * - filters by security
 * - filters by dates, inclusive of both days
 * - converts a USD amount to CAD at today's rate
 * - pages the list and counts the total
 * - contains only the requesting user's activity
 * - rejects an unknown kind, a bad date and an empty accountId (validation)
 */
test.describe("GET /api/investments/activity", () => {
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

  test("gives nothing for a user with no activity", async ({ request }) => {
    const { cookie } = await createAuthedUser(request);

    const data = await getActivity(request, cookie);

    expect(data).toEqual({
      baseCurrency: "CAD",
      items: [],
      pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
    });
  });

  test("gives a buy, a sale, a dividend and a deposit with the sign from the account's side, newest first", async ({ request }) => {
    // Arrange
    const { cookie, base } = await setup(request);
    await seedInvestmentTransaction({ ...base, type: "buy", subtype: "buy", amount: 338, tickerSymbol: "XEQT", quantity: 10, price: 33.8, fees: 4.95, date: day(-3) });
    await seedInvestmentTransaction({ ...base, type: "sell", subtype: "sell", amount: -730.5, tickerSymbol: "SHOP", quantity: 5, price: 146.1, date: day(-2) });
    await seedInvestmentTransaction({ ...base, type: "cash", subtype: "dividend", amount: -62.1, tickerSymbol: "XIC", date: day(-1) });
    await seedInvestmentTransaction({ ...base, type: "cash", subtype: "contribution", amount: -500, date: day(0) });

    // Act
    const { items } = await getActivity(request, cookie);

    // Assert
    expect(items.map((i) => [i.kind, i.amount])).toEqual([
      ["added", 500],
      ["dividend", 62.1],
      ["sell", 730.5],
      ["buy", -338],
    ]);
    expect(items[3]).toMatchObject({ quantity: 10, price: 33.8, fees: 4.95, security: { tickerSymbol: "XEQT" }, currency: "CAD", amountInBase: -338 });
    expect(items[0]).toMatchObject({ security: null, quantity: null, price: null });
  });

  test("gives an item's security, account and institution", async ({ request }) => {
    // Arrange
    const { cookie, base, item } = await setup(request);
    await seedInvestmentTransaction({ ...base, type: "buy", amount: 100, tickerSymbol: "AAPL", name: "BUY AAPL" });

    // Act
    const { items } = await getActivity(request, cookie);

    // Assert
    expect(items[0]).toMatchObject({
      description: "BUY AAPL",
      accountId: item.accountId,
      accountName: "TFSA",
      accountSubtype: "tfsa",
      accountMask: "7714",
      institutionName: "Maple Brokerage",
      security: { name: "AAPL Inc.", tickerSymbol: "AAPL" },
    });
  });

  test("classifies cash by subtype: dividend and interest as dividends, deposits and contributions as added, withdrawals as removed, the rest as other", async ({ request }) => {
    // Arrange
    const { cookie, base } = await setup(request);
    const cash = [
      ["dividend", "dividend"],
      ["interest", "dividend"],
      ["long-term capital gain", "dividend"],
      ["deposit", "added"],
      ["contribution", "added"],
      ["withdrawal", "removed"],
      ["distribution", "removed"],
      ["tax withheld", "other"],
      [null, "other"],
    ] as const;
    for (const [subtype] of cash) {
      await seedInvestmentTransaction({ ...base, type: "cash", subtype, amount: -10, name: subtype ?? "none" });
    }
    await seedInvestmentTransaction({ ...base, type: "fee", subtype: "account fee", amount: 5, name: "fee" });
    await seedInvestmentTransaction({ ...base, type: "transfer", subtype: "split", amount: 0, name: "split" });

    // Act
    const { items } = await getActivity(request, cookie);

    // Assert
    const kinds = Object.fromEntries(items.map((i) => [i.description, i.kind]));
    expect(kinds).toEqual({
      ...Object.fromEntries(cash.map(([subtype, kind]) => [subtype ?? "none", kind])),
      fee: "fee",
      split: "other",
    });
  });

  test("filters by kind, including other", async ({ request }) => {
    // Arrange
    const { cookie, base } = await setup(request);
    await seedInvestmentTransaction({ ...base, type: "buy", amount: 100, name: "a buy" });
    await seedInvestmentTransaction({ ...base, type: "cash", subtype: "dividend", amount: -5, name: "a dividend" });
    await seedInvestmentTransaction({ ...base, type: "cash", subtype: null, amount: -5, name: "unclassified cash" });
    await seedInvestmentTransaction({ ...base, type: "transfer", subtype: "split", amount: 0, name: "a split" });

    // Act
    const [buys, dividends, other] = await Promise.all(
      ["buy", "dividend", "other"].map((kind) => getActivity(request, cookie, `?kind=${kind}`)),
    );

    // Assert
    expect(buys!.items.map((i) => i.description)).toEqual(["a buy"]);
    expect(dividends!.items.map((i) => i.description)).toEqual(["a dividend"]);
    expect(other!.items.map((i) => i.description).sort()).toEqual(["a split", "unclassified cash"]);
  });

  test("filters by account", async ({ request }) => {
    // Arrange
    const { cookie, userId, base } = await setup(request);
    const other = await seedItemWithAccount(userId, { account: { type: "investment" } });
    await seedInvestmentTransaction({ ...base, type: "buy", amount: 1, name: "here" });
    await seedInvestmentTransaction({ userId, itemId: other.itemId, accountId: other.accountId, type: "buy", amount: 1, name: "there" });

    // Act
    const { items } = await getActivity(request, cookie, `?accountId=${other.accountId}`);

    // Assert
    expect(items.map((i) => i.description)).toEqual(["there"]);
  });

  test("filters by security", async ({ request }) => {
    // Arrange
    const { cookie, base } = await setup(request);
    await seedInvestmentTransaction({ ...base, type: "buy", amount: 1, tickerSymbol: "AAPL", name: "apple" });
    await seedInvestmentTransaction({ ...base, type: "buy", amount: 1, tickerSymbol: "MSFT", name: "microsoft" });
    const apple = (await getActivity(request, cookie)).items.find((i) => i.description === "apple")!;

    // Act
    const { items } = await getActivity(request, cookie, `?securityId=${apple.security!.id}`);

    // Assert
    expect(items.map((i) => i.description)).toEqual(["apple"]);
  });

  test("filters by dates, inclusive of both days", async ({ request }) => {
    // Arrange
    const { cookie, base } = await setup(request);
    for (const [name, offset] of [["before", -10], ["first", -5], ["middle", -3], ["last", -1], ["after", 0]] as const) {
      await seedInvestmentTransaction({ ...base, type: "buy", amount: 1, name, date: day(offset) });
    }

    // Act
    const { items } = await getActivity(request, cookie, `?startDate=${day(-5)}&endDate=${day(-1)}`);

    // Assert
    expect(items.map((i) => i.description)).toEqual(["last", "middle", "first"]);
  });

  test("converts a USD amount to CAD at today's rate", async ({ request }) => {
    // Arrange: a 100 USD dividend is 125 CAD.
    const { cookie, base } = await setup(request);
    await seedInvestmentTransaction({ ...base, type: "cash", subtype: "dividend", amount: -100, currency: "USD" });

    // Act
    const { items } = await getActivity(request, cookie);

    // Assert
    expect(items[0]).toMatchObject({ amount: 100, currency: "USD", amountInBase: 125 });
  });

  test("pages the list and counts the total", async ({ request }) => {
    // Arrange
    const { cookie, base } = await setup(request);
    for (let i = 0; i < 5; i++) {
      await seedInvestmentTransaction({ ...base, type: "buy", amount: 1, name: `n${i}`, date: day(-i) });
    }

    // Act
    const second = await getActivity(request, cookie, "?limit=2&page=2");

    // Assert
    expect(second.items.map((i) => i.description)).toEqual(["n2", "n3"]);
    expect(second.pagination).toEqual({ page: 2, limit: 2, total: 5, totalPages: 3 });
  });

  test("contains only the requesting user's activity", async ({ request }) => {
    // Arrange
    const owner = await setup(request);
    await seedInvestmentTransaction({ ...owner.base, type: "buy", amount: 1 });
    const { cookie } = await createAuthedUser(request);

    // Act
    const scoped = await getActivity(request, cookie);
    const byId = await getActivity(request, cookie, `?accountId=${owner.item.accountId}`);

    // Assert
    expect(scoped.items).toEqual([]);
    expect(byId.items).toEqual([]);
  });

  test("rejects an unknown kind, a bad date and an empty accountId (validation)", async ({ request }) => {
    const { cookie } = await createAuthedUser(request);

    for (const query of ["?kind=gifts", "?startDate=garbage", "?accountId=", "?limit=1000"]) {
      await expectValidationError(await request.get(`/api/investments/activity${query}`, { headers: withSession(cookie) }));
    }
  });
});
