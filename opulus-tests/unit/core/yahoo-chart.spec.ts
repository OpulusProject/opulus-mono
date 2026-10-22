import { expect, test } from "@playwright/test";
import { parseHistory, parseQuote } from "@opulus/core";

/** A Toronto chart: three daily bars at 09:30 ET (UTC-4), the middle one with no close. */
const chart = (overrides: Record<string, unknown> = {}) => ({
  chart: {
    result: [
      {
        meta: {
          currency: "CAD",
          symbol: "VEQT.TO",
          regularMarketPrice: 62.32,
          regularMarketTime: 1792607230,
          gmtoffset: -14400,
          ...overrides,
        },
        timestamp: [1792330200, 1792416600, 1792503000],
        indicators: { quote: [{ close: [61.5, null, 62.1] }] },
      },
    ],
    error: null,
  },
});

/**
 * Reading Yahoo's chart response (opulus-core/src/gateways/yahooGateway.ts):
 * the latest quote, and the daily closes with their trading day.
 *
 * Test cases:
 * - gives the latest price, its currency, when it is from and the trading day it is for
 * - refuses a symbol with no price
 * - refuses an unknown symbol, with Yahoo's reason
 * - refuses something that is not a chart
 * - gives the daily closes oldest first, each on its trading day in the exchange's time zone
 * - leaves out days with no close, and keeps the last bar of a day
 */
test.describe("Yahoo chart parsing", () => {
  test("gives the latest price, its currency, when it is from and the trading day it is for", () => {
    expect(parseQuote(chart())).toEqual({
      symbol: "VEQT.TO",
      price: 62.32,
      currency: "CAD",
      asOf: new Date(1792607230 * 1000),
      // 18:27 UTC is 14:27 in Toronto, the same day.
      day: "2026-10-21",
    });
  });

  test("refuses a symbol with no price", () => {
    expect(() => parseQuote(chart({ regularMarketPrice: undefined }))).toThrow("No price");
  });

  test("refuses an unknown symbol, with Yahoo's reason", () => {
    const unknown = { chart: { result: null, error: { description: "No data found, symbol may be delisted" } } };
    expect(() => parseQuote(unknown)).toThrow("No data found, symbol may be delisted");
  });

  test("refuses something that is not a chart", () => {
    expect(() => parseQuote({ hello: "world" })).toThrow("Not a Yahoo chart response");
  });

  test("gives the daily closes oldest first, each on its trading day in the exchange's time zone", () => {
    const { closes, currency } = parseHistory(chart());

    expect(currency).toBe("CAD");
    // 1792330200 is 13:30 UTC on 2026-10-18; at UTC-4 it is 09:30 on the 18th.
    expect(closes.map((c) => c.date)).toEqual([...closes.map((c) => c.date)].sort());
    expect(closes[0]).toEqual({ date: "2026-10-18", close: 61.5 });
  });

  test("leaves out days with no close, and keeps the last bar of a day", () => {
    const { closes } = parseHistory(chart());
    expect(closes).toHaveLength(2);

    const twice = chart();
    twice.chart.result![0]!.timestamp = [1792330200, 1792333800, 1792503000];
    twice.chart.result![0]!.indicators.quote[0]!.close = [61.5, 61.7, 62.1];
    expect(parseHistory(twice).closes[0]).toEqual({ date: "2026-10-18", close: 61.7 });
  });
});
