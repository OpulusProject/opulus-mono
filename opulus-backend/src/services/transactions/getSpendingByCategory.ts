import {
  BASE_CURRENCY,
  loadExchangeRateConverter,
  toSpendingByCategoryDTO,
  transactionRepository,
  type SpendingByCategoryResponse,
  type TransactionFilters,
} from "@opulus/core";

export interface GetSpendingByCategoryParams {
  userId: string;
  filters: TransactionFilters;
  /** List only this many categories; the rest are added up in `other`. */
  top?: number;
}

/**
 * What a user spent in each category, converted to the base currency so the
 * categories can be ranked and given a share of the total. Each day's spending
 * is converted at that day's rate from `exchange_rate`, which opulus-scheduler
 * keeps up to date; rates are only read when some spending is in another
 * currency.
 */
export async function getSpendingByCategory(
  params: GetSpendingByCategoryParams
): Promise<SpendingByCategoryResponse["data"]> {
  const rows = await transactionRepository.getCategorySpendByUserId(
    params.userId,
    params.filters
  );

  const converter = await loadExchangeRateConverter({
    baseCurrency: BASE_CURRENCY,
    currencies: rows.map((row) => row.currency),
    days: rows.map((row) => row.date),
  });

  return toSpendingByCategoryDTO(rows, {
    baseCurrency: BASE_CURRENCY,
    rateOn: converter.rateOn,
    top: params.top,
  });
}
