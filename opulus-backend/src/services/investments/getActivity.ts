import {
  BASE_CURRENCY,
  investmentTransactionRepository,
  loadExchangeRateConverter,
  toActivityItemsDTO,
  toDay,
  type ActivityFilters,
  type ActivityResponse,
} from "@opulus/core";

export interface GetActivityParams {
  userId: string;
  filters: ActivityFilters;
  page: number;
  limit: number;
  /** The current moment; only tests pass it. */
  now?: Date;
}

/**
 * A page of a user's investment transactions, newest first: what they bought
 * and sold, what was paid out, what they put in and took out, and fees. Amounts
 * are from the account's side (money in is positive) and also given in the base
 * currency at today's rate.
 */
export async function getActivity(
  params: GetActivityParams
): Promise<ActivityResponse["data"]> {
  const { rows, pagination } =
    await investmentTransactionRepository.getPageByUserId(
      params.userId,
      params.filters,
      { page: params.page, limit: params.limit }
    );

  const today = toDay(params.now ?? new Date());
  const converter = await loadExchangeRateConverter({
    baseCurrency: BASE_CURRENCY,
    currencies: rows.map((row) => row.isoCurrencyCode),
    days: [today],
  });

  return {
    baseCurrency: BASE_CURRENCY,
    items: toActivityItemsDTO(rows, (currency) =>
      converter.rateOn(currency, today)
    ),
    pagination,
  };
}
