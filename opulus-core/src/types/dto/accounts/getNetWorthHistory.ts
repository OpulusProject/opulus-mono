/**
 * Get Net Worth History endpoint DTOs
 */

import { z } from "zod";

/**
 * How far back the history goes, counting back from today: a week, a month
 * (30 days), three months (90), a year (365), or everything we have.
 */
export const NET_WORTH_RANGES = ["1w", "1m", "3m", "1y", "all"] as const;

export const NetWorthRangeSchema = z.enum(NET_WORTH_RANGES);

export type NetWorthRange = z.infer<typeof NetWorthRangeSchema>;

/** Net worth on one day, "YYYY-MM-DD" (UTC). */
export const NetWorthPointDTOSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  netWorth: z.number(),
});

export type NetWorthPointDTO = z.infer<typeof NetWorthPointDTOSchema>;

/**
 * One currency's net worth, a point per day from the start of the range to
 * today, oldest first. Currencies are never added together.
 */
export const NetWorthSeriesDTOSchema = z.object({
  currency: z.string().nullable(),
  points: z.array(NetWorthPointDTOSchema),
});

export type NetWorthSeriesDTO = z.infer<typeof NetWorthSeriesDTOSchema>;

/**
 * Net worth history API response
 */
export const NetWorthHistoryResponseSchema = z.object({
  data: z.object({
    range: NetWorthRangeSchema,
    series: z.array(NetWorthSeriesDTOSchema),
  }),
});

export type NetWorthHistoryResponse = z.infer<
  typeof NetWorthHistoryResponseSchema
>;
