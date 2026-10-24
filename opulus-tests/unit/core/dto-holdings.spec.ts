import { expect, test } from "@playwright/test";
import { type HoldingsRange, holdingKind, holdingsRangeStart, Prisma, STALE_PRICE_DAYS, toHoldingsDTO } from "@opulus/core";

const D = (n: number | string) => new Prisma.Decimal(n);
type Rows = Parameters<typeof toHoldingsDTO>[0];

let nextId = 0;
const row = (overrides: {
  value: number;
  basis: number | null;
  currency?: string | null;
  ticker?: string;
  id?: string;
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
    institutionValue: D(overrides.value),
    costBasis: overrides.basis === null ? null : D(overrides.basis),
    isoCurrencyCode: overrides.currency === undefined ? "USD" : overrides.currency,
    account: { name: "Brokerage", subtype: "tfsa", mask: "1234" },
    item: { institutionName: "Stub Brokerage" },
    security: { id: "sec-1", name: "Apple Inc.", tickerSymbol: overrides.ticker ?? "AAPL", type: overrides.type ?? "equity", isCashEquivalent: overrides.isCashEquivalent ?? false, dividendRate: null, dividendCurrency: null, ...overrides.security },
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
 * - a holding of a security we have no price for is valued as the institution reports it, with no price or price date
 * - a security's kind comes from Plaid's type, and cash from the cash flag
 * - the summary splits the value by kind, largest first, and each holding has its share of the total
 * - a holding is valued at its quantity times our price when we have one, whatever the institution reports
 * - our price is converted to the holding's currency, and the gain is withheld when the two currencies differ (the cost basis' currency is a guess)
 * - the summary, allocation and gain follow our prices, and a security with none stays at the institution's value
 * - a price older than the limit is stale, one at the limit is not, and a holding with no price is not
 * - an option and a bond carry their terms, and other securities carry none
 * - dividends are added up in the base currency, per holding and in total, only for accounts in view, and make the total return
 * - a holding's estimated annual income is its quantity times the security's dividend rate, in the base currency, and has none without a rate
 * - a position's estimated annual income adds its holdings up, and has none when one of them has none
 * - estimated dividends are a year's income for the days of the range, and none over all time or without a rate
 * - the summary has no estimated dividends when no holding has a rate
 * - a holding's gain is also given in the base currency, at today's rate
 * - the gain ranking is the holdings that earned the most, in the base currency and not as a fraction, without those that have no cost basis
 * - an account with no holdings is counted by its balance, as "balance"
 * - a range starts a day, week, month or year back (clamped to the month's last day), or on 1 January, and "all" has no start
 * - over a range, a holding's gain is its value minus its value at the start, with no buys in the range counted as a gain and no sells as a loss
 * - over a range, a holding bought entirely in it is measured against what was paid
 * - over a range, a holding with no price at the start, or no price of ours, has no gain
 * - a custom range starts on its first day, or today without one
 * - a custom range that ended before today measures the gain up to its last day, from the quantity held and the price then
 * - a custom range that ended before today gives no gain for a holding with no price on its last day
 * - the response names its range, first day and last day
 */
test.describe("holdings DTO", () => {
  test("a holding's gain is its value minus its cost basis, with the gain as a fraction of the basis", () => {
    const { holdings } = toHoldingsDTO([row({ value: 1500, basis: 1000 })], { baseCurrency: "USD", rateOn: toBase({}) });

    expect(holdings[0]).toMatchObject({ value: 1500, costBasis: 1000, gain: 500, gainPercent: 0.5, valueInBase: 1500, price: null, priceAsOf: null });
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
      range: "all",
      since: null,
      until: null,
      summary: {
        value: 0, accountCount: 0, holdingCount: 0, allocation: [], currencies: [], topHoldingsShare: 0,
        dividends: 0, estimatedDividends: null, dividendYield: 0, totalReturn: 0, totalReturnPercent: null, gainRanking: [],
        costBasis: 0, gain: 0, gainPercent: null, holdingsWithoutCostBasis: 0,
      },
      accounts: [],
      holdings: [],
      positions: [],
    });
  });

  test("a holding of a security we have no price for is valued as the institution reports it, with no price or price date", () => {
    const { holdings, summary } = toHoldingsDTO([row({ value: 100, basis: 50 })], { baseCurrency: "USD", rateOn: toBase({}) });

    expect(holdings[0]).toMatchObject({ value: 100, price: null, priceAsOf: null, priceStale: false, gain: 50 });
    expect(summary.value).toBe(100);
  });

  test("a holding is valued at its quantity times our price when we have one, whatever the institution reports", () => {
    // 10 shares; the institution says 0 (as Wealthsimple did), we have a price of 12.5.
    const prices = new Map([["sec-1", { price: 12.5, currency: "USD", asOf: new Date("2026-10-20T15:00:00Z") }]]);
    const { holdings, summary } = toHoldingsDTO([row({ value: 0, basis: 100 })], { baseCurrency: "USD", rateOn: toBase({}), prices });

    expect(holdings[0]).toMatchObject({ price: 12.5, priceAsOf: "2026-10-20T15:00:00.000Z", value: 125, valueInBase: 125, costBasis: 100, gain: 25, gainPercent: 0.25 });
    expect(summary).toMatchObject({ value: 125, gain: 25 });
  });

  test("our price is converted to the holding's currency, and the gain is withheld when the two currencies differ (the cost basis' currency is a guess)", () => {
    // A USD price (rate 1.25 CAD) on a holding Plaid labels CAD.
    const prices = new Map([["sec-1", { price: 100, currency: "USD", asOf: new Date("2026-10-20T15:00:00Z") }]]);
    const { holdings, summary } = toHoldingsDTO([row({ value: 0, basis: 900, currency: "CAD" })], {
      baseCurrency: "CAD",
      rateOn: toBase({ USD: 1.25 }),
      prices,
    });

    // 10 shares at US$100 is C$1,250; the holding is in CAD, the base.
    expect(holdings[0]).toMatchObject({ currency: "CAD", price: 125, value: 1250, valueInBase: 1250, costBasis: 900, gain: null, gainInBase: null, gainPercent: null });
    expect(summary).toMatchObject({ value: 1250, holdingsWithoutCostBasis: 1, gain: 0 });
  });

  test("the summary, allocation and gain follow our prices, and a security with none stays at the institution's value", () => {
    const prices = new Map([["priced", { price: 20, currency: "USD", asOf: new Date("2026-10-20T15:00:00Z") }]]);
    const { holdings, summary } = toHoldingsDTO(
      [
        row({ id: "a", value: 0, basis: 100, security: { id: "priced" } }),
        row({ id: "b", value: 300, basis: 200, security: { id: "other" } }),
      ],
      { baseCurrency: "USD", rateOn: toBase({}), prices },
    );

    expect(holdings.map((h) => [h.id, h.value])).toEqual([["b", 300], ["a", 200]]);
    expect(summary).toMatchObject({ value: 500, costBasis: 300, gain: 200 });
    expect(summary.allocation).toEqual([{ kind: "stock", value: 500, share: 1 }]);
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

  test("a price older than the limit is stale, one at the limit is not, and a holding with no price is not", () => {
    const now = new Date("2026-10-20T00:00:00Z");
    const ago = (days: number) => new Date(now.getTime() - days * 86_400_000);
    const price = (days: number) => ({ price: 1, currency: "USD", asOf: ago(days) });
    const prices = new Map([
      ["s-old", price(STALE_PRICE_DAYS + 1)],
      ["s-edge", price(STALE_PRICE_DAYS)],
    ]);
    const { holdings } = toHoldingsDTO(
      [
        row({ id: "old", value: 1, basis: null, security: { id: "s-old" } }),
        row({ id: "edge", value: 1, basis: null, security: { id: "s-edge" } }),
        row({ id: "none", value: 1, basis: null, security: { id: "s-none" } }),
      ],
      { baseCurrency: "USD", rateOn: toBase({}), now, prices },
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

  test("a holding's estimated annual income is its quantity times the security's dividend rate, in the base currency, and has none without a rate", () => {
    // 10 shares paying 1.50 USD a year (1 USD = 1.25 base), 10 paying 0, 10 with no rate known.
    const { holdings } = toHoldingsDTO(
      [
        row({ value: 1000, basis: null, id: "pays", security: { id: "s1", dividendRate: D("1.5"), dividendCurrency: "USD" } }),
        row({ value: 1000, basis: null, id: "zero", security: { id: "s2", dividendRate: D(0), dividendCurrency: "USD" } }),
        row({ value: 1000, basis: null, id: "unknown", security: { id: "s3", dividendRate: null, dividendCurrency: null } }),
      ],
      { baseCurrency: "CAD", rateOn: toBase({ USD: 1.25 }) },
    );

    const byId = (id: string) => holdings.find((h) => h.id === id)!.estimatedAnnualIncome;
    expect(byId("pays")).toBe(18.75);
    expect(byId("zero")).toBe(0);
    expect(byId("unknown")).toBeNull();
  });

  test("a position's estimated annual income adds its holdings up, and has none when one of them has none", () => {
    const security = { id: "sec-shared", dividendRate: D(2), dividendCurrency: "CAD" };
    const { positions } = toHoldingsDTO(
      [
        row({ value: 100, basis: null, id: "a", currency: "CAD", accountId: "acct-1", security }),
        row({ value: 100, basis: null, id: "b", currency: "CAD", accountId: "acct-2", security }),
        row({ value: 100, basis: null, id: "c", currency: "CAD", accountId: "acct-1", security: { id: "sec-other", dividendRate: null, dividendCurrency: null } }),
      ],
      { baseCurrency: "CAD", rateOn: toBase({}) },
    );

    // 10 shares in each of two accounts, 2 a share.
    expect(positions.find((p) => p.security.id === "sec-shared")!.estimatedAnnualIncome).toBe(40);
    expect(positions.find((p) => p.security.id === "sec-other")!.estimatedAnnualIncome).toBeNull();
  });

  test("estimated dividends are a year's income for the days of the range, and none over all time or without a rate", () => {
    // 10 shares paying 3.65 a year: 0.10 a day. The week is 7 days, a custom range 10 (1st to 11th).
    const rows = [
      row({ value: 1000, basis: null, id: "pays", currency: "CAD", security: { id: "s1", dividendRate: D("3.65"), dividendCurrency: "CAD" } }),
      row({ value: 1000, basis: null, id: "unknown", currency: "CAD", security: { id: "s2", dividendRate: null, dividendCurrency: null } }),
    ];
    const now = new Date("2026-10-24T12:00:00Z");
    const over = (range: HoldingsRange, extra = {}) => toHoldingsDTO(rows, { baseCurrency: "CAD", rateOn: toBase({}), now, range, ...extra });

    const week = over("week");
    expect(week.holdings.find((h) => h.id === "pays")!.estimatedDividends).toBe(0.7);
    expect(week.holdings.find((h) => h.id === "unknown")!.estimatedDividends).toBeNull();
    expect(week.positions.find((p) => p.security.id === "s1")!.estimatedDividends).toBe(0.7);
    // The summary adds up the holdings that have a rate.
    expect(week.summary.estimatedDividends).toBe(0.7);

    const custom = over("custom", { from: "2026-10-01", until: "2026-10-11" });
    expect(custom.holdings.find((h) => h.id === "pays")!.estimatedDividends).toBe(1);

    const all = over("all");
    expect(all.holdings.find((h) => h.id === "pays")!.estimatedDividends).toBeNull();
    expect(all.summary.estimatedDividends).toBeNull();
  });

  test("the summary has no estimated dividends when no holding has a rate", () => {
    const { summary } = toHoldingsDTO([row({ value: 100, basis: null, security: { dividendRate: null, dividendCurrency: null } })], {
      baseCurrency: "CAD",
      rateOn: toBase({}),
      range: "month",
    });
    expect(summary.estimatedDividends).toBeNull();
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

  const price = (n: number) => ({ price: n, currency: "USD", asOf: new Date("2026-10-23T00:00:00Z") });
  const trade = (quantity: number, amount: number) => ({ accountId: "acct-1", date: new Date("2026-10-01T00:00:00Z"), securityId: "sec-1", quantity: D(quantity), amount: D(amount), isoCurrencyCode: "USD" });
  const over = (opts: { quantity?: number; now: number; start?: number; trades?: ReturnType<typeof trade>[] }) =>
    toHoldingsDTO([row({ value: 0, basis: 500 })], {
      baseCurrency: "USD",
      rateOn: toBase({}),
      now: new Date("2026-10-23T12:00:00Z"),
      range: "month",
      prices: new Map([["sec-1", price(opts.now)]]),
      startPrices: opts.start === undefined ? new Map() : new Map([["sec-1", price(opts.start)]]),
      trades: opts.trades ?? [],
    });

  test("a range starts a day, week, month or year back (clamped to the month's last day), or on 1 January, and \"all\" has no start", () => {
    expect(holdingsRangeStart("day", "2026-03-01")).toBe("2026-02-28");
    expect(holdingsRangeStart("week", "2026-03-03")).toBe("2026-02-24");
    expect(holdingsRangeStart("month", "2026-03-31")).toBe("2026-02-28");
    expect(holdingsRangeStart("month", "2026-01-15")).toBe("2025-12-15");
    expect(holdingsRangeStart("year", "2028-02-29")).toBe("2027-02-28");
    expect(holdingsRangeStart("ytd", "2026-10-23")).toBe("2026-01-01");
    expect(holdingsRangeStart("all", "2026-10-23")).toBeNull();
  });

  test("over a range, a holding's gain is its value minus its value at the start, with no buys in the range counted as a gain and no sells as a loss", () => {
    // 10 shares now at 110; 4 of them were bought in the range for 400, so 6 started it at 90.
    const { holdings, summary, range, since } = over({ now: 110, start: 90, trades: [trade(4, 400)] });

    // 1100 now - (6 * 90 + 400) = 160, of the 940 it started with and put in.
    expect(holdings[0]).toMatchObject({ value: 1100, costBasis: 500, gain: 160 });
    expect(holdings[0]!.gainPercent).toBeCloseTo(160 / 940);
    expect(summary).toMatchObject({ costBasis: 940, gain: 160 });

    // 2 shares sold for 220 leave 10 at 110, so 12 started it: 1100 - (12 * 90 - 220) = 240.
    expect(over({ now: 110, start: 90, trades: [trade(-2, -220)] }).holdings[0]!.gain).toBe(240);
    expect([range, since]).toEqual(["month", "2026-09-23"]);
  });

  test("over a range, a holding bought entirely in it is measured against what was paid", () => {
    const { holdings } = over({ now: 110, trades: [trade(10, 1000)] });

    expect(holdings[0]).toMatchObject({ gain: 100, gainPercent: 0.1 });
  });

  test("over a range, a holding with no price at the start, or no price of ours, has no gain", () => {
    expect(over({ now: 110 }).holdings[0]).toMatchObject({ gain: null, gainPercent: null });

    const { holdings, summary } = toHoldingsDTO([row({ value: 1000, basis: 800 })], { baseCurrency: "USD", rateOn: toBase({}), range: "week" });
    expect(holdings[0]).toMatchObject({ gain: null });
    expect(summary.holdingsWithoutCostBasis).toBe(1);
  });

  test("the response names its range and first day", () => {
    expect(toHoldingsDTO([], { baseCurrency: "USD", rateOn: toBase({}) })).toMatchObject({ range: "all", since: null, until: null });
    expect(over({ now: 110, start: 90 })).toMatchObject({ range: "month", since: "2026-09-23", until: "2026-10-23" });
  });

  test("a custom range starts on its first day, or today without one", () => {
    expect(holdingsRangeStart("custom", "2026-10-23", "2026-01-05")).toBe("2026-01-05");
    expect(holdingsRangeStart("custom", "2026-10-23")).toBe("2026-10-23");
  });

  const customOver = (opts: { end?: number; trades: ReturnType<typeof trade>[] }) =>
    toHoldingsDTO([row({ value: 0, basis: 500 })], {
      baseCurrency: "USD",
      rateOn: toBase({}),
      now: new Date("2026-10-23T12:00:00Z"),
      range: "custom",
      from: "2026-03-01",
      until: "2026-03-31",
      prices: new Map([["sec-1", price(200)]]),
      startPrices: new Map([["sec-1", price(90)]]),
      endPrices: opts.end === undefined ? new Map() : new Map([["sec-1", price(opts.end)]]),
      trades: opts.trades,
    });
  const dated = (day: string, quantity: number, amount: number) => ({ ...trade(quantity, amount), date: new Date(`${day}T00:00:00Z`) });

  test("a custom range that ended before today measures the gain up to its last day, from the quantity held and the price then", () => {
    // 10 shares now; 5 were bought on 10 March for 500 and 2 more on 15 April (after the range): 8 at the end of March, 3 at the start.
    const { holdings, since, until } = customOver({ end: 100, trades: [dated("2026-03-10", 5, 500), dated("2026-04-15", 2, 400)] });

    // 8 * 100 = 800 at the end; it started with 3 * 90 = 270 and put in 500, so it made 30.
    expect(holdings[0]).toMatchObject({ value: 2000, gain: 30 });
    expect(holdings[0]!.gainPercent).toBeCloseTo(30 / 770);
    expect([since, until]).toEqual(["2026-03-01", "2026-03-31"]);
  });

  test("a custom range that ended before today gives no gain for a holding with no price on its last day", () => {
    expect(customOver({ trades: [] }).holdings[0]).toMatchObject({ gain: null, gainPercent: null });
  });
});
