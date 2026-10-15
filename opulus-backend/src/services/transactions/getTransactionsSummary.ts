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

  const foreign = summary.byDay.filter(
    (row) => row.currency !== null && row.currency !== BASE_CURRENCY
  );
  const days = foreign.map((row) => row.date.toISOString().slice(0, 10)).sort();
  const converter =
    foreign.length > 0
      ? await loadExchangeRateConverter({
          baseCurrency: BASE_CURRENCY,
          currencies: foreign.map((row) => row.currency!),
          from: days[0]!,
          to: days.at(-1)!,
        })
      : undefined;

  return toTransactionsSummaryDTO(summary, {
    baseCurrency: BASE_CURRENCY,
    rateOn: (currency, day) => converter!.rateOn(currency, day),
  });
}
