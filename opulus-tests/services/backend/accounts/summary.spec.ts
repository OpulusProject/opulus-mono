import { expect, test, type APIRequestContext } from "@playwright/test";
import { AccountsSummaryResponseSchema } from "@opulus/core";
import { withSession } from "../../../shared/client.js";
import {
  expectMatchesSchema,
  expectStatus,
  expectValidationError,
} from "../../../shared/assertions.js";
import {
  clearExchangeRates,
  createAuthedUser,
  seedExchangeRates,
  seedItemWithAccount,
} from "../../../shared/fixtures/index.js";

type AccountOverrides = NonNullable<
  Parameters<typeof seedItemWithAccount>[1]
>["account"];

/** GET /api/accounts/summary with an optional query string; returns `data`. */
async function getSummary(
  request: APIRequestContext,
  cookie: string,
  query = "",
) {
  const res = await request.get(`/api/accounts/summary${query}`, {
    headers: withSession(cookie),
  });
  const body = await expectMatchesSchema(res, AccountsSummaryResponseSchema);
  return body.data;
}

/** A user with one connection per account, each with the given overrides. */
async function setup(request: APIRequestContext, accounts: AccountOverrides[]) {
  const { cookie, userId } = await createAuthedUser(request);
  for (const account of accounts) {
    await seedItemWithAccount(userId, { account });
  }
  return { cookie, userId };
}

const checking = (balanceCurrent: number): AccountOverrides => ({
  type: "depository",
  balanceCurrent,
});
const card = (
  balanceCurrent: number,
  limit: {
    balanceLimit?: number | null;
    balanceAvailable?: number | null;
  } = {},
): AccountOverrides => ({
  type: "credit",
  subtype: "credit card",
  balanceCurrent,
  balanceLimit: limit.balanceLimit ?? null,
  balanceAvailable: limit.balanceAvailable ?? null,
});
const inUsd = (account: AccountOverrides): AccountOverrides => ({
  ...account,
  isoCurrencyCode: "USD",
});

const daysAgo = (days: number) =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

/**
 * The rates in exchange_rate for these specs, per euro. Balances convert at the
 * latest rate on or before today: CAD 1.5 and USD 1.2 (so 1 USD = 1.25 CAD) on
 * each of the last four days, and GBP 0.75 (1 GBP = 2 CAD) only three days
 * ago, so a currency whose latest rate is not today's is covered too.
 */
function rates() {
  const stored: { date: string; currency: string; perEur: number }[] = [];
  for (let ago = 0; ago <= 3; ago++) {
    stored.push(
      { date: daysAgo(ago), currency: "EUR", perEur: 1 },
      { date: daysAgo(ago), currency: "CAD", perEur: 1.5 },
      { date: daysAgo(ago), currency: "USD", perEur: 1.2 },
    );
  }
  stored.push({ date: daysAgo(3), currency: "GBP", perEur: 0.75 });
  return stored;
}

/**
 * This file: the accounts summary endpoint (what the accounts add up to, in the
 * base currency, overall and by type). Accounts have no create endpoint, so
 * they are seeded directly into the isolated test DB and verified over HTTP.
 * Balances in other currencies are converted with exchange_rate, which this
 * file clears and seeds once (see rates): the table is shared by every user,
 * and no third party is involved.
 */
test.describe("GET /api/accounts/summary", () => {
  test.beforeAll(async () => {
    await clearExchangeRates();
    await seedExchangeRates(rates());
  });

  test("requires authentication (401)", async ({ request }) => {
    const res = await request.get("/api/accounts/summary");
    await expectStatus(res, 401);
  });

  test("returns zeros for a user with no accounts", async ({ request }) => {
    const { cookie } = await createAuthedUser(request);
    const data = await getSummary(request, cookie);
    expect(data).toEqual({
      baseCurrency: "CAD",
      count: 0,
      total: { balance: 0, assets: 0, owed: 0, netWorth: 0 },
      byType: [],
    });
  });

  test("adds up balances, assets, what is owed and net worth", async ({
    request,
  }) => {
    const { cookie } = await setup(request, [
      checking(1000),
      checking(500.25),
      { type: "investment", balanceCurrent: 5000 },
      card(300, { balanceLimit: 1000 }),
      { type: "loan", balanceCurrent: 2000 },
    ]);

    const data = await getSummary(request, cookie);

    expect(data.count).toBe(5);
    expect(data.total).toEqual({
      balance: 8800.25,
      assets: 6500.25,
      owed: 2300,
      netWorth: 4200.25,
    });
  });

  test("converts accounts in other currencies to the base, so each total is one figure", async ({
    request,
  }) => {
    // 40 USD is 50 CAD; the USD card's 10 owed is 12.50 and its 100 limit is 125.
    const { cookie } = await setup(request, [
      checking(100),
      inUsd(checking(40)),
      inUsd(card(10, { balanceLimit: 100 })),
    ]);

    const data = await getSummary(request, cookie);

    expect(data.total).toEqual({
      balance: 162.5,
      assets: 150,
      owed: 12.5,
      netWorth: 137.5,
    });
    expect(data.byType).toEqual([
      { type: "depository", count: 2, balance: 150, credit: null },
      {
        type: "credit",
        count: 1,
        balance: 12.5,
        credit: { limit: 125, utilization: 0.1 },
      },
    ]);
  });

  test("uses the latest rate on or before today when a currency has none for today", async ({
    request,
  }) => {
    // GBP was only published three days ago (1 GBP = 2 CAD).
    const { cookie } = await setup(request, [
      { ...checking(100), isoCurrencyCode: "GBP" },
    ]);

    const data = await getSummary(request, cookie);

    expect(data.total.balance).toBe(200);
  });

  test("takes an account with no currency as the base currency", async ({
    request,
  }) => {
    const { cookie } = await setup(request, [
      { ...checking(40), isoCurrencyCode: null },
      checking(10),
    ]);

    const data = await getSummary(request, cookie);

    expect(data.total.balance).toBe(50);
  });

  test("totals each type, in a fixed order, with brokerage as investment and unknown types as other", async ({
    request,
  }) => {
    const { cookie } = await setup(request, [
      { type: "loan", balanceCurrent: 400 },
      { type: "brokerage", balanceCurrent: 100 },
      { type: "investment", balanceCurrent: 50 },
      checking(10),
      { type: "mystery", balanceCurrent: 7 },
    ]);

    const data = await getSummary(request, cookie);

    expect(
      data.byType.map(({ type, count, balance }) => [type, count, balance]),
    ).toEqual([
      ["depository", 1, 10],
      ["investment", 2, 150],
      ["loan", 1, 400],
      ["other", 1, 7],
    ]);
  });

  test("works out credit utilization from the cards that have a limit, in the base currency", async ({
    request,
  }) => {
    // Limits and what is owed on them, in CAD: 1000 and 300; a limit worked out
    // from the available credit (100 owed + 900 available = 1000) and 100 owed;
    // a USD card (400 limit, 80 owed = 500 and 100). The last card has no
    // limit, so it is left out of both sides.
    const { cookie } = await setup(request, [
      card(300, { balanceLimit: 1000 }),
      card(100, { balanceAvailable: 900 }),
      inUsd(card(80, { balanceLimit: 400 })),
      card(5000),
    ]);

    const data = await getSummary(request, cookie, "?type=credit");

    expect(data.byType).toEqual([
      {
        type: "credit",
        count: 4,
        balance: 5500,
        credit: { limit: 2500, utilization: 0.2 },
      },
    ]);
  });

  test("has no credit figures when no card has a limit", async ({
    request,
  }) => {
    const { cookie } = await setup(request, [card(300), checking(10)]);

    const data = await getSummary(request, cookie);

    expect(data.byType.map((row) => [row.type, row.credit])).toEqual([
      ["depository", null],
      ["credit", null],
    ]);
  });

  test("counts an account with no balance but adds nothing for it", async ({
    request,
  }) => {
    const { cookie } = await setup(request, [
      checking(25),
      { type: "depository", balanceCurrent: null },
    ]);

    const data = await getSummary(request, cookie);

    expect(data.count).toBe(2);
    expect(data.total).toMatchObject({ balance: 25, assets: 25 });
  });

  test("leaves accounts in a currency with no stored rate out of every amount", async ({
    request,
  }) => {
    const { cookie } = await setup(request, [
      checking(100),
      { ...checking(80), isoCurrencyCode: "XXX" },
      { ...card(20), isoCurrencyCode: "XXX" },
    ]);

    const data = await getSummary(request, cookie);

    // They are counted (3 accounts), but only the CAD one is in the amounts.
    expect(data.count).toBe(3);
    expect(data.total).toEqual({
      balance: 100,
      assets: 100,
      owed: 0,
      netWorth: 100,
    });
    expect(data.byType).toEqual([
      { type: "depository", count: 2, balance: 100, credit: null },
      { type: "credit", count: 1, balance: 0, credit: null },
    ]);
  });

  test("applies the type filter, as the list does", async ({ request }) => {
    const { cookie } = await setup(request, [
      checking(100),
      card(30, { balanceLimit: 100 }),
      { type: "loan", balanceCurrent: 70 },
    ]);

    const owed = await getSummary(request, cookie, "?type=credit&type=loan");

    expect(owed.count).toBe(2);
    expect(owed.total).toEqual({
      balance: 100,
      assets: 0,
      owed: 100,
      netWorth: -100,
    });
    expect(owed.byType.map((row) => row.type)).toEqual(["credit", "loan"]);
  });

  test("scopes the summary to the requesting user", async ({ request }) => {
    const mine = await setup(request, [checking(10)]);
    await setup(request, [checking(9999)]);

    const data = await getSummary(request, mine.cookie);

    expect(data.count).toBe(1);
    expect(data.total.balance).toBe(10);
  });

  test("rejects an unknown type (validation)", async ({ request }) => {
    const { cookie } = await createAuthedUser(request);
    const res = await request.get("/api/accounts/summary?type=nope", {
      headers: withSession(cookie),
    });
    await expectValidationError(res);
  });
});
