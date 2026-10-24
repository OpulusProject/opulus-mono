import { getValidatedQuery } from "@/middleware/validation.js";
import { getRequestSession } from "@/middleware/session/requireSession.js";
import { getSpendingSummary } from "@/services/transactions/getSpendingSummary.js";
import { SpendingSummaryResponse, toDay } from "@opulus/core";
import { Request, Response } from "express";
import { z } from "zod";
import {
  toTransactionFilters,
  transactionFilterQuerySchema,
} from "./transactionFilterQuery.js";

/**
 * The shared filters, except the dates (the month sets them), and the month to
 * summarise: this month when absent, and never one that has not started.
 */
export const getSpendingSummaryQuerySchema = transactionFilterQuerySchema
  .omit({ startDate: true, endDate: true })
  .extend({
    month: z.preprocess(
      (val) => (val === "" ? undefined : val),
      z
        .string()
        .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Must be a month, like 2026-10")
        .refine((month) => month <= toDay(new Date()).slice(0, 7), {
          message: "Must not be in the future",
        })
        .optional()
    ),
  });

/**
 * A month's spending against the month before it, computed on the server
 * GET /api/transactions/spending-summary?month=2026-10&hideTransfers=true
 *
 * Query parameters are validated by validateQuery middleware
 */
export async function getSpendingSummaryController(
  req: Request,
  res: Response<SpendingSummaryResponse>
) {
  const session = getRequestSession(res);

  const { month, ...filters } =
    getValidatedQuery<typeof getSpendingSummaryQuerySchema>(req);
  const today = toDay(new Date());

  const data = await getSpendingSummary({
    userId: session.user.id,
    month: month ?? today.slice(0, 7),
    today,
    filters: toTransactionFilters(filters),
  });

  res.status(200).json({ data });
}
