import {
  BASE_CURRENCY,
  loadExchangeRateConverter,
  toDailyTransactionTotalsDTO,
  transactionRepository,
  type TransactionFilters,
  type DailyTransactionTotalsResponse,
} from "@opulus/core";

export interface GetDailyTransactionTotalsParams {
  userId: string;
  filters: TransactionFilters;
}

/**
 * Each day's spending, income and net for a user's filtered transactions,
 * converted to the base currency, each at that day's rate from `exchange_rate`;
 * rates are only read when some of them are in another currency.
 */
export async function getDailyTransactionTotals(
  params: GetDailyTransactionTotalsParams
): Promise<DailyTransactionTotalsResponse["data"]> {
  const totals = await transactionRepository.getDailyTotalsByUserId(
    params.userId,
    params.filters
  );

  const converter = await loadExchangeRateConverter({
    baseCurrency: BASE_CURRENCY,
    currencies: totals.byDay.map((row) => row.currency),
    days: totals.byDay.map((row) => row.date.toISOString().slice(0, 10)),
  });

  return toDailyTransactionTotalsDTO(totals, {
    baseCurrency: BASE_CURRENCY,
    rateOn: converter.rateOn,
  });
}
