import {
  BASE_CURRENCY,
  SPENDING_HABIT_RULE,
  loadExchangeRateConverter,
  toSpendingHabitsDTO,
  transactionRepository,
  type SpendingHabitsResponse,
  type TransactionFilters,
} from "@opulus/core";

export interface GetSpendingHabitsParams {
  userId: string;
  /** Which transactions to include; their dates are replaced by the month's windows. */
  filters: TransactionFilters;
  /** The day the month is measured up to, "YYYY-MM-DD" (UTC). */
  asOf: string;
}

const utcDay = (year: number, month: number, day: number) =>
  new Date(Date.UTC(year, month, day));

/**
 * How this month's spending so far compares with the usual, per category: the
 * average of the same days (day 1 to the same day of the month, or the month's
 * last day when it is shorter) in each of the months before. Everything is
 * converted to the base currency at each day's rate.
 */
export async function getSpendingHabits(
  params: GetSpendingHabitsParams
): Promise<SpendingHabitsResponse["data"]> {
  const [year, month, day] = params.asOf.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  // `month` is 1-based here; Date.UTC wants 0-based.
  const monthIndex = month - 1;

  const windows = Array.from({ length: SPENDING_HABIT_RULE.months }, (_, i) => {
    const target = monthIndex - (i + 1);
    const daysInMonth = utcDay(year, target + 1, 0).getUTCDate();
    return {
      startDate: utcDay(year, target, 1),
      endDate: utcDay(year, target, Math.min(day, daysInMonth)),
    };
  });

  const [current, previous] = await Promise.all([
    transactionRepository.getSpendTransactionsByUserId(params.userId, {
      ...params.filters,
      startDate: utcDay(year, monthIndex, 1),
      endDate: utcDay(year, monthIndex, day),
    }),
    Promise.all(
      windows.map((window) =>
        transactionRepository.getCategorySpendByUserId(params.userId, {
          ...params.filters,
          ...window,
        })
      )
    ),
  ]);

  const rows = [...current, ...previous.flat()];
  const converter = await loadExchangeRateConverter({
    baseCurrency: BASE_CURRENCY,
    currencies: rows.map((row) => row.currency),
    days: rows.map((row) => row.date),
  });

  return toSpendingHabitsDTO(
    { current, previous },
    { baseCurrency: BASE_CURRENCY, rateOn: converter.rateOn }
  );
}
