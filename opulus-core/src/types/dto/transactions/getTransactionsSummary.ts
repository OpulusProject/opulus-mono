/**
 * Get Transactions Summary endpoint DTOs
 */

import type { Prisma } from "@prisma/client";
import { z } from "zod";

/**
 * Money is always per currency: adding CAD to USD is meaningless, so every row
 * says which currency it is in (null when the institution did not say).
 *
 * "Spent" is money out (a positive amount) and "income" is money in (a negative
 * amount), both as positive numbers.
 */
export const TransactionsTotalDTOSchema = z.object({
  currency: z.string().nullable(),
  spent: z.number(),
  income: z.number(),
  /** income minus spent. */
  net: z.number(),
  /** Every transaction in the filtered set, including zero amounts. */
  count: z.number().int(),
});

export type TransactionsTotalDTO = z.infer<typeof TransactionsTotalDTOSchema>;

export const TransactionsCategorySpendDTOSchema = z.object({
  currency: z.string().nullable(),
  /** null for transactions Plaid did not categorize. */
  category: z.string().nullable(),
  spent: z.number(),
  count: z.number().int(),
});

export type TransactionsCategorySpendDTO = z.infer<
  typeof TransactionsCategorySpendDTOSchema
>;

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
 * Transactions summary API response, for the same filters as the list.
 *
 * `byCategory` ignores the `category` filter, so choosing a category narrows
 * `totals` and `byDay` but still shows every category to choose from. `totals`
 * and `byCategory` stay per currency; `byDay` is in `baseCurrency`.
 */
export const TransactionsSummaryResponseSchema = z.object({
  data: z.object({
    /** The currency `byDay` is in: other currencies are converted to it. */
    baseCurrency: z.string(),
    totals: z.array(TransactionsTotalDTOSchema),
    byCategory: z.array(TransactionsCategorySpendDTOSchema),
    byDay: z.array(TransactionsDayDTOSchema),
  }),
});

export type TransactionsSummaryResponse = z.infer<
  typeof TransactionsSummaryResponseSchema
>;

/** The summary as the repository computes it, before it becomes a DTO. */
export interface TransactionsSummary {
  totals: Array<{
    currency: string | null;
    spent: Prisma.Decimal;
    income: Prisma.Decimal;
    count: number;
  }>;
  byCategory: Array<{
    currency: string | null;
    category: string | null;
    spent: Prisma.Decimal;
    count: number;
  }>;
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
   * Base-currency units for one unit of `currency` on `day`, or undefined when
   * there is no rate (see `loadExchangeRateConverter`). Amounts in such a
   * currency are left out of `byDay`.
   */
  rateOn: (currency: string, day: string) => number | undefined;
}

/**
 * Transform the repository's summary to the public DTO. Decimals become numbers,
 * dates become YYYY-MM-DD, and the lists are put in a stable order. `byDay` is
 * converted to the base currency, each day at its own rate (an amount with no
 * currency, or already in the base currency, is taken as is), and amounts in a
 * currency with no rate are left out.
 */
export function toTransactionsSummaryDTO(
  summary: TransactionsSummary,
  { baseCurrency, rateOn }: TransactionsSummaryOptions
): TransactionsSummaryResponse["data"] {
  const byCurrency = (a: { currency: string | null }, b: typeof a) =>
    (a.currency ?? "").localeCompare(b.currency ?? "");

  // One entry per day: each currency's spending and income at that day's rate.
  const days = new Map<
    string,
    { spent: Prisma.Decimal; income: Prisma.Decimal }
  >();
  for (const row of summary.byDay) {
    const day = row.date.toISOString().slice(0, 10);
    const rate =
      row.currency === null || row.currency === baseCurrency
        ? 1
        : rateOn(row.currency, day);
    if (rate === undefined) continue;
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
    totals: summary.totals
      .map((total) => ({
        currency: total.currency,
        spent: total.spent.toNumber(),
        income: total.income.toNumber(),
        net: total.income.minus(total.spent).toNumber(),
        count: total.count,
      }))
      .sort(byCurrency),
    byCategory: summary.byCategory
      .map((row) => ({
        currency: row.currency,
        category: row.category,
        spent: row.spent.toNumber(),
        count: row.count,
      }))
      .sort((a, b) => byCurrency(a, b) || b.spent - a.spent),
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
