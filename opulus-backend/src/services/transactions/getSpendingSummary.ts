import {
  BASE_CURRENCY,
  loadExchangeRateConverter,
  toDay,
  toSpendingSummaryDTO,
  transactionRepository,
  type SpendingSummaryResponse,
  type TransactionFilters,
} from "@opulus/core";

export interface GetSpendingSummaryParams {
  userId: string;
  /** The month to summarise, YYYY-MM. */
  month: string;
  /** Today, YYYY-MM-DD. */
  today: string;
  /** Any filter except the dates, which are the two months. */
  filters: TransactionFilters;
}

/**
 * A month's spending against the month before it: spent so far, the same days
 * last month, the change, the daily average and the projected month end. Reads
 * the daily totals from the start of the previous month through the end of the
 * month, converted to the base currency like the daily totals.
 */
export async function getSpendingSummary(
  params: GetSpendingSummaryParams
): Promise<SpendingSummaryResponse["data"]> {
  const [year, month] = params.month.split("-").map(Number);
  const startDate = new Date(Date.UTC(year, month - 2, 1));
  const endDate = new Date(Date.UTC(year, month, 0));

  const totals = await transactionRepository.getDailyTotalsByUserId(
    params.userId,
    { ...params.filters, startDate, endDate }
  );

  const converter = await loadExchangeRateConverter({
    baseCurrency: BASE_CURRENCY,
    currencies: totals.byDay.map((row) => row.currency),
    days: totals.byDay.map((row) => toDay(row.date)),
  });

  return toSpendingSummaryDTO(totals, {
    baseCurrency: BASE_CURRENCY,
    rateOn: converter.rateOn,
    month: params.month,
    today: params.today,
  });
}
