/**
 * Get Spending By Category endpoint DTOs
 */

import type { Prisma } from "@prisma/client";
import { z } from "zod";

export const SpendingCategoryDTOSchema = z.object({
  /** null for transactions Plaid did not categorize. */
  category: z.string().nullable(),
  spent: z.number(),
  count: z.number().int(),
  /** `spent` as a fraction (0 to 1) of everything spent in this currency. */
  share: z.number(),
});

export type SpendingCategoryDTO = z.infer<typeof SpendingCategoryDTOSchema>;

/** The categories left out of the top ones, added up. */
export const SpendingOtherDTOSchema = z.object({
  /** How many categories this adds up. */
  categories: z.number().int(),
  spent: z.number(),
  count: z.number().int(),
  share: z.number(),
});

export type SpendingOtherDTO = z.infer<typeof SpendingOtherDTOSchema>;

/**
 * Money is never added across currencies, so spending comes in one entry per
 * currency (null when the institution did not say).
 */
export const SpendingCurrencyDTOSchema = z.object({
  currency: z.string().nullable(),
  /** Everything spent in this currency. */
  spent: z.number(),
  /** Largest first (ties by name, uncategorized last). Only the top ones when `top` is given. */
  categories: z.array(SpendingCategoryDTOSchema),
  /** The rest, when `top` left some out; otherwise null. */
  other: SpendingOtherDTOSchema.nullable(),
});

export type SpendingCurrencyDTO = z.infer<typeof SpendingCurrencyDTOSchema>;

/**
 * Spending by category API response, for the same filters as the transaction
 * list. Unlike the summary's `byCategory`, the `category` filter applies, so
 * the shares add up to what the filters select.
 */
export const SpendingByCategoryResponseSchema = z.object({
  data: z.object({
    spending: z.array(SpendingCurrencyDTOSchema),
  }),
});

export type SpendingByCategoryResponse = z.infer<
  typeof SpendingByCategoryResponseSchema
>;

/** One currency and category's spending as the repository computes it. */
export interface CategorySpend {
  currency: string | null;
  category: string | null;
  spent: Prisma.Decimal;
  count: number;
}

/** The rows' spending added up, or null for no rows. */
const sum = (rows: CategorySpend[]) =>
  rows.reduce<Prisma.Decimal | null>(
    (total, row) => (total ? total.plus(row.spent) : row.spent),
    null
  );

/**
 * Transform the repository's rows to the public DTO: one entry per currency
 * with its categories largest first and each one's share of the total. With
 * `top`, only that many categories are listed and the rest are added up in
 * `other`.
 */
export function toSpendingByCategoryDTO(
  rows: CategorySpend[],
  top?: number
): SpendingByCategoryResponse["data"] {
  const currencies = [...new Set(rows.map((row) => row.currency))].sort(
    (a, b) => (a ?? "").localeCompare(b ?? "")
  );

  return {
    spending: currencies.flatMap((currency) => {
      const categories = rows
        .filter((row) => row.currency === currency && row.spent.gt(0))
        .sort(
          (a, b) =>
            b.spent.comparedTo(a.spent) ||
            // Equal spending: named categories by name, uncategorized last.
            Number(a.category === null) - Number(b.category === null) ||
            (a.category ?? "").localeCompare(b.category ?? "")
        );
      const total = sum(categories);
      if (!total) return [];

      const shown = top === undefined ? categories : categories.slice(0, top);
      const rest = top === undefined ? [] : categories.slice(top);
      const restSpent = sum(rest);

      return {
        currency,
        spent: total.toNumber(),
        categories: shown.map((row) => ({
          category: row.category,
          spent: row.spent.toNumber(),
          count: row.count,
          share: row.spent.div(total).toNumber(),
        })),
        other: restSpent
          ? {
              categories: rest.length,
              spent: restSpent.toNumber(),
              count: rest.reduce((count, row) => count + row.count, 0),
              share: restSpent.div(total).toNumber(),
            }
          : null,
      };
    }),
  };
}
