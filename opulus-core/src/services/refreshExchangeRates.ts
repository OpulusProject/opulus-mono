import type { ExchangeRateProvider } from "../gateways/exchangeRateProvider.js";
import { frankfurterGateway } from "../gateways/frankfurterGateway.js";
import {
  exchangeRateRepository,
  type CreateExchangeRateData,
} from "../repositories/exchangeRateRepository.js";
import { addDays, toDay } from "../utils/day.js";
import { logger } from "../utils/logger.js";

/** How far back an empty table is filled: about two years, like Plaid's history. */
export const EXCHANGE_RATE_HISTORY_DAYS = 730;

export interface RefreshExchangeRatesParams {
  /** Where rates come from; Frankfurter unless a caller passes another. */
  provider?: ExchangeRateProvider;
  /** The current moment; only tests pass it. */
  now?: Date;
}

export interface RefreshExchangeRatesResult {
  /** The first day asked for ("YYYY-MM-DD"). */
  from: string;
  /** The last day asked for: today. */
  to: string;
  /** How many days the provider returned rates for. */
  days: number;
  /** How many rows were new (days already stored are skipped). */
  created: number;
}

/**
 * Bring `exchange_rate` up to date. An empty table is filled with about two
 * years of daily rates; after that each run asks only for the days from the
 * latest stored one to today, so a missed run (or a day published after the
 * last run) is caught up. The euro is stored as 1 on every day. Days already
 * stored are left alone, so running it twice is harmless.
 *
 * Throws when the provider fails, so a scheduled run is retried; nothing is
 * stored in that case. Lives in core so the scheduler (and a one-off script)
 * can run it.
 */
export async function refreshExchangeRates(
  params: RefreshExchangeRatesParams = {}
): Promise<RefreshExchangeRatesResult> {
  const provider = params.provider ?? frankfurterGateway;
  const to = toDay(params.now ?? new Date());
  const latest = await exchangeRateRepository.getLatestDate();
  // Start at the latest stored day, not the one after: it costs nothing (it is
  // skipped) and a range starting on a weekend would start there anyway.
  const from = latest ?? addDays(to, -EXCHANGE_RATE_HISTORY_DAYS);

  const daily = await provider.getDailyRates(from, to);

  const rows: CreateExchangeRateData[] = daily.flatMap(({ date, perEur }) =>
    Object.entries({ ...perEur, EUR: 1 }).map(([currency, rate]) => ({
      date: new Date(`${date}T00:00:00Z`),
      currency,
      perEur: rate,
      source: provider.name,
    }))
  );
  const created = await exchangeRateRepository.createMany(rows);

  const result = { from, to, days: daily.length, created };
  logger.info(
    { ...result, source: provider.name, backfill: latest === null },
    "Exchange rates refreshed"
  );
  return result;
}
