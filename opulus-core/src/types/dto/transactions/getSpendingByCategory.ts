/**
 * Get Spending By Category endpoint DTOs
 */

import type { Prisma } from "@prisma/client";
import { z } from "zod";

/** Money spent in one currency (null when the institution did not say). */
export const SpendingAmountDTOSchema = z.object({
  currency: z.string().nullable(),
  spent: z.number(),
});

export type SpendingAmountDTO = z.infer<typeof SpendingAmountDTOSchema>;

export const SpendingCategoryDTOSchema = z.object({
  /** null for transactions Plaid did not categorize. */
  category: z.string().nullable(),
  /** What was spent in this category, converted to `baseCurrency`. */
  spent: z.number(),
  count: z.number().int(),
  /** `spent` as a fraction (0 to 1) of all spending, both in `baseCurrency`. */
  share: z.number(),
  /** The same spending as it was paid, one entry per currency, largest first (ties by code, no currency last). */
  amounts: z.array(SpendingAmountDTOSchema),
});

export type SpendingCategoryDTO = z.infer<typeof SpendingCategoryDTOSchema>;

/** The categories left out of the top ones, added up. */
export const SpendingOtherDTOSchema = z.object({
  /** How many categories this adds up. */
  categories: z.number().int(),
  spent: z.number(),
  count: z.number().int(),
  share: z.number(),
  amounts: z.array(SpendingAmountDTOSchema),
});

export type SpendingOtherDTO = z.infer<typeof SpendingOtherDTOSchema>;

/**
 * Spending by category API response, for the same filters as the transaction
 * list. Amounts in other currencies are converted to `baseCurrency`, each at
 * the rate of the day it was spent, so categories can be ranked and compared
 * in one list. Unlike the summary's
 * `byCategory`, the `category` filter applies, so the shares add up to what the
 * filters select.
 */
export const SpendingByCategoryResponseSchema = z.object({
  data: z.object({
    /** The currency everything is converted to. */
    baseCurrency: z.string(),
    /** Everything spent, converted to `baseCurrency`. */
    spent: z.number(),
    /** Largest first (ties by name, uncategorized last). Only the top ones when `top` is given. */
    categories: z.array(SpendingCategoryDTOSchema),
    /** The rest, when `top` left some out; otherwise null. */
    other: SpendingOtherDTOSchema.nullable(),
    /**
     * Spending in currencies with no known rate. It is left out of everything
     * above, so shares are of the spending that could be converted.
     */
    unconverted: z.array(SpendingAmountDTOSchema),
  }),
});

export type SpendingByCategoryResponse = z.infer<
  typeof SpendingByCategoryResponseSchema
>;

/** One currency and category's spending as the repository computes it. */
export interface CategorySpend {
  currency: string | null;
  category: string | null;
  /** The day it was spent, "YYYY-MM-DD". */
  date: string;
  spent: Prisma.Decimal;
  count: number;
}

export interface SpendingByCategoryOptions {
  baseCurrency: string;
  /**
   * Base-currency units for one unit of `currency` on `day`, or undefined when
   * there is no rate (see `loadExchangeRateConverter`).
   */
  rateOn: (currency: string, day: string) => number | undefined;
  /** List only this many categories and add the rest up in `other`. */
  top?: number;
}

/** A converted amount, to Plaid's 4 decimal places (a rate is a quotient, so the product can run on). */
const money = (amount: Prisma.Decimal) => amount.toDecimalPlaces(4).toNumber();

/** The spending added up, or null for none. */
const sum = (values: Prisma.Decimal[]) =>
  values.reduce<Prisma.Decimal | null>(
    (total, value) => (total ? total.plus(value) : value),
    null
  );

/** Spending per currency, added up across the rows and largest first. */
function toAmounts(rows: CategorySpend[]): SpendingAmountDTO[] {
  const byCurrency = new Map<string | null, Prisma.Decimal>();
  for (const row of rows) {
    const total = byCurrency.get(row.currency);
    byCurrency.set(row.currency, total ? total.plus(row.spent) : row.spent);
  }
  return [...byCurrency]
    .map(([currency, spent]) => ({ currency, spent: spent.toNumber() }))
    .sort(
      (a, b) =>
        b.spent - a.spent ||
        // Equal amounts: by currency code, no currency last.
        Number(a.currency === null) - Number(b.currency === null) ||
        (a.currency ?? "").localeCompare(b.currency ?? "")
    );
}

/**
 * Transform the repository's rows to the public DTO. Each row (one currency,
 * category and day) is converted to the base currency at that day's rate (a
 * row with no currency, or already in the base currency, is taken as is) so
 * categories can be ranked and given a share of the total. Rows in a currency
 * with no rate are reported in `unconverted` instead. A category's `amounts`
 * keep what was actually spent, per currency.
 */
export function toSpendingByCategoryDTO(
  rows: CategorySpend[],
  { baseCurrency, rateOn, top }: SpendingByCategoryOptions
): SpendingByCategoryResponse["data"] {
  const rateOf = (row: CategorySpend) =>
    row.currency === null || row.currency === baseCurrency
      ? 1
      : rateOn(row.currency, row.date);

  const positive = rows.filter((row) => row.spent.gt(0));
  const convertible = positive.filter((row) => rateOf(row));
  const converted = (row: CategorySpend) => row.spent.times(rateOf(row)!);

  const byCategory = new Map<string | null, CategorySpend[]>();
  for (const row of convertible) {
    byCategory.set(row.category, [
      ...(byCategory.get(row.category) ?? []),
      row,
    ]);
  }

  const categories = [...byCategory].map(([category, categoryRows]) => ({
    category,
    rows: categoryRows,
    spent: sum(categoryRows.map(converted))!,
    count: categoryRows.reduce((count, row) => count + row.count, 0),
  }));
  categories.sort(
    (a, b) =>
      b.spent.comparedTo(a.spent) ||
      // Equal spending: named categories by name, uncategorized last.
      Number(a.category === null) - Number(b.category === null) ||
      (a.category ?? "").localeCompare(b.category ?? "")
  );

  const total = sum(categories.map((entry) => entry.spent));
  const share = (spent: Prisma.Decimal) =>
    total ? spent.div(total).toNumber() : 0;

  const shown = top === undefined ? categories : categories.slice(0, top);
  const rest = top === undefined ? [] : categories.slice(top);
  const restSpent = sum(rest.map((entry) => entry.spent));

  return {
    baseCurrency,
    spent: total ? money(total) : 0,
    categories: shown.map((entry) => ({
      category: entry.category,
      spent: money(entry.spent),
      count: entry.count,
      share: share(entry.spent),
      amounts: toAmounts(entry.rows),
    })),
    other: restSpent
      ? {
          categories: rest.length,
          spent: money(restSpent),
          count: rest.reduce((count, entry) => count + entry.count, 0),
          share: share(restSpent),
          amounts: toAmounts(rest.flatMap((entry) => entry.rows)),
        }
      : null,
    unconverted: toAmounts(positive.filter((row) => !rateOf(row))),
  };
}
