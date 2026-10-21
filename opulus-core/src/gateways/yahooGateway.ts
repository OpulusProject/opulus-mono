import { z } from "zod";
import config from "../config/default.js";
import { AppError } from "../utils/errors.js";
import type {
  DailyClose,
  PriceHistory,
  PriceProvider,
  PriceQuote,
  PriceQuoteResult,
} from "./priceProvider.js";

const TIMEOUT_MS = 30_000;
/** Quotes are one request per symbol; this many at a time. */
const CONCURRENCY = 5;
const DAY_S = 24 * 60 * 60;

/** The part of Yahoo's chart response we use (`/v8/finance/chart/<symbol>`). */
const ChartSchema = z.object({
  chart: z.object({
    result: z
      .array(
        z.object({
          meta: z.object({
            currency: z.string(),
            symbol: z.string(),
            regularMarketPrice: z.number().optional(),
            regularMarketTime: z.number().optional(),
            gmtoffset: z.number().default(0),
          }),
          timestamp: z.array(z.number()).optional(),
          indicators: z
            .object({
              quote: z
                .array(z.object({ close: z.array(z.number().nullable()) }))
                .optional(),
            })
            .optional(),
        })
      )
      .nullable(),
    error: z.object({ description: z.string().optional() }).nullable(),
  }),
});

type ChartResult = NonNullable<
  z.infer<typeof ChartSchema>["chart"]["result"]
>[number];

/** The chart's only result, or the reason there is none. */
export function parseChart(body: unknown): ChartResult {
  const parsed = ChartSchema.safeParse(body);
  if (!parsed.success) throw new AppError("Not a Yahoo chart response", 502);
  const { result, error } = parsed.data.chart;
  const first = result?.[0];
  if (!first) {
    throw new AppError(error?.description ?? "No data for the symbol", 404);
  }
  return first;
}

/** The latest price in a chart response. */
export function parseQuote(body: unknown): PriceQuote {
  const { meta } = parseChart(body);
  if (!meta.regularMarketPrice || !meta.regularMarketTime) {
    throw new AppError("No price for the symbol", 404);
  }
  return {
    symbol: meta.symbol,
    price: meta.regularMarketPrice,
    currency: meta.currency,
    asOf: new Date(meta.regularMarketTime * 1000),
  };
}

/**
 * The daily closes in a chart response. A bar's day is its timestamp in the
 * exchange's own time zone (the response gives the offset), so a Toronto
 * session is that Toronto date. Days with no close are left out.
 */
export function parseHistory(body: unknown): PriceHistory {
  const { meta, timestamp = [], indicators } = parseChart(body);
  const closes = indicators?.quote?.[0]?.close ?? [];
  const byDay = new Map<string, number>();
  timestamp.forEach((time, index) => {
    const close = closes[index];
    if (close === null || close === undefined || close <= 0) return;
    const day = new Date((time + meta.gmtoffset) * 1000)
      .toISOString()
      .slice(0, 10);
    byDay.set(day, close);
  });
  const days: DailyClose[] = [...byDay]
    .map(([date, close]) => ({ date, close }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return { symbol: meta.symbol, currency: meta.currency, closes: days };
}

/**
 * Gateway to Yahoo Finance's public chart endpoint (no key). It is unofficial:
 * Yahoo's terms limit it to personal, non-commercial use and it can change
 * without notice, so it stands in for a licensed provider (see
 * `PriceProvider`). The base URL comes from YAHOO_FINANCE_BASE_URL, so a stub
 * can be used in tests.
 */
class YahooGateway implements PriceProvider {
  readonly name = "yahoo";

  async getQuotes(symbols: string[]): Promise<PriceQuoteResult[]> {
    const results: PriceQuoteResult[] = new Array<PriceQuoteResult>(
      symbols.length
    );
    let next = 0;
    let unreachable: AppError | undefined;
    const worker = async () => {
      while (next < symbols.length && !unreachable) {
        const index = next++;
        const symbol = symbols[index]!;
        try {
          const body = await this.fetchChart(symbol, "1d", "1d");
          results[index] = { symbol, quote: { ...parseQuote(body), symbol } };
        } catch (error) {
          if (error instanceof AppError && error.statusCode === 502) {
            unreachable ??= error;
          }
          results[index] = {
            symbol,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, symbols.length) }, worker)
    );
    // Every symbol failing to be reached is the provider being down, not a
    // problem with each symbol: let the job retry instead of marking them.
    if (unreachable && results.every((r) => !r || "error" in r)) {
      throw unreachable;
    }
    return results.map(
      (result, index) =>
        result ?? { symbol: symbols[index]!, error: "Not fetched" }
    );
  }

  async getHistory(
    symbol: string,
    from: string,
    to: string
  ): Promise<PriceHistory> {
    const period1 = Math.floor(Date.parse(`${from}T00:00:00Z`) / 1000);
    // period2 is exclusive: include the whole of `to`.
    const period2 = Math.floor(Date.parse(`${to}T00:00:00Z`) / 1000) + DAY_S;
    const body = await this.fetchChart(symbol, "1d", undefined, {
      period1,
      period2,
    });
    const history = parseHistory(body);
    return {
      ...history,
      symbol,
      closes: history.closes.filter(
        (close) => close.date >= from && close.date <= to
      ),
    };
  }

  /** One chart, as Yahoo's JSON; 502 when it cannot be reached or answers 5xx. */
  private async fetchChart(
    symbol: string,
    interval: string,
    range?: string,
    period?: { period1: number; period2: number }
  ): Promise<unknown> {
    const query = new URLSearchParams({ interval });
    if (range) query.set("range", range);
    if (period) {
      query.set("period1", String(period.period1));
      query.set("period2", String(period.period2));
    }
    const url = `${config.yahooFinanceBaseUrl.replace(/\/+$/, "")}/v8/finance/chart/${encodeURIComponent(symbol)}?${query}`;

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { "user-agent": "Mozilla/5.0 (compatible; Opulus)" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      throw new AppError(
        `Could not reach Yahoo Finance: ${error instanceof Error ? error.message : String(error)}`,
        502
      );
    }
    // An unknown symbol is a 404 with a JSON body that says so; anything else
    // that is not a success is the provider failing.
    if (response.status >= 500 || response.status === 429) {
      throw new AppError(`Yahoo Finance answered ${response.status}`, 502);
    }
    try {
      return await response.json();
    } catch {
      throw new AppError(`Yahoo Finance answered ${response.status}`, 502);
    }
  }
}

// Export singleton instance
export const yahooGateway = new YahooGateway();
