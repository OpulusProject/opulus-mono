import {
  BASE_CURRENCY,
  loadExchangeRateConverter,
  toTransactionsSummaryDTO,
  transactionRepository,
  type TransactionFilters,
  type TransactionsSummaryResponse,
} from "@opulus/core";

export interface GetTransactionsSummaryParams {
  userId: string;
  filters: TransactionFilters;
}

/**
 * Each day's spending, income and net for a user's filtered transactions,
 * converted to the base currency, each at that day's rate from `exchange_rate`;
 * rates are only read when some of them are in another currency.
 */
export async function getTransactionsSummary(
  params: GetTransactionsSummaryParams
): Promise<TransactionsSummaryResponse["data"]> {
  const summary = await transactionRepository.getSummaryByUserId(
    params.userId,
    params.filters
  );

  const converter = await loadExchangeRateConverter({
    baseCurrency: BASE_CURRENCY,
    currencies: summary.byDay.map((row) => row.currency),
    days: summary.byDay.map((row) => row.date.toISOString().slice(0, 10)),
  });

  return toTransactionsSummaryDTO(summary, {
    baseCurrency: BASE_CURRENCY,
    rateOn: converter.rateOn,
  });
}
