import {
  BASE_CURRENCY,
  investmentTransactionRepository,
  loadExchangeRateConverter,
  toActivityItemsDTO,
  holdingsRangeStart,
  toDay,
  type ActivityFilters,
  type HoldingsRange,
  type ActivityResponse,
} from "@opulus/core";

export interface GetActivityParams {
  userId: string;
  filters: Omit<ActivityFilters, "from" | "to">;
  /** The period to look at; all time when omitted. */
  range?: HoldingsRange;
  /** The first and last day ("YYYY-MM-DD") of a `custom` range; the last defaults to today. */
  from?: string;
  to?: string;
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
  const today = toDay(params.now ?? new Date());
  const since = holdingsRangeStart(params.range ?? "all", today, params.from);
  const until = params.range === "custom" ? params.to : undefined;
  const { rows, pagination } =
    await investmentTransactionRepository.getPageByUserId(
      params.userId,
      {
        ...params.filters,
        from: since ? new Date(`${since}T00:00:00Z`) : undefined,
        to: until ? new Date(`${until}T00:00:00Z`) : undefined,
      },
      { page: params.page, limit: params.limit }
    );

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
