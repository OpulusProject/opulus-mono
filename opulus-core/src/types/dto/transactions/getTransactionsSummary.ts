/**
 * Get Transactions Summary endpoint DTOs
 */

import type { Prisma } from "@prisma/client";
import { z } from "zod";

/**
 * One day, in the base currency: each transaction converted at the rate of that
 * day, so a day with spending in several currencies is one entry with one
 * figure. Only days with a matching transaction that moved money appear.
 */
export const TransactionsDayDTOSchema = z.object({
  /** YYYY-MM-DD. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  spent: z.number(),
  income: z.number(),
  /** income minus spent. */
  net: z.number(),
});

export type TransactionsDayDTO = z.infer<typeof TransactionsDayDTOSchema>;

/**
 * Transactions summary API response, for the same filters as the list: each
 * day's spending, income and net, in `baseCurrency`.
 */
export const TransactionsSummaryResponseSchema = z.object({
  data: z.object({
    /** The currency `byDay` is in: other currencies are converted to it. */
    baseCurrency: z.string(),
    byDay: z.array(TransactionsDayDTOSchema),
  }),
});

export type TransactionsSummaryResponse = z.infer<
  typeof TransactionsSummaryResponseSchema
>;

/** The summary as the repository computes it, before it becomes a DTO. */
export interface TransactionsSummary {
  byDay: Array<{
    currency: string | null;
    date: Date;
    spent: Prisma.Decimal;
    income: Prisma.Decimal;
  }>;
}

export interface TransactionsSummaryOptions {
  baseCurrency: string;
  /**
   * Base-currency units for one unit of `currency` on `day` (see
   * `loadExchangeRateConverter`).
   */
  rateOn: (currency: string | null, day: string) => number;
}

/**
 * Transform the repository's summary to the public DTO. Decimals become numbers
 * and dates become YYYY-MM-DD, oldest first. The days are converted to the base
 * currency, each day at its own rate (an amount with no currency, or already in
 * the base currency, is taken as is).
 */
export function toTransactionsSummaryDTO(
  summary: TransactionsSummary,
  { baseCurrency, rateOn }: TransactionsSummaryOptions
): TransactionsSummaryResponse["data"] {
  // One entry per day: each currency's spending and income at that day's rate.
  const days = new Map<
    string,
    { spent: Prisma.Decimal; income: Prisma.Decimal }
  >();
  for (const row of summary.byDay) {
    const day = row.date.toISOString().slice(0, 10);
    const rate = rateOn(row.currency, day);
    const entry = days.get(day);
    const spent = row.spent.times(rate);
    const income = row.income.times(rate);
    days.set(day, {
      spent: entry ? entry.spent.plus(spent) : spent,
      income: entry ? entry.income.plus(income) : income,
    });
  }

  return {
    baseCurrency,
    byDay: [...days]
      .map(([date, { spent, income }]) => ({
        date,
        // A rate is a quotient, so the product can run on: Plaid's 4 places.
        spent: spent.toDecimalPlaces(4).toNumber(),
        income: income.toDecimalPlaces(4).toNumber(),
        net: income.minus(spent).toDecimalPlaces(4).toNumber(),
      }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}
