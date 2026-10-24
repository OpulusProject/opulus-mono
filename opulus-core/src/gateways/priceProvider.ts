/** A security's latest price, as a provider quotes it. */
export interface PriceQuote {
  /** The provider's symbol it was asked for. */
  symbol: string;
  price: number;
  /** ISO 4217 code the price is in. */
  currency: string;
  /** When the provider says the price is from (the last trade). */
  asOf: Date;
  /** The trading day it is for ("YYYY-MM-DD"), in the exchange's own time zone. */
  day: string;
}

/** One quote asked for: the price, or why there is none. */
export type PriceQuoteResult =
  | { symbol: string; quote: PriceQuote }
  | { symbol: string; error: string };

/** A security's close on one trading day. */
export interface DailyClose {
  /** "YYYY-MM-DD", the trading day in the exchange's own time zone. */
  date: string;
  close: number;
}

/** Closing prices over a range, with the currency they are in. */
export interface PriceHistory {
  symbol: string;
  currency: string;
  /** Oldest first, one per trading day. */
  closes: DailyClose[];
}

/** What a security pays out, as a provider says. */
export interface DividendInfo {
  /** What one share pays in a year, in `currency`; 0 when it pays nothing. */
  annualRate: number;
  /** `annualRate` as a fraction of the price (0.025 is 2.5%), when the provider gives one. */
  yield: number | null;
  /** ISO 4217 code `annualRate` is in. */
  currency: string;
}

/** One dividend lookup: what the provider says, or why it says nothing. */
export type DividendInfoResult =
  | { symbol: string; info: DividendInfo }
  | { symbol: string; error: string };

/**
 * A source of security prices. Yahoo Finance is the one we use first; the
 * interface keeps the jobs independent of it, so a licensed provider can take
 * its place by implementing it.
 */
export interface PriceProvider {
  /** Stored as `security_symbol.provider` and `security_price.source`. */
  readonly name: string;
  /**
   * The latest price of each symbol. One symbol failing (unknown, delisted, no
   * trades) is its result's `error`, not a throw, so the others are still
   * priced. Throws only when the provider cannot be reached at all.
   */
  getQuotes(symbols: string[]): Promise<PriceQuoteResult[]>;
  /**
   * Daily closes from `from` to `to` ("YYYY-MM-DD", both included), oldest
   * first. Throws when the symbol is unknown or the provider fails.
   */
  getHistory(symbol: string, from: string, to: string): Promise<PriceHistory>;
  /**
   * What each symbol pays out per share in a year. One symbol failing (unknown,
   * or the provider has no dividend figure for it) is its result's `error`, not
   * a throw. Throws only when the provider cannot be reached at all.
   */
  getDividendInfo(symbols: string[]): Promise<DividendInfoResult[]>;
}
