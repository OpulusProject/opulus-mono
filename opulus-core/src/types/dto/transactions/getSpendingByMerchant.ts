/**
 * Get Spending By Merchant endpoint DTOs
 */

import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { toAmount } from "../../../utils/money.js";

export const SpendingMerchantDTOSchema = z.object({
  /** null for transactions Plaid did not name a merchant for. */
  merchant: z.string().nullable(),
  /** The category most of this merchant's spending was in; null if uncategorized. */
  category: z.string().nullable(),
  /** What was spent at this merchant, converted to `baseCurrency`. */
  spent: z.number(),
  count: z.number().int(),
  /** `spent` as a fraction (0 to 1) of all spending, both in `baseCurrency`. */
  share: z.number(),
});

export type SpendingMerchantDTO = z.infer<typeof SpendingMerchantDTOSchema>;

/** The merchants left out of the top ones, added up. */
export const SpendingMerchantOtherDTOSchema = z.object({
  /** How many merchants this adds up. */
  merchants: z.number().int(),
  spent: z.number(),
  count: z.number().int(),
  share: z.number(),
});

export type SpendingMerchantOtherDTO = z.infer<
  typeof SpendingMerchantOtherDTOSchema
>;

/**
 * Spending by merchant API response, for the same filters as the transaction
 * list. Amounts in other currencies are converted to `baseCurrency`, each at
 * the rate of the day it was spent, so merchants can be ranked and compared
 * in one list. The shares add up to what the filters select.
 */
export const SpendingByMerchantResponseSchema = z.object({
  data: z.object({
    /** The currency everything is converted to. */
    baseCurrency: z.string(),
    /** Everything spent, converted to `baseCurrency`. */
    spent: z.number(),
    /** Largest first (ties by name, unnamed last). Only the top ones when `top` is given. */
    merchants: z.array(SpendingMerchantDTOSchema),
    /** The rest, when `top` left some out; otherwise null. */
    other: SpendingMerchantOtherDTOSchema.nullable(),
  }),
});

export type SpendingByMerchantResponse = z.infer<
  typeof SpendingByMerchantResponseSchema
>;

/** One merchant, currency, category and day's spending as the repository computes it. */
export interface MerchantSpend {
  currency: string | null;
  merchant: string | null;
  category: string | null;
  /** The day it was spent, "YYYY-MM-DD". */
  date: string;
  spent: Prisma.Decimal;
  count: number;
}

export interface SpendingByMerchantOptions {
  baseCurrency: string;
  /**
   * Base-currency units for one unit of `currency` on `day` (see
   * `loadExchangeRateConverter`).
   */
  rateOn: (currency: string | null, day: string) => number;
  /** List only this many merchants and add the rest up in `other`. */
  top?: number;
}

/** The spending added up, or null for none. */
const sum = (values: Prisma.Decimal[]) =>
  values.reduce<Prisma.Decimal | null>(
    (total, value) => (total ? total.plus(value) : value),
    null
  );

/** Equal spending: named first, by name, unnamed last. */
const byName = (a: string | null, b: string | null) =>
  Number(a === null) - Number(b === null) || (a ?? "").localeCompare(b ?? "");

/**
 * Transform the repository's rows to the public DTO. Each row is converted to
 * the base currency at its day's rate (a row with no currency, or already in
 * the base currency, is taken as is) so merchants can be ranked and given a
 * share of the total. A merchant's category is the one it spent most in.
 */
export function toSpendingByMerchantDTO(
  rows: MerchantSpend[],
  { baseCurrency, rateOn, top }: SpendingByMerchantOptions
): SpendingByMerchantResponse["data"] {
  const positive = rows
    .filter((row) => row.spent.gt(0))
    .map((row) => ({
      ...row,
      converted: row.spent.times(rateOn(row.currency, row.date)),
    }));

  const byMerchant = new Map<string | null, typeof positive>();
  for (const row of positive) {
    byMerchant.set(row.merchant, [
      ...(byMerchant.get(row.merchant) ?? []),
      row,
    ]);
  }

  const merchants = [...byMerchant].map(([merchant, merchantRows]) => {
    const byCategory = new Map<string | null, Prisma.Decimal>();
    for (const row of merchantRows) {
      byCategory.set(
        row.category,
        (byCategory.get(row.category) ?? row.converted.times(0)).plus(
          row.converted
        )
      );
    }
    const [category] = [...byCategory].sort(
      ([categoryA, a], [categoryB, b]) =>
        b.comparedTo(a) || byName(categoryA, categoryB)
    )[0];

    return {
      merchant,
      category,
      spent: sum(merchantRows.map((row) => row.converted))!,
      count: merchantRows.reduce((count, row) => count + row.count, 0),
    };
  });
  merchants.sort(
    (a, b) => b.spent.comparedTo(a.spent) || byName(a.merchant, b.merchant)
  );

  const total = sum(merchants.map((entry) => entry.spent));
  const share = (spent: Prisma.Decimal) =>
    total ? spent.div(total).toNumber() : 0;

  const shown = top === undefined ? merchants : merchants.slice(0, top);
  const rest = top === undefined ? [] : merchants.slice(top);
  const restSpent = sum(rest.map((entry) => entry.spent));

  return {
    baseCurrency,
    spent: total ? toAmount(total) : 0,
    merchants: shown.map((entry) => ({
      merchant: entry.merchant,
      category: entry.category,
      spent: toAmount(entry.spent),
      count: entry.count,
      share: share(entry.spent),
    })),
    other: restSpent
      ? {
          merchants: rest.length,
          spent: toAmount(restSpent),
          count: rest.reduce((count, entry) => count + entry.count, 0),
          share: share(restSpent),
        }
      : null,
  };
}
