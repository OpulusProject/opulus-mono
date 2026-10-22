import { activePriceProvider } from "../gateways/activePriceProvider.js";
import type { PriceProvider } from "../gateways/priceProvider.js";
import { securityPriceRepository } from "../repositories/securityPriceRepository.js";
import { addDays, toDay } from "../utils/day.js";
import { AppError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { resolveSymbol } from "../utils/securitySymbol.js";

/** How much history is kept for a security: about two years of days. */
export const PRICE_HISTORY_DAYS = 730;

export interface SecurityPricesParams {
  /** Where prices come from; the active provider unless a caller passes another. */
  provider?: PriceProvider;
  /** The current moment; only tests pass it. */
  now?: Date;
}

/** Securities with a provider symbol, with it (cash, options and bonds have none). */
async function priceable(options: {
  withoutPrice?: boolean;
  withoutHistory?: boolean;
}) {
  const securities = await securityPriceRepository.getForPricing(options);
  return securities.flatMap((security) => {
    const resolved = resolveSymbol(security);
    return resolved.status === "active"
      ? [{ securityId: security.id, symbol: resolved.symbol }]
      : [];
  });
}

export interface QuoteSecuritiesResult {
  /** Securities asked about. */
  requested: number;
  /** Prices stored. */
  quoted: number;
  /** Securities the provider had no price for. */
  failed: number;
}

/**
 * Quote securities and store each price as today's: one row per security per
 * trading day, replaced by each quote, so the last one of a day is its close.
 * Every security is quoted whether or not anyone holds it (`onlyUnpriced` limits
 * it to those with no stored price). One the provider has no price for is
 * logged and keeps its last good price; it is asked about again next time.
 *
 * Throws when the provider cannot be reached at all, so the run is retried.
 */
export async function quoteSecurities(
  params: SecurityPricesParams & { onlyUnpriced?: boolean } = {}
): Promise<QuoteSecuritiesResult> {
  const provider = params.provider ?? activePriceProvider;

  const securities = await priceable({ withoutPrice: params.onlyUnpriced });
  if (securities.length === 0) return { requested: 0, quoted: 0, failed: 0 };

  const results = await provider.getQuotes(securities.map((s) => s.symbol));
  const bySymbol = new Map(results.map((result) => [result.symbol, result]));

  let quoted = 0;
  let failed = 0;
  for (const { securityId, symbol } of securities) {
    const result = bySymbol.get(symbol);
    if (result && "quote" in result) {
      const { price, currency, asOf, day } = result.quote;
      await securityPriceRepository.recordQuote(provider.name, {
        securityId,
        day,
        price,
        currency,
        asOf,
      });
      quoted += 1;
    } else {
      failed += 1;
      logger.warn(
        {
          security_id: securityId,
          symbol,
          error: result?.error ?? "no result",
        },
        "No price for a security"
      );
    }
  }

  const summary = { requested: securities.length, quoted, failed };
  logger.info({ ...summary, source: provider.name }, "Securities quoted");
  return summary;
}

export interface BackfillSecurityPricesResult {
  /** Securities whose history was fetched. */
  backfilled: number;
  /** Securities the provider has no history for (not asked about again). */
  failed: number;
}

/**
 * Fetch up to two years of daily closes for every security whose history has
 * not been fetched, one request each. A day already stored (today's quote) is
 * left as it is. A security the provider has no history for is logged and
 * recorded as done, so it does not get asked about every run.
 *
 * Throws when the provider cannot be reached, so the run is retried; the
 * securities done before that keep their history.
 */
export async function backfillSecurityPrices(
  params: SecurityPricesParams = {}
): Promise<BackfillSecurityPricesResult> {
  const provider = params.provider ?? activePriceProvider;
  const to = toDay(params.now ?? new Date());
  const from = addDays(to, -PRICE_HISTORY_DAYS);

  const waiting = await priceable({ withoutHistory: true });

  let backfilled = 0;
  let failed = 0;
  for (const { securityId, symbol } of waiting) {
    try {
      const history = await provider.getHistory(symbol, from, to);
      await securityPriceRepository.recordBackfill(provider.name, {
        securityId,
        currency: history.currency,
        closes: history.closes,
      });
      backfilled += 1;
    } catch (error) {
      // The provider being down is the run's failure; a symbol it does not know is that security's.
      if (error instanceof AppError && error.statusCode === 502) throw error;
      await securityPriceRepository.markBackfilled(securityId);
      failed += 1;
      logger.warn(
        {
          security_id: securityId,
          symbol,
          error: error instanceof Error ? error.message : String(error),
        },
        "No price history for a security"
      );
    }
  }

  const summary = { backfilled, failed };
  logger.info(
    { ...summary, source: provider.name },
    "Security price history backfilled"
  );
  return summary;
}

export interface RefreshSecurityPricesResult {
  quotes: QuoteSecuritiesResult;
  history: BackfillSecurityPricesResult;
}

/**
 * Quote every security, then fetch the history of any that has none. This is
 * the scheduled run: the history step is its safety net, catching a security
 * whose history could not be fetched earlier (the provider was down).
 * Lives in core so the scheduler (and a one-off script) can run it.
 */
export async function refreshSecurityPrices(
  params: SecurityPricesParams = {}
): Promise<RefreshSecurityPricesResult> {
  const quotes = await quoteSecurities(params);
  const history = await backfillSecurityPrices(params);
  return { quotes, history };
}

/**
 * Price securities that were just stored: quote those with no price, so their
 * values are right at once, then fetch their history.
 */
export async function priceNewSecurities(
  params: SecurityPricesParams = {}
): Promise<RefreshSecurityPricesResult> {
  const quotes = await quoteSecurities({ ...params, onlyUnpriced: true });
  const history = await backfillSecurityPrices(params);
  return { quotes, history };
}

let running = false;
let again = false;

/**
 * Start pricing the securities a sync just stored, in the background: the sync
 * does not wait for it and cannot fail because of it. Calls made while a run is
 * going become one more run afterwards (a holdings and a transactions sync close
 * together are one burst of work), and a failure is logged, then left to the
 * scheduled run.
 */
export function requestPricingOfNewSecurities(): void {
  if (running) {
    again = true;
    return;
  }
  running = true;
  void (async () => {
    try {
      do {
        again = false;
        await priceNewSecurities();
      } while (again);
    } catch (error) {
      logger.warn(
        {
          error_message: error instanceof Error ? error.message : String(error),
        },
        "Pricing new securities failed; the next scheduled run will retry"
      );
    } finally {
      running = false;
    }
  })();
}
