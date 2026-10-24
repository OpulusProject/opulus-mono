import {
  BASE_CURRENCY,
  loadExchangeRateConverter,
  toMonthlyTransactionTotalsDTO,
  transactionRepository,
  type TransactionFilters,
  type MonthlyTransactionTotalsResponse,
} from "@opulus/core";

export interface GetMonthlyTransactionTotalsParams {
  userId: string;
  filters: TransactionFilters;
}

/**
 * Each month's spending for a user's filtered transactions, converted to the
 * base currency, each transaction at its day's rate from `exchange_rate`;
 * rates are only read when some of them are in another currency.
 */
export async function getMonthlyTransactionTotals(
  params: GetMonthlyTransactionTotalsParams
): Promise<MonthlyTransactionTotalsResponse["data"]> {
  const totals = await transactionRepository.getMonthlyTotalsByUserId(
    params.userId,
    params.filters
  );

  const converter = await loadExchangeRateConverter({
    baseCurrency: BASE_CURRENCY,
    currencies: totals.byDay.map((row) => row.currency),
    days: totals.byDay.map((row) => row.date.toISOString().slice(0, 10)),
  });

  return toMonthlyTransactionTotalsDTO(totals, {
    baseCurrency: BASE_CURRENCY,
    rateOn: converter.rateOn,
  });
}
