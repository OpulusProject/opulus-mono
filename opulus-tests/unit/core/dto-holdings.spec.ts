import { expect, test } from "@playwright/test";
import { holdingKind, Prisma, STALE_PRICE_DAYS, toHoldingsDTO } from "@opulus/core";

const D = (n: number | string) => new Prisma.Decimal(n);
type Rows = Parameters<typeof toHoldingsDTO>[0];

let nextId = 0;
const row = (overrides: {
  value: number;
  basis: number | null;
  currency?: string | null;
  ticker?: string;
  id?: string;
  priceAsOf?: Date | null;
  type?: string;
  isCashEquivalent?: boolean;
  accountId?: string;
  security?: Record<string, unknown>;
}): Rows[number] =>
  ({
    id: overrides.id ?? `h${++nextId}`,
    accountId: overrides.accountId ?? "acct-1",
    itemId: "item-1",
    userId: "user-1",
    securityId: "sec-1",
    quantity: D(10),
    institutionPrice: D(overrides.value / 10),
    institutionPriceAsOf: overrides.priceAsOf === undefined ? new Date("2026-10-14T00:00:00Z") : overrides.priceAsOf,
    institutionValue: D(overrides.value),
    costBasis: overrides.basis === null ? null : D(overrides.basis),
    isoCurrencyCode: overrides.currency === undefined ? "USD" : overrides.currency,
    account: { name: "Brokerage", subtype: "tfsa", mask: "1234" },
    item: { institutionName: "Stub Brokerage" },
    security: { id: "sec-1", name: "Apple Inc.", tickerSymbol: overrides.ticker ?? "AAPL", type: overrides.type ?? "equity", isCashEquivalent: overrides.isCashEquivalent ?? false, ...overrides.security },
  }) as unknown as Rows[number];

const toBase = (rates: Record<string, number>) => (currency: string | null) => (currency === null ? 1 : (rates[currency] ?? 1));

/**
 * How stored holdings become the API's holdings and summary
 * (opulus-core/src/types/dto/investments/getHoldings.ts): each holding's gain in
 * its own currency, the summary in the base currency, only over holdings that
 * have a cost basis.
 *
 * Test cases:
 * - a holding's gain is its value minus its cost basis, with the gain as a fraction of the basis
 * - a holding with no cost basis has no gain, and is counted as without one in the summary
 * - a cost basis of zero gives a gain but no percentage
 * - the summary converts each holding to the base currency before adding, and its gain counts only holdings with a basis
 * - holdings come largest in the base currency first, ties by id
 * - an empty list gives an empty, zero summary with no percentage
 * - a holding with no price date has a null priceAsOf
 * - a security's kind comes from Plaid's type, and cash from the cash flag
 * - the summary splits the value by kind, largest first, and each holding has its share of the total
 * - a price older than the limit is stale, one at the limit, or with no date, is not
 * - an option and a bond carry their terms, and other securities carry none
 * - dividends are added up in the base currency, per holding and in total, only for accounts in view, and make the total return
 * - a holding's gain is also given in the base currency, at today's rate
 * - the gain ranking is the holdings that earned the most, in the base currency and not as a fraction, without those that have no cost basis
 * - an account with no holdings is counted by its balance, as "balance"
 */
test.describe("holdings DTO", () => {
  test("a holding's gain is its value minus its cost basis, with the gain as a fraction of the basis", () => {
    const { holdings } = toHoldingsDTO([row({ value: 1500, basis: 1000 })], { baseCurrency: "USD", rateOn: toBase({}) });

    expect(holdings[0]).toMatchObject({ value: 1500, costBasis: 1000, gain: 500, gainPercent: 0.5, valueInBase: 1500, priceAsOf: "2026-10-14T00:00:00.000Z" });
  });

  test("a holding with no cost basis has no gain, and is counted as without one in the summary", () => {
    const { holdings, summary } = toHoldingsDTO([row({ value: 250, basis: null })], { baseCurrency: "USD", rateOn: toBase({}) });

    expect(holdings[0]).toMatchObject({ costBasis: null, gain: null, gainPercent: null });
    expect(summary).toMatchObject({ value: 250, costBasis: 0, gain: 0, gainPercent: null, holdingsWithoutCostBasis: 1 });
  });

  test("a cost basis of zero gives a gain but no percentage", () => {
    const { holdings } = toHoldingsDTO([row({ value: 100, basis: 0 })], { baseCurrency: "USD", rateOn: toBase({}) });

    expect(holdings[0]).toMatchObject({ gain: 100, gainPercent: null });
  });

  test("the summary converts each holding to the base currency before adding, and its gain counts only holdings with a basis", () => {
    // 1000 USD (basis 800) and 500 EUR (basis 400) and 300 USD with no basis; 1 EUR = 1.1 USD.
    const { holdings, summary } = toHoldingsDTO(
      [row({ value: 1000, basis: 800 }), row({ value: 500, basis: 400, currency: "EUR" }), row({ value: 300, basis: null })],
      { baseCurrency: "USD", rateOn: toBase({ EUR: 1.1, USD: 1 }) },
    );

    expect(holdings.find((h) => h.currency === "EUR")).toMatchObject({ value: 500, valueInBase: 550, gain: 100 });
    expect(summary.value).toBe(1850);
    expect(summary.costBasis).toBe(1240);
    expect(summary.gain).toBe(310);
    expect(summary.gainPercent).toBeCloseTo(310 / 1240, 10);
    expect(summary.holdingsWithoutCostBasis).toBe(1);
  });

  test("holdings come largest in the base currency first, ties by id", () => {
    const { holdings } = toHoldingsDTO(
      [row({ id: "b", value: 100, basis: null }), row({ id: "a", value: 100, basis: null }), row({ id: "c", value: 500, basis: null, currency: "EUR" }), row({ id: "d", value: 450, basis: null })],
      { baseCurrency: "USD", rateOn: toBase({ EUR: 1.1 }) },
    );

    expect(holdings.map((h) => h.id)).toEqual(["c", "d", "a", "b"]);
  });

  test("an empty list gives an empty, zero summary with no percentage", () => {
    expect(toHoldingsDTO([], { baseCurrency: "CAD", rateOn: toBase({}) })).toEqual({
      baseCurrency: "CAD",
      summary: {
        value: 0, accountCount: 0, holdingCount: 0, allocation: [], currencies: [], topHoldingsShare: 0,
        dividends: 0, dividendYield: 0, totalReturn: 0, totalReturnPercent: null, gainRanking: [],
        costBasis: 0, gain: 0, gainPercent: null, holdingsWithoutCostBasis: 0,
      },
      accounts: [],
      holdings: [],
      positions: [],
    });
  });

  test("a holding with no price date has a null priceAsOf", () => {
    const { holdings } = toHoldingsDTO([row({ value: 100, basis: 50, priceAsOf: null })], { baseCurrency: "USD", rateOn: toBase({}) });

    expect(holdings[0]!.priceAsOf).toBeNull();
  });

  test("a security's kind comes from Plaid's type, and cash from the cash flag", () => {
    expect(
      [["etf", false], ["equity", false], ["mutual fund", false], ["fixed income", false], ["derivative", false], ["cash", false], ["loan", false], [null, false], ["equity", true]].map(
        ([type, cash]) => holdingKind(type as string | null, cash as boolean),
      ),
    ).toEqual(["etf", "stock", "mutualFund", "bond", "option", "cash", "other", "other", "cash"]);
  });

  test("the summary splits the value by kind, largest first, and each holding has its share of the total", () => {
    const { summary, holdings } = toHoldingsDTO(
      [row({ id: "e", value: 600, basis: null, type: "etf" }), row({ id: "s", value: 300, basis: null }), row({ id: "c", value: 100, basis: null, type: "cash", isCashEquivalent: true })],
      { baseCurrency: "USD", rateOn: toBase({}) },
    );

    expect(summary.allocation).toEqual([
      { kind: "etf", value: 600, share: 0.6 },
      { kind: "stock", value: 300, share: 0.3 },
      { kind: "cash", value: 100, share: 0.1 },
    ]);
    expect(holdings.map((h) => [h.id, h.share])).toEqual([["e", 0.6], ["s", 0.3], ["c", 0.1]]);
    expect(summary.topHoldingsShare).toBe(0.9);
  });

  test("a price older than the limit is stale, one at the limit, or with no date, is not", () => {
    const now = new Date("2026-10-20T00:00:00Z");
    const ago = (days: number) => new Date(now.getTime() - days * 86_400_000);
    const { holdings } = toHoldingsDTO(
      [
        row({ id: "old", value: 1, basis: null, priceAsOf: ago(STALE_PRICE_DAYS + 1) }),
        row({ id: "edge", value: 1, basis: null, priceAsOf: ago(STALE_PRICE_DAYS) }),
        row({ id: "none", value: 1, basis: null, priceAsOf: null }),
      ],
      { baseCurrency: "USD", rateOn: toBase({}), now },
    );

    expect(Object.fromEntries(holdings.map((h) => [h.id, h.priceStale]))).toEqual({ old: true, edge: false, none: false });
  });

  test("an option and a bond carry their terms, and other securities carry none", () => {
    const { holdings } = toHoldingsDTO(
      [
        row({ id: "opt", value: 3, basis: null, type: "derivative", security: { optionContractType: "call", optionExpirationDate: new Date("2027-01-15T00:00:00Z"), optionStrikePrice: D(250), optionUnderlyingTicker: "AAPL", marketIdentifierCode: "XNAS" } }),
        row({ id: "bond", value: 2, basis: null, type: "fixed income", security: { bondMaturityDate: new Date("2030-06-01T00:00:00Z"), bondFaceValue: D(5000), bondYieldRate: D(2.75), bondYieldType: "coupon" } }),
        row({ id: "stock", value: 1, basis: null }),
      ],
      { baseCurrency: "USD", rateOn: toBase({}) },
    );
    const by = Object.fromEntries(holdings.map((h) => [h.id, h.security]));

    expect(by.opt).toMatchObject({ exchange: "XNAS", bond: null, option: { contractType: "call", expirationDate: "2027-01-15T00:00:00.000Z", strikePrice: 250, underlyingTicker: "AAPL" } });
    expect(by.bond).toMatchObject({ option: null, bond: { maturityDate: "2030-06-01T00:00:00.000Z", faceValue: 5000, yieldRate: 2.75, yieldType: "coupon", issueDate: null } });
    expect(by.stock).toMatchObject({ option: null, bond: null });
  });

  test("dividends are added up in the base currency, per holding and in total, only for accounts in view, and make the total return", () => {
    // 1,000 worth, 800 paid (gain 200). Payments (Plaid's sign: money in is negative): 30 and 20 on the holding, 10 EUR (11 USD) with no security, and 99 in an account not in view.
    const { holdings, summary } = toHoldingsDTO([row({ id: "h", value: 1000, basis: 800 })], {
      baseCurrency: "USD",
      rateOn: toBase({ EUR: 1.1 }),
      dividends: [
        { accountId: "acct-1", securityId: "sec-1", amount: D(-30), isoCurrencyCode: "USD" },
        { accountId: "acct-1", securityId: "sec-1", amount: D(-20), isoCurrencyCode: "USD" },
        { accountId: "acct-1", securityId: null, amount: D(-10), isoCurrencyCode: "EUR" },
        { accountId: "elsewhere", securityId: "sec-1", amount: D(-99), isoCurrencyCode: "USD" },
      ],
    });

    expect(holdings[0]!.dividends).toBe(50);
    expect(summary.dividends).toBe(61);
    expect(summary.dividendYield).toBeCloseTo(0.061, 6);
    expect(summary.totalReturn).toBe(261);
    expect(summary.totalReturnPercent).toBeCloseTo(261 / 800, 10);
  });

  test("a holding's gain is also given in the base currency, at today's rate", () => {
    // 500 EUR worth, 400 paid: a gain of 100 EUR is 110 USD at 1 EUR = 1.1 USD.
    const { holdings } = toHoldingsDTO([row({ value: 500, basis: 400, currency: "EUR" }), row({ value: 90, basis: null })], {
      baseCurrency: "USD",
      rateOn: toBase({ EUR: 1.1 }),
    });

    expect(holdings.find((h) => h.currency === "EUR")).toMatchObject({ gain: 100, gainInBase: 110 });
    expect(holdings.find((h) => h.costBasis === null)!.gainInBase).toBeNull();
  });

  test("the gain ranking is the holdings that earned the most, in the base currency and not as a fraction, without those that have no cost basis", () => {
    // By fraction "tiny" (+50%) would lead; by amount "big" (+500) does. The EUR holding
    // gained 200 EUR = 220 USD, more than the USD one's 210, though 200 < 210 as numbers.
    const rows = [
      row({ id: "tiny", value: 15, basis: 10 }),
      row({ id: "big", value: 2000, basis: 1500 }),
      row({ id: "usd", value: 310, basis: 100 }),
      row({ id: "eur", value: 400, basis: 200, currency: "EUR" }),
      row({ id: "loss", value: 80, basis: 100 }),
      row({ id: "none", value: 100, basis: null }),
      ...Array.from({ length: 4 }, (_, i) => row({ id: `s${i}`, value: 101 + i, basis: 100 })),
    ];

    const { summary } = toHoldingsDTO(rows, { baseCurrency: "USD", rateOn: toBase({ EUR: 1.1 }) });

    expect(summary.gainRanking).toEqual(["big", "eur", "usd", "tiny", "s3", "s2"]);
  });

  test("an account with no holdings is counted by its balance, as \"balance\"", () => {
    const { summary, accounts } = toHoldingsDTO([row({ value: 100, basis: null })], {
      baseCurrency: "USD",
      rateOn: toBase({ EUR: 1.1 }),
      accounts: [
        { id: "acct-1", name: "Brokerage", subtype: "tfsa", mask: "1234", balanceCurrent: D(5), isoCurrencyCode: "USD", item: { institutionName: "X" } },
        { id: "resp", name: "RESP", subtype: "resp", mask: null, balanceCurrent: D(1000), isoCurrencyCode: "EUR", item: { institutionName: "Y" } },
        { id: "no-balance", name: "Empty", subtype: null, mask: null, balanceCurrent: null, isoCurrencyCode: "USD", item: { institutionName: null } },
      ],
    });

    expect(summary.value).toBe(1200);
    expect(summary.allocation.map((a) => a.kind)).toEqual(["balance", "stock"]);
    expect(accounts.map((a) => [a.id, a.value, a.hasHoldings])).toEqual([["resp", 1100, false], ["acct-1", 100, true]]);
  });
});
