import config from "../config/default.js";
import { logger } from "../utils/logger.js";

/** How long fetched rates are reused before asking again. */
const CACHE_MS = 6 * 60 * 60 * 1000;
const TIMEOUT_MS = 3000;

/** Frankfurter publishes the European Central Bank's daily reference rates. */
const RATES_URL = "https://api.frankfurter.dev/v1/latest";

/** Base-currency units for one unit of each currency we have a rate for. */
export type ExchangeRates = Map<string, number>;

/**
 * Gateway to exchange rates, so amounts in different currencies can be
 * compared in one base currency.
 */
class ExchangeRateGateway {
  private cache = new Map<
    string,
    { rates: ExchangeRates; fetchedAt: number }
  >();

  /**
   * The rates for converting `currencies` to `base`: how many units of `base`
   * one unit of each is worth. A currency with no known rate is left out, and
   * so is the base itself (its rate is 1). Never throws: when rates cannot be
   * fetched the last ones are reused, or none are returned.
   */
  async getRates(base: string, currencies: string[]): Promise<ExchangeRates> {
    const wanted = [...new Set(currencies)].filter((code) => code !== base);
    if (wanted.length === 0) return new Map();

    const table =
      config.exchangeRatesSource === "fixed"
        ? this.fixedRates()
        : await this.fetchRates(base);

    return new Map(
      wanted.flatMap((code) => {
        const rate = table.get(code);
        return rate ? [[code, rate] as const] : [];
      })
    );
  }

  private fixedRates(): ExchangeRates {
    try {
      const parsed: Record<string, number> = config.fixedExchangeRates
        ? (JSON.parse(config.fixedExchangeRates) as Record<string, number>)
        : {};
      return new Map(Object.entries(parsed));
    } catch {
      logger.error("FIXED_EXCHANGE_RATES is not valid JSON");
      return new Map();
    }
  }

  private async fetchRates(base: string): Promise<ExchangeRates> {
    const cached = this.cache.get(base);
    if (cached && Date.now() - cached.fetchedAt < CACHE_MS) return cached.rates;

    try {
      const response = await fetch(`${RATES_URL}?base=${base}`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = (await response.json()) as { rates: Record<string, number> };

      // The API gives units of each currency per one unit of the base; we want
      // base units per one unit of the currency.
      const rates: ExchangeRates = new Map(
        Object.entries(body.rates)
          .filter(([, perBase]) => perBase > 0)
          .map(([code, perBase]) => [code, 1 / perBase])
      );
      this.cache.set(base, { rates, fetchedAt: Date.now() });
      return rates;
    } catch (error) {
      logger.warn(
        { base, error: error instanceof Error ? error.message : String(error) },
        "Could not fetch exchange rates"
      );
      return cached?.rates ?? new Map();
    }
  }
}

// Export singleton instance
export const exchangeRateGateway = new ExchangeRateGateway();
