import {
  BASE_CURRENCY,
  loadExchangeRateConverter,
  toSpendingByMerchantDTO,
  transactionRepository,
  type SpendingByMerchantResponse,
  type TransactionFilters,
} from "@opulus/core";

export interface GetSpendingByMerchantParams {
  userId: string;
  filters: TransactionFilters;
  /** List only this many merchants; the rest are added up in `other`. */
  top?: number;
}

/**
 * What a user spent at each merchant, converted to the base currency so the
 * merchants can be ranked and given a share of the total. Each day's spending
 * is converted at that day's rate from `exchange_rate`, which opulus-scheduler
 * keeps up to date; rates are only read when some spending is in another
 * currency.
 */
export async function getSpendingByMerchant(
  params: GetSpendingByMerchantParams
): Promise<SpendingByMerchantResponse["data"]> {
  const rows = await transactionRepository.getMerchantSpendByUserId(
    params.userId,
    params.filters
  );

  const converter = await loadExchangeRateConverter({
    baseCurrency: BASE_CURRENCY,
    currencies: rows.map((row) => row.currency),
    days: rows.map((row) => row.date),
  });

  return toSpendingByMerchantDTO(rows, {
    baseCurrency: BASE_CURRENCY,
    rateOn: converter.rateOn,
    top: params.top,
  });
}
