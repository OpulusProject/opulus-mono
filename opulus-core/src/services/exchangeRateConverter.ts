import { AppError } from "../utils/errors.js";
import {
  exchangeRateRepository,
  type StoredExchangeRate,
} from "../repositories/exchangeRateRepository.js";

export interface ExchangeRateConverter {
  /**
   * Units of the base currency for one unit of `currency` on `day`
   * ("YYYY-MM-DD"). The base currency is always 1.
   * @throws AppError if no rate is stored for `currency`: every currency we
   * support has one, so that means the table is incomplete
   */
  rateOn(currency: string, day: string): number;
}

export interface LoadExchangeRateConverterParams {
  baseCurrency: string;
  /** The currencies that will be converted (the base is added). */
  currencies: string[];
  /** The days amounts will be converted on, "YYYY-MM-DD", both included. */
  from: string;
  to: string;
}

/**
 * Read what is needed from `exchange_rate` to convert amounts in some
 * currencies to a base currency, day by day. A day uses the latest rate stored
 * on or before it (a weekend uses the Friday before); a day older than the
 * stored history uses the earliest rate. Rates are stored per euro, so the
 * rate of X in the base is perEur(base) / perEur(X) on that day.
 *
 * Two queries, whatever the number of days.
 */
export async function loadExchangeRateConverter(
  params: LoadExchangeRateConverterParams
): Promise<ExchangeRateConverter> {
  const { baseCurrency } = params;
  const currencies = [...new Set([baseCurrency, ...params.currencies])].filter(
    Boolean
  );

  const [inRange, earliest] = await Promise.all([
    exchangeRateRepository.getForCurrencies({
      currencies,
      from: params.from,
      to: params.to,
    }),
    exchangeRateRepository.getEarliestForCurrencies(currencies),
  ]);

  // Each currency's rates, oldest first.
  const byCurrency = new Map<string, StoredExchangeRate[]>();
  for (const row of inRange) {
    byCurrency.set(row.currency, [
      ...(byCurrency.get(row.currency) ?? []),
      row,
    ]);
  }
  const earliestOf = new Map(earliest.map((row) => [row.currency, row]));

  /** The euro rate in effect on `day`: the latest on or before it, else the earliest. */
  const perEurOn = (
    currency: string,
    day: string
  ): StoredExchangeRate["perEur"] | undefined => {
    const rows = byCurrency.get(currency) ?? [];
    let found: StoredExchangeRate | undefined;
    let low = 0;
    let high = rows.length - 1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (rows[mid]!.date <= day) {
        found = rows[mid];
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return (found ?? earliestOf.get(currency))?.perEur;
  };

  return {
    rateOn(currency, day) {
      if (currency === baseCurrency) return 1;
      const base = perEurOn(baseCurrency, day);
      const other = perEurOn(currency, day);
      if (!base || !other) {
        throw new AppError(`No exchange rate stored for ${currency}`, 500);
      }
      return base.div(other).toNumber();
    },
  };
}
