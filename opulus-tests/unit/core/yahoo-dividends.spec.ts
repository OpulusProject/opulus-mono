import { expect, test } from "@playwright/test";
import { parseDividendInfo } from "@opulus/core";

/** A quote summary, with the figures Yahoo gives as `{ raw }` (or `{}` when it has none). */
const summary = (detail: Record<string, unknown>) => ({
  quoteSummary: { result: [{ summaryDetail: { currency: "CAD", previousClose: { raw: 50, fmt: "50" }, ...detail } }], error: null },
});
const raw = (value: number) => ({ raw: value, fmt: String(value) });

/**
 * Reading Yahoo's quote summary (opulus-core/src/gateways/yahooGateway.ts):
 * what a share pays in a year.
 *
 * Test cases:
 * - gives a stock's dividend rate and yield, with the currency
 * - works the rate of a fund out from its yield and price, when the rate is empty
 * - gives a rate of 0 for a yield of 0
 * - uses the rate over the yield when it has both
 * - refuses a security with no rate and no yield, whatever its trailing rate says
 * - refuses an unknown symbol, with Yahoo's reason
 * - refuses something that is not a quote summary
 */
test.describe("Yahoo quote summary parsing", () => {
  test("gives a stock's dividend rate and yield, with the currency", () => {
    expect(parseDividendInfo(summary({ dividendRate: raw(4.48), dividendYield: raw(0.0257), yield: {} }))).toEqual({
      annualRate: 4.48,
      yield: 0.0257,
      currency: "CAD",
    });
  });

  test("works the rate of a fund out from its yield and price, when the rate is empty", () => {
    const info = parseDividendInfo(summary({ dividendRate: {}, dividendYield: {}, yield: raw(0.0204), trailingAnnualDividendRate: raw(0) }));
    expect(info.annualRate).toBeCloseTo(1.02, 6);
    expect(info).toMatchObject({ yield: 0.0204, currency: "CAD" });
  });

  test("gives a rate of 0 for a yield of 0", () => {
    expect(parseDividendInfo(summary({ dividendRate: {}, yield: raw(0) }))).toEqual({ annualRate: 0, yield: 0, currency: "CAD" });
  });

  test("uses the rate over the yield when it has both", () => {
    expect(parseDividendInfo(summary({ dividendRate: raw(1.08), yield: raw(0.5) })).annualRate).toBe(1.08);
  });

  test("refuses a security with no rate and no yield, whatever its trailing rate says", () => {
    expect(() => parseDividendInfo(summary({ dividendRate: {}, yield: {}, trailingAnnualDividendRate: raw(0) }))).toThrow(
      "No dividend figure",
    );
  });

  test("refuses an unknown symbol, with Yahoo's reason", () => {
    const unknown = { quoteSummary: { result: null, error: { description: "Quote not found for ticker symbol: NOPE" } } };
    expect(() => parseDividendInfo(unknown)).toThrow("Quote not found for ticker symbol: NOPE");
  });

  test("refuses something that is not a quote summary", () => {
    expect(() => parseDividendInfo({ hello: "world" })).toThrow("Not a Yahoo quote summary response");
  });
});
