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

export const TransactionsDaySpendDTOSchema = z.object({
  currency: z.string().nullable(),
  /** YYYY-MM-DD. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  spent: z.number(),
});

export type TransactionsDaySpendDTO = z.infer<
  typeof TransactionsDaySpendDTOSchema
>;

/**
 * Transactions summary API response, for the same filters as the list.
 *
 * `byCategory` ignores the `category` filter, so choosing a category narrows
 * `totals` and `byDay` but still shows every category to choose from.
 */
export const TransactionsSummaryResponseSchema = z.object({
  data: z.object({
    totals: z.array(TransactionsTotalDTOSchema),
    byCategory: z.array(TransactionsCategorySpendDTOSchema),
    byDay: z.array(TransactionsDaySpendDTOSchema),
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
  }>;
}

/**
 * Transform the repository's summary to the public DTO. Decimals become numbers,
 * dates become YYYY-MM-DD, and the lists are put in a stable order.
 */
export function toTransactionsSummaryDTO(
  summary: TransactionsSummary
): TransactionsSummaryResponse["data"] {
  const byCurrency = (a: { currency: string | null }, b: typeof a) =>
    (a.currency ?? "").localeCompare(b.currency ?? "");

  return {
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
    byDay: summary.byDay
      .map((row) => ({
        currency: row.currency,
        date: row.date.toISOString().slice(0, 10),
        spent: row.spent.toNumber(),
      }))
      .sort((a, b) => byCurrency(a, b) || a.date.localeCompare(b.date)),
  };
}
