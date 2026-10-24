import { z } from "zod";
import config from "../config/default.js";
import { AppError } from "../utils/errors.js";
import type {
  DailyClose,
  DividendInfo,
  DividendInfoResult,
  PriceHistory,
  PriceProvider,
  PriceQuote,
  PriceQuoteResult,
} from "./priceProvider.js";

const TIMEOUT_MS = 30_000;
const DAY_S = 24 * 60 * 60;
/** How long a cookie and crumb are reused before asking for new ones. */
const SESSION_MS = 30 * 60 * 1000;

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
    day: new Date((meta.regularMarketTime + meta.gmtoffset) * 1000)
      .toISOString()
      .slice(0, 10),
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

/** A number Yahoo wraps as `{ raw, fmt }`, or leaves as `{}` when it has none. */
const Figure = z
  .union([z.number(), z.object({ raw: z.number().optional() })])
  .optional();

const figure = (value: z.infer<typeof Figure>): number | undefined =>
  typeof value === "number" ? value : value?.raw;

/** The part of Yahoo's quote summary we use (`/v10/finance/quoteSummary/<symbol>?modules=summaryDetail`). */
const QuoteSummarySchema = z.object({
  quoteSummary: z.object({
    result: z
      .array(
        z.object({
          summaryDetail: z
            .object({
              currency: z.string().optional(),
              previousClose: Figure,
              dividendRate: Figure,
              dividendYield: Figure,
              yield: Figure,
              trailingAnnualDividendRate: Figure,
            })
            .optional(),
        })
      )
      .nullable(),
    error: z.object({ description: z.string().optional() }).nullable(),
  }),
});

/**
 * What a quote summary says a share pays in a year. Yahoo's `dividendRate` is
 * the annual amount per share, but it is empty for funds, which have only a
 * `yield` (a fraction of the price): the rate is then that yield times the price.
 * A yield of 0 means it pays nothing. Without either, Yahoo has no figure (its
 * trailing rate reads 0 for funds that do pay, so that says nothing).
 */
export function parseDividendInfo(body: unknown): DividendInfo {
  const parsed = QuoteSummarySchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("Not a Yahoo quote summary response", 502);
  }
  const { result, error } = parsed.data.quoteSummary;
  const detail = result?.[0]?.summaryDetail;
  if (!detail) {
    throw new AppError(error?.description ?? "No data for the symbol", 404);
  }
  if (!detail.currency) throw new AppError("No currency for the symbol", 404);
  const { currency } = detail;
  const rate = figure(detail.dividendRate);
  const fraction = figure(detail.dividendYield) ?? figure(detail.yield);
  const price = figure(detail.previousClose);
  if (rate !== undefined) {
    return { annualRate: rate, yield: fraction ?? null, currency };
  }
  if (fraction === 0) return { annualRate: 0, yield: 0, currency };
  if (fraction !== undefined && price) {
    return { annualRate: fraction * price, yield: fraction, currency };
  }
  const trailing = figure(detail.trailingAnnualDividendRate);
  if (trailing) return { annualRate: trailing, yield: null, currency };
  throw new AppError("No dividend figure for the symbol", 404);
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

  /** The cookie and crumb its quote summary asks for, kept for a while. */
  private session?: { cookie: string; crumb: string; at: number };

  /**
   * One request per symbol, one after another: a request takes tens of
   * milliseconds, so a hundred symbols take seconds, and nothing here guesses
   * at a limit Yahoo does not publish. When Yahoo cannot be reached or throttles
   * (a 502 here), it stops asking, and the symbols not reached come back as
   * errors to be tried next time.
   */
  async getQuotes(symbols: string[]): Promise<PriceQuoteResult[]> {
    const results: PriceQuoteResult[] = [];
    let unreachable: AppError | undefined;
    for (const symbol of symbols) {
      if (unreachable) {
        results.push({ symbol, error: "Not fetched" });
        continue;
      }
      try {
        const body = await this.fetchChart(symbol, "1d", "1d");
        results.push({ symbol, quote: { ...parseQuote(body), symbol } });
      } catch (error) {
        if (error instanceof AppError && error.statusCode === 502) {
          unreachable = error;
        }
        results.push({
          symbol,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    // Yahoo being down, not a problem with each symbol: let the job retry.
    if (unreachable && results.every((result) => "error" in result)) {
      throw unreachable;
    }
    return results;
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

  /**
   * What each symbol pays in a year, from the quote summary. That endpoint wants
   * a cookie and a crumb, fetched once and reused. Like `getQuotes`, one request
   * per symbol; when Yahoo cannot be reached the rest are errors, and the call
   * throws if none was answered.
   */
  async getDividendInfo(symbols: string[]): Promise<DividendInfoResult[]> {
    const results: DividendInfoResult[] = [];
    let unreachable: AppError | undefined;
    for (const symbol of symbols) {
      if (unreachable) {
        results.push({ symbol, error: "Not fetched" });
        continue;
      }
      try {
        const body = await this.fetchSummary(symbol);
        results.push({ symbol, info: parseDividendInfo(body) });
      } catch (error) {
        if (error instanceof AppError && error.statusCode === 502) {
          unreachable = error;
        }
        results.push({
          symbol,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    if (unreachable && results.every((result) => "error" in result)) {
      throw unreachable;
    }
    return results;
  }

  /** The cookie and crumb, fetched again when they are old or `renew` is set. */
  private async getSession(renew: boolean) {
    if (!renew && this.session && Date.now() - this.session.at < SESSION_MS) {
      return this.session;
    }
    const headers = { "user-agent": "Mozilla/5.0 (compatible; Opulus)" };
    try {
      // The cookie is on the response even though the page itself is a 404.
      const home = await fetch(config.yahooCookieUrl, {
        headers,
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const cookie = home.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");
      const crumbResponse = await fetch(
        `${config.yahooFinanceBaseUrl.replace(/\/+$/, "")}/v1/test/getcrumb`,
        {
          headers: { ...headers, cookie },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        }
      );
      const crumb = await crumbResponse.text();
      if (!crumbResponse.ok || !crumb || crumb.includes("<")) {
        throw new Error(`no crumb (status ${crumbResponse.status})`);
      }
      this.session = { cookie, crumb, at: Date.now() };
      return this.session;
    } catch (error) {
      throw new AppError(
        `Could not get a Yahoo Finance session: ${error instanceof Error ? error.message : String(error)}`,
        502
      );
    }
  }

  /** One quote summary, as Yahoo's JSON; the session is renewed once if Yahoo refuses it. */
  private async fetchSummary(symbol: string): Promise<unknown> {
    for (const renew of [false, true]) {
      const { cookie, crumb } = await this.getSession(renew);
      const url = `${config.yahooFinanceBaseUrl.replace(/\/+$/, "")}/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?${new URLSearchParams({ modules: "summaryDetail", crumb })}`;
      let response: Response;
      try {
        response = await fetch(url, {
          headers: { "user-agent": "Mozilla/5.0 (compatible; Opulus)", cookie },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (error) {
        throw new AppError(
          `Could not reach Yahoo Finance: ${error instanceof Error ? error.message : String(error)}`,
          502
        );
      }
      if (response.status === 401 && !renew) continue;
      if (
        response.status >= 500 ||
        response.status === 429 ||
        response.status === 401
      ) {
        throw new AppError(`Yahoo Finance answered ${response.status}`, 502);
      }
      try {
        return await response.json();
      } catch {
        throw new AppError(`Yahoo Finance answered ${response.status}`, 502);
      }
    }
    throw new AppError("Yahoo Finance refused the session", 502);
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
