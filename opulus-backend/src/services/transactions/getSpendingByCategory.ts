import {
  BASE_CURRENCY,
  exchangeRateGateway,
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
 * categories can be ranked and given a share of the total. Rates are only
 * looked up when some spending is in another currency.
 */
export async function getSpendingByCategory(
  params: GetSpendingByCategoryParams
): Promise<SpendingByCategoryResponse["data"]> {
  const rows = await transactionRepository.getCategorySpendByUserId(
    params.userId,
    params.filters
  );

  const rates = await exchangeRateGateway.getRates(
    BASE_CURRENCY,
    rows.flatMap((row) => (row.currency ? [row.currency] : []))
  );

  return toSpendingByCategoryDTO(rows, {
    baseCurrency: BASE_CURRENCY,
    rates,
    top: params.top,
  });
}
