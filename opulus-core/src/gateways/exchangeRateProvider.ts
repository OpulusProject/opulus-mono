/** The rates published for one day: units of each currency for one euro. */
export interface DailyExchangeRates {
  /** "YYYY-MM-DD" (UTC). */
  date: string;
  /** Units of each currency for one euro, keyed by ISO 4217 code. */
  perEur: Record<string, number>;
}

/**
 * A source of daily exchange rates. Rates are always against the euro, the way
 * the European Central Bank publishes them and the way `exchange_rate` stores
 * them. Frankfurter is the one we use; the interface keeps the refresh service
 * independent of it.
 */
export interface ExchangeRateProvider {
  /** Stored as `exchange_rate.source`. */
  readonly name: string;
  /**
   * Every day with published rates from `from` to `to` ("YYYY-MM-DD", both
   * included), oldest first. Days without rates (weekends, holidays) are
   * absent. Throws when the provider cannot be reached or answers badly.
   */
  getDailyRates(from: string, to: string): Promise<DailyExchangeRates[]>;
}
