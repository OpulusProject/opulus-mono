/**
 * Get Spending Habits endpoint DTOs
 */

import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { fromUnits, toUnits } from "../../../utils/money.js";
import type { CategorySpend } from "./getSpendingByCategory.js";

/**
 * The rule that flags a category: this month's spending so far is a habit
 * worth a look when it is at least `MIN_INCREASE_RATIO` and `MIN_INCREASE`
 * (in the base currency) above the usual, the average of the same days
 * (day 1 up to the same day of the month) in each of the `HABIT_MONTHS`
 * months before it. Both bounds must be met, so a small category does not
 * flag on a few dollars and a large one does not flag on a few percent.
 */
export const SPENDING_HABIT_RULE = {
  /** How many months before this one make up the usual. */
  months: 3,
  /** The increase over the usual, as a fraction of it (0.2 = 20%). */
  minIncreaseRatio: 0.2,
  /** The increase over the usual, in the base currency. */
  minIncrease: 50,
} as const;

export const SpendingHabitTagSchema = z.enum(["habit", "one-off"]);

export type SpendingHabitTag = z.infer<typeof SpendingHabitTagSchema>;

export const SpendingHabitTransactionDTOSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** YYYY-MM-DD. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** In `baseCurrency`. */
  spent: z.number(),
});

export type SpendingHabitTransactionDTO = z.infer<
  typeof SpendingHabitTransactionDTOSchema
>;

export const SpendingHabitCategoryDTOSchema = z.object({
  /** null for transactions Plaid did not categorize. */
  category: z.string().nullable(),
  /** Spent so far this month, in `baseCurrency`. */
  spent: z.number(),
  /** The average of the same days in the months before, or null with no history. */
  usual: z.number().nullable(),
  /** `spent` minus `usual`, or null with no history. */
  change: z.number().nullable(),
  /** `change` as a fraction of `usual`, or null when there is no usual or it is 0. */
  changeRatio: z.number().nullable(),
  /** Whether the rule flags this category. */
  flagged: z.boolean(),
  /**
   * For a flagged category: "one-off" when its largest transaction alone
   * accounts for the increase (without it spending is at or below the usual),
   * otherwise "habit". null when not flagged.
   */
  tag: SpendingHabitTagSchema.nullable(),
  /** The largest transaction so far this month, or null with none. */
  largestTransaction: SpendingHabitTransactionDTOSchema.nullable(),
  /** The detailed category with the most spending so far this month, or null with none. */
  topDetailedCategory: z
    .object({ category: z.string(), spent: z.number() })
    .nullable(),
});

export type SpendingHabitCategoryDTO = z.infer<
  typeof SpendingHabitCategoryDTOSchema
>;

/**
 * Spending habits API response: each category's spending so far this month
 * against its usual, in `baseCurrency` (other currencies are converted, each
 * at the rate of the day it was spent).
 */
export const SpendingHabitsResponseSchema = z.object({
  data: z.object({
    baseCurrency: z.string(),
    /** The rule the flags follow. */
    rule: z.object({
      months: z.number().int(),
      minIncreaseRatio: z.number(),
      minIncrease: z.number(),
    }),
    /** How many of the months before had spending to average (0 to `rule.months`). */
    monthsCompared: z.number().int(),
    /** Flagged categories first (biggest increase first), then the rest by spending. */
    categories: z.array(SpendingHabitCategoryDTOSchema),
  }),
});

export type SpendingHabitsResponse = z.infer<
  typeof SpendingHabitsResponseSchema
>;

/** One money-out transaction this month, as the repository returns it. */
export interface HabitTransaction {
  id: string;
  name: string;
  currency: string | null;
  category: string | null;
  categoryDetailed: string | null;
  /** "YYYY-MM-DD". */
  date: string;
  amount: Prisma.Decimal;
}

export interface SpendingHabitsInput {
  /** This month's money-out transactions, from day 1 to today. */
  current: HabitTransaction[];
  /**
   * Each earlier month's spending over the same days, one entry per month
   * (empty for a month with nothing), added up by currency, category and day.
   */
  previous: CategorySpend[][];
}

export interface SpendingHabitsOptions {
  baseCurrency: string;
  /**
   * Base-currency units for one unit of `currency` on `day` (see
   * `loadExchangeRateConverter`).
   */
  rateOn: (currency: string | null, day: string) => number;
}

const { minIncreaseRatio, minIncrease } = SPENDING_HABIT_RULE;

/** Whether spending is far enough above the usual to flag. */
export function isHabitFlagged(spent: number, usual: number): boolean {
  const change = spent - usual;
  return (
    change >= minIncrease && (usual === 0 || change >= usual * minIncreaseRatio)
  );
}

/**
 * Transform this month's transactions and the earlier months' totals to the
 * public DTO. The usual is each category's total over the earlier months that
 * had any spending, divided by how many that is, so a user with one month of
 * history is compared with that month, and one with none is not flagged.
 */
export function toSpendingHabitsDTO(
  input: SpendingHabitsInput,
  { baseCurrency, rateOn }: SpendingHabitsOptions
): SpendingHabitsResponse["data"] {
  const convert = (
    currency: string | null,
    date: string,
    amount: Prisma.Decimal
  ) => amount.times(rateOn(currency, date)).toNumber();

  const monthsWithSpending = input.previous.filter((rows) => rows.length > 0);
  const monthsCompared = monthsWithSpending.length;

  const previousTotals = new Map<string | null, number>();
  for (const row of monthsWithSpending.flat()) {
    previousTotals.set(
      row.category,
      (previousTotals.get(row.category) ?? 0) +
        convert(row.currency, row.date, row.spent)
    );
  }

  const currentByCategory = new Map<string | null, HabitTransaction[]>();
  for (const transaction of input.current) {
    if (!transaction.amount.gt(0)) continue;
    currentByCategory.set(transaction.category, [
      ...(currentByCategory.get(transaction.category) ?? []),
      transaction,
    ]);
  }

  const categoryKeys = new Set([
    ...currentByCategory.keys(),
    ...(monthsCompared > 0 ? previousTotals.keys() : []),
  ]);

  const categories = [...categoryKeys].map((category) => {
    const transactions = currentByCategory.get(category) ?? [];
    const spentOf = (transaction: HabitTransaction) =>
      convert(transaction.currency, transaction.date, transaction.amount);

    const spent = transactions.reduce((sum, t) => sum + spentOf(t), 0);
    const usual =
      monthsCompared > 0
        ? (previousTotals.get(category) ?? 0) / monthsCompared
        : null;
    const change = usual === null ? null : spent - usual;

    const largest = transactions.reduce<{
      transaction: HabitTransaction;
      spent: number;
    } | null>((best, transaction) => {
      const value = spentOf(transaction);
      return !best || value > best.spent ? { transaction, spent: value } : best;
    }, null);

    const byDetailed = new Map<string, number>();
    for (const transaction of transactions) {
      if (!transaction.categoryDetailed) continue;
      byDetailed.set(
        transaction.categoryDetailed,
        (byDetailed.get(transaction.categoryDetailed) ?? 0) +
          spentOf(transaction)
      );
    }
    const topDetailed = [...byDetailed].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
    )[0];

    const flagged = usual !== null && isHabitFlagged(spent, usual);
    const tag: SpendingHabitTag | null = !flagged
      ? null
      : spent - (largest?.spent ?? 0) > usual
        ? "habit"
        : "one-off";

    return {
      category,
      spent,
      usual,
      change,
      changeRatio: usual ? change! / usual : null,
      flagged,
      tag,
      largest,
      topDetailed,
    };
  });

  categories.sort(
    (a, b) =>
      Number(b.flagged) - Number(a.flagged) ||
      (b.flagged ? (b.change ?? 0) - (a.change ?? 0) : 0) ||
      b.spent - a.spent ||
      // Equal: named categories by name, uncategorized last.
      Number(a.category === null) - Number(b.category === null) ||
      (a.category ?? "").localeCompare(b.category ?? "")
  );

  /** Rounded to Plaid's decimals, once, after everything is added up. */
  const round = (value: number | null) =>
    value === null ? null : fromUnits(toUnits(value));

  return {
    baseCurrency,
    rule: { ...SPENDING_HABIT_RULE },
    monthsCompared,
    categories: categories.map((entry) => ({
      category: entry.category,
      spent: round(entry.spent)!,
      usual: round(entry.usual),
      change: round(entry.change),
      changeRatio: round(entry.changeRatio),
      flagged: entry.flagged,
      tag: entry.tag,
      largestTransaction: entry.largest
        ? {
            id: entry.largest.transaction.id,
            name: entry.largest.transaction.name,
            date: entry.largest.transaction.date,
            spent: round(entry.largest.spent)!,
          }
        : null,
      topDetailedCategory: entry.topDetailed
        ? {
            category: entry.topDetailed[0],
            spent: round(entry.topDetailed[1])!,
          }
        : null,
    })),
  };
}
