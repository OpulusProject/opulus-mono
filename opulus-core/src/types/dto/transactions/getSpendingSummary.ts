/**
 * Get Spending Summary endpoint DTOs
 */

import { Prisma } from "@prisma/client";
import { z } from "zod";
import { toDay } from "../../../utils/day.js";
import { toAmount } from "../../../utils/money.js";
import type {
  DailyTransactionTotals,
  DailyTransactionTotalsOptions,
} from "./getDailyTransactionTotals.js";

/**
 * One month's spending against the month before, in the base currency. Every
 * figure is computed here so a client only displays it.
 */
export const SpendingSummaryDTOSchema = z.object({
  baseCurrency: z.string(),
  /** The month summarised, YYYY-MM. */
  month: z.string().regex(/^\d{4}-\d{2}$/),
  /** Days of the month that count: today's day of the month, or all of them for a past month. */
  daysElapsed: z.number().int(),
  daysInMonth: z.number().int(),
  /** Spent from the 1st through `daysElapsed`. */
  spentSoFar: z.number(),
  /** Spent in the previous month over the same number of days. */
  lastMonthSameDays: z.number(),
  /** Percent change of `spentSoFar` from `lastMonthSameDays`; null when that was 0. */
  changePercent: z.number().nullable(),
  /** `spentSoFar` per elapsed day. */
  dailyAverage: z.number(),
  /** `dailyAverage` over every day of the month. */
  projectedMonthEnd: z.number(),
  /** Spent over the whole previous month. */
  lastMonthTotal: z.number(),
});

export type SpendingSummaryDTO = z.infer<typeof SpendingSummaryDTOSchema>;

/** Spending summary API response. */
export const SpendingSummaryResponseSchema = z.object({
  data: SpendingSummaryDTOSchema,
});

export type SpendingSummaryResponse = z.infer<
  typeof SpendingSummaryResponseSchema
>;

export interface SpendingSummaryOptions extends DailyTransactionTotalsOptions {
  /** The month to summarise, YYYY-MM. */
  month: string;
  /** Today, YYYY-MM-DD: how far into the month the figures go. */
  today: string;
}

const daysInMonthOf = (year: number, month: number) =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

/**
 * Turn the daily totals of the month and the one before it into the summary.
 * Days are converted to the base currency like the daily totals (each at its own
 * rate); days outside the two months are ignored. A month that is over counts
 * in full, and one that has not started has no elapsed days.
 */
export function toSpendingSummaryDTO(
  totals: DailyTransactionTotals,
  { baseCurrency, rateOn, month, today }: SpendingSummaryOptions
): SpendingSummaryDTO {
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  const previous = new Date(Date.UTC(year, monthNumber - 2, 1));
  const previousMonth = toDay(previous).slice(0, 7);
  const daysInMonth = daysInMonthOf(year, monthNumber);
  const daysInPrevious = daysInMonthOf(
    previous.getUTCFullYear(),
    previous.getUTCMonth() + 1
  );

  const daysElapsed =
    today.slice(0, 7) === month
      ? Number(today.slice(8, 10))
      : today.slice(0, 7) > month
        ? daysInMonth
        : 0;
  // The previous month may be shorter (March 30 against February).
  const previousElapsed = Math.min(daysElapsed, daysInPrevious);

  let spentSoFar = new Prisma.Decimal(0);
  let lastMonthSameDays = new Prisma.Decimal(0);
  let lastMonthTotal = new Prisma.Decimal(0);
  for (const row of totals.byDay) {
    const day = toDay(row.date);
    const dayOfMonth = Number(day.slice(8, 10));
    const inMonth = day.slice(0, 7);
    if (inMonth !== month && inMonth !== previousMonth) continue;
    const spent = row.spent.times(rateOn(row.currency, day));
    if (inMonth === month) {
      if (dayOfMonth <= daysElapsed) spentSoFar = spentSoFar.plus(spent);
    } else {
      lastMonthTotal = lastMonthTotal.plus(spent);
      if (dayOfMonth <= previousElapsed) {
        lastMonthSameDays = lastMonthSameDays.plus(spent);
      }
    }
  }

  const dailyAverage =
    daysElapsed > 0 ? spentSoFar.div(daysElapsed) : new Prisma.Decimal(0);

  return {
    baseCurrency,
    month,
    daysElapsed,
    daysInMonth,
    spentSoFar: toAmount(spentSoFar),
    lastMonthSameDays: toAmount(lastMonthSameDays),
    changePercent: lastMonthSameDays.isZero()
      ? null
      : spentSoFar
          .minus(lastMonthSameDays)
          .div(lastMonthSameDays)
          .times(100)
          .toDecimalPlaces(1)
          .toNumber(),
    dailyAverage: toAmount(dailyAverage),
    projectedMonthEnd: toAmount(dailyAverage.times(daysInMonth)),
    lastMonthTotal: toAmount(lastMonthTotal),
  };
}
