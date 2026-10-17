/**
 * Get Recurring Transactions endpoint DTOs
 */

import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { fromUnits, toUnits } from "../../../utils/money.js";
import { IsoTimestampSchema, toIsoString } from "../common.js";

export const RecurringDirectionSchema = z.enum(["inflow", "outflow"]);

export type RecurringDirection = z.infer<typeof RecurringDirectionSchema>;

/**
 * How many times a year each frequency happens, to compare payments that repeat
 * at different paces as a monthly amount. UNKNOWN has none: such a stream has
 * no monthly amount.
 */
const PAYMENTS_PER_YEAR: Record<string, number> = {
  WEEKLY: 52,
  BIWEEKLY: 26,
  SEMI_MONTHLY: 24,
  MONTHLY: 12,
  ANNUALLY: 1,
};

/**
 * One recurring payment (`outflow`) or income (`inflow`) Plaid found. Amounts
 * are positive whichever way the money goes, in the stream's own `currency`
 * except `monthlyAmountInBase`.
 */
export const RecurringStreamDTOSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  accountName: z.string(),
  institutionName: z.string().nullable(),
  direction: RecurringDirectionSchema,
  description: z.string(),
  merchantName: z.string().nullable(),
  /** WEEKLY, BIWEEKLY, SEMI_MONTHLY, MONTHLY, ANNUALLY or UNKNOWN. */
  frequency: z.string(),
  /** MATURE, EARLY_DETECTION, TOMBSTONED (it stopped) or UNKNOWN. */
  status: z.string(),
  isActive: z.boolean(),
  firstDate: IsoTimestampSchema,
  lastDate: IsoTimestampSchema,
  /** When Plaid expects the next one; null when it cannot say. */
  predictedNextDate: IsoTimestampSchema.nullable(),
  averageAmount: z.number(),
  lastAmount: z.number(),
  currency: z.string().nullable(),
  /** Plaid's personal-finance category (primary), e.g. ENTERTAINMENT. */
  category: z.string().nullable(),
  /**
   * What it comes to a month, in the base currency, so streams that repeat at
   * different paces can be compared: the average amount times how often it
   * happens in a year over twelve. Null when the frequency is unknown.
   */
  monthlyAmountInBase: z.number().nullable(),
});

export type RecurringStreamDTO = z.infer<typeof RecurringStreamDTOSchema>;

/** What the active streams come to a month, in the base currency. */
export const RecurringSummaryDTOSchema = z.object({
  /** Active outflow streams (subscriptions, bills) added up. */
  monthlyOutflow: z.number(),
  /** Active inflow streams (a salary) added up. */
  monthlyInflow: z.number(),
  /** How many active streams are left out because their frequency is unknown. */
  streamsWithoutFrequency: z.number().int(),
});

export type RecurringSummaryDTO = z.infer<typeof RecurringSummaryDTOSchema>;

/**
 * Recurring transactions API response: the user's recurring payments and income,
 * the biggest monthly ones first, with what the active ones come to a month in
 * `baseCurrency`. By default only active streams; the summary always counts only
 * active ones.
 */
export const RecurringResponseSchema = z.object({
  data: z.object({
    baseCurrency: z.string(),
    summary: RecurringSummaryDTOSchema,
    streams: z.array(RecurringStreamDTOSchema),
  }),
});

export type RecurringResponse = z.infer<typeof RecurringResponseSchema>;

/** A stored stream with the rows the DTO names. */
type StreamRow = Prisma.RecurringStreamGetPayload<{
  include: {
    account: { select: { name: true } };
    item: { select: { institutionName: true } };
  };
}>;

export interface RecurringOptions {
  baseCurrency: string;
  /** Base-currency units for one unit of `currency` today (see `loadExchangeRateConverter`). */
  rateOn: (currency: string | null) => number;
}

/**
 * Transform stored streams to the API's streams and summary. A stream's monthly
 * amount is its average amount at its pace (see `PAYMENTS_PER_YEAR`) converted
 * to the base currency at today's rate; the summary adds up the active ones.
 */
export function toRecurringDTO(
  rows: StreamRow[],
  { baseCurrency, rateOn }: RecurringOptions
): RecurringResponse["data"] {
  let outflow = 0;
  let inflow = 0;
  let withoutFrequency = 0;

  const streams = rows.map((row) => {
    const perYear = PAYMENTS_PER_YEAR[row.frequency];
    const monthly =
      perYear === undefined
        ? null
        : (row.averageAmount.toNumber() *
            perYear *
            rateOn(row.isoCurrencyCode)) /
          12;

    if (row.isActive) {
      if (monthly === null) withoutFrequency += 1;
      else if (row.direction === "inflow") inflow += toUnits(monthly);
      else outflow += toUnits(monthly);
    }

    return {
      id: row.id,
      accountId: row.accountId,
      accountName: row.account.name,
      institutionName: row.item.institutionName,
      direction: row.direction as RecurringDirection,
      description: row.description,
      merchantName: row.merchantName,
      frequency: row.frequency,
      status: row.status,
      isActive: row.isActive,
      firstDate: toIsoString(row.firstDate),
      lastDate: toIsoString(row.lastDate),
      predictedNextDate: row.predictedNextDate
        ? toIsoString(row.predictedNextDate)
        : null,
      averageAmount: row.averageAmount.toNumber(),
      lastAmount: row.lastAmount.toNumber(),
      currency: row.isoCurrencyCode,
      category: row.category,
      monthlyAmountInBase:
        monthly === null ? null : fromUnits(toUnits(monthly)),
    };
  });

  streams.sort(
    (a, b) =>
      (b.monthlyAmountInBase ?? -1) - (a.monthlyAmountInBase ?? -1) ||
      a.description.localeCompare(b.description) ||
      a.id.localeCompare(b.id)
  );

  return {
    baseCurrency,
    summary: {
      monthlyOutflow: fromUnits(outflow),
      monthlyInflow: fromUnits(inflow),
      streamsWithoutFrequency: withoutFrequency,
    },
    streams,
  };
}
