/**
 * Get Monthly Transaction Totals endpoint DTOs
 */

import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { toAmount } from "../../../utils/money.js";

/**
 * One calendar month, in the base currency: each transaction converted at the
 * rate of its own day, so a month with spending in several currencies is one
 * entry with one figure. Only months with a matching transaction that moved
 * money out appear.
 */
export const TransactionsMonthDTOSchema = z.object({
  /** YYYY-MM. */
  month: z.string().regex(/^\d{4}-\d{2}$/),
  spent: z.number(),
});

export type TransactionsMonthDTO = z.infer<typeof TransactionsMonthDTOSchema>;

/**
 * Monthly transaction totals API response, for the same filters as the list:
 * each month's spending, in `baseCurrency`.
 */
export const MonthlyTransactionTotalsResponseSchema = z.object({
  data: z.object({
    /** The currency `byMonth` is in: other currencies are converted to it. */
    baseCurrency: z.string(),
    byMonth: z.array(TransactionsMonthDTOSchema),
  }),
});

export type MonthlyTransactionTotalsResponse = z.infer<
  typeof MonthlyTransactionTotalsResponseSchema
>;

/**
 * The totals as the repository computes them, before it becomes a DTO: money
 * out per currency and day, so each day can be converted at its own rate.
 */
export interface MonthlyTransactionTotals {
  byDay: Array<{
    currency: string | null;
    date: Date;
    spent: Prisma.Decimal;
  }>;
}

export interface MonthlyTransactionTotalsOptions {
  baseCurrency: string;
  /**
   * Base-currency units for one unit of `currency` on `day` (see
   * `loadExchangeRateConverter`).
   */
  rateOn: (currency: string | null, day: string) => number;
}

/**
 * Transform the repository's totals to the public DTO. Each day is converted
 * to the base currency at its own rate (an amount with no currency, or already
 * in the base currency, is taken as is), then added up by month. Decimals
 * become numbers and months become YYYY-MM, oldest first.
 */
export function toMonthlyTransactionTotalsDTO(
  totals: MonthlyTransactionTotals,
  { baseCurrency, rateOn }: MonthlyTransactionTotalsOptions
): MonthlyTransactionTotalsResponse["data"] {
  const months = new Map<string, Prisma.Decimal>();
  for (const row of totals.byDay) {
    const day = row.date.toISOString().slice(0, 10);
    const spent = row.spent.times(rateOn(row.currency, day));
    const month = day.slice(0, 7);
    const sum = months.get(month);
    months.set(month, sum ? sum.plus(spent) : spent);
  }

  return {
    baseCurrency,
    byMonth: [...months]
      .map(([month, spent]) => ({ month, spent: toAmount(spent) }))
      .sort((a, b) => a.month.localeCompare(b.month)),
  };
}
