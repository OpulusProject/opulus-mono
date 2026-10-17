import {
  BASE_CURRENCY,
  loadExchangeRateConverter,
  recurringStreamRepository,
  toDay,
  toRecurringDTO,
  type RecurringDirection,
  type RecurringResponse,
} from "@opulus/core";

export interface GetRecurringParams {
  userId: string;
  /** Only money in, or only money out. */
  direction?: RecurringDirection;
  /** Include streams that have stopped (inactive ones are left out by default). */
  includeInactive?: boolean;
  /** The current moment; only tests pass it. */
  now?: Date;
}

/**
 * A user's recurring payments and income, each with what it comes to a month,
 * and what the active ones add up to, in the base currency. Amounts in another
 * currency are converted at today's stored rate.
 */
export async function getRecurring(
  params: GetRecurringParams
): Promise<RecurringResponse["data"]> {
  const rows = await recurringStreamRepository.getAllByUserId(params.userId, {
    direction: params.direction,
    includeInactive: params.includeInactive,
  });

  const today = toDay(params.now ?? new Date());
  const converter = await loadExchangeRateConverter({
    baseCurrency: BASE_CURRENCY,
    currencies: rows.map((row) => row.isoCurrencyCode),
    days: [today],
  });

  return toRecurringDTO(rows, {
    baseCurrency: BASE_CURRENCY,
    rateOn: (currency) => converter.rateOn(currency, today),
  });
}
