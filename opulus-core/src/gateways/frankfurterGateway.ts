import { z } from "zod";
import config from "../config/default.js";
import { AppError } from "../utils/errors.js";
import type {
  DailyExchangeRates,
  ExchangeRateProvider,
} from "./exchangeRateProvider.js";

/** A long backfill is one request of a few hundred kilobytes. */
const TIMEOUT_MS = 30_000;

/** The part of Frankfurter's time series response we use. */
const TimeSeriesSchema = z.object({
  base: z.literal("EUR"),
  rates: z.record(
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    z.record(z.string(), z.number().positive())
  ),
});

/**
 * Gateway to Frankfurter, which serves the European Central Bank's daily
 * reference rates (no key needed). The base URL comes from
 * FRANKFURTER_BASE_URL, so another deployment of it (or a stub in tests) can
 * be used instead of the public API.
 */
class FrankfurterGateway implements ExchangeRateProvider {
  readonly name = "frankfurter";

  /**
   * Daily rates against the euro over a range, from Frankfurter's time series
   * endpoint (`GET /<from>..<to>?base=EUR`). A range that starts on a day with
   * no rates starts at the last day before it that has them, as Frankfurter
   * does.
   * @throws AppError when Frankfurter cannot be reached or answers badly
   */
  async getDailyRates(from: string, to: string): Promise<DailyExchangeRates[]> {
    const url = `${config.frankfurterBaseUrl.replace(/\/+$/, "")}/${from}..${to}?base=EUR`;

    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (error) {
      throw new AppError(
        `Could not reach Frankfurter: ${error instanceof Error ? error.message : String(error)}`,
        502
      );
    }
    if (!response.ok) {
      throw new AppError(`Frankfurter answered ${response.status}`, 502);
    }

    const parsed = TimeSeriesSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new AppError("Frankfurter's response was not a time series", 502);
    }

    return Object.entries(parsed.data.rates)
      .map(([date, perEur]) => ({ date, perEur }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}

// Export singleton instance
export const frankfurterGateway = new FrankfurterGateway();
