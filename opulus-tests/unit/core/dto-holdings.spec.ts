import { expect, test } from "@playwright/test";
import { Prisma, toHoldingsDTO } from "@opulus/core";

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
}): Rows[number] =>
  ({
    id: overrides.id ?? `h${++nextId}`,
    accountId: "acct-1",
    itemId: "item-1",
    userId: "user-1",
    securityId: "sec-1",
    quantity: D(10),
    institutionPrice: D(overrides.value / 10),
    institutionPriceAsOf: overrides.priceAsOf === undefined ? new Date("2026-10-14T00:00:00Z") : overrides.priceAsOf,
    institutionValue: D(overrides.value),
    costBasis: overrides.basis === null ? null : D(overrides.basis),
    isoCurrencyCode: overrides.currency === undefined ? "USD" : overrides.currency,
    account: { name: "Brokerage" },
    item: { institutionName: "Stub Brokerage" },
    security: { id: "sec-1", name: "Apple Inc.", tickerSymbol: overrides.ticker ?? "AAPL", type: "equity", isCashEquivalent: false },
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
 */
test.describe("holdings DTO", () => {
  test("a holding's gain is its value minus its cost basis, with the gain as a fraction of the basis", () => {
    const { holdings } = toHoldingsDTO([row({ value: 1500, basis: 1000 })], { baseCurrency: "USD", rateOn: toBase({}) });

    expect(holdings[0]).toMatchObject({ value: 1500, costBasis: 1000, gain: 500, gainPercent: 0.5, valueInBase: 1500, priceAsOf: "2026-10-14T00:00:00.000Z" });
  });

  test("a holding with no cost basis has no gain, and is counted as without one in the summary", () => {
    const { holdings, summary } = toHoldingsDTO([row({ value: 250, basis: null })], { baseCurrency: "USD", rateOn: toBase({}) });

    expect(holdings[0]).toMatchObject({ costBasis: null, gain: null, gainPercent: null });
    expect(summary).toEqual({ value: 250, costBasis: 0, gain: 0, gainPercent: null, holdingsWithoutCostBasis: 1 });
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
      summary: { value: 0, costBasis: 0, gain: 0, gainPercent: null, holdingsWithoutCostBasis: 0 },
      holdings: [],
    });
  });

  test("a holding with no price date has a null priceAsOf", () => {
    const { holdings } = toHoldingsDTO([row({ value: 100, basis: 50, priceAsOf: null })], { baseCurrency: "USD", rateOn: toBase({}) });

    expect(holdings[0]!.priceAsOf).toBeNull();
  });
});
