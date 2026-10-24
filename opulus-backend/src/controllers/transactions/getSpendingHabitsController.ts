import { getValidatedQuery } from "@/middleware/validation.js";
import { getRequestSession } from "@/middleware/session/requireSession.js";
import { getSpendingHabits } from "@/services/transactions/getSpendingHabits.js";
import { toDay, type SpendingHabitsResponse } from "@opulus/core";
import { Request, Response } from "express";
import { z } from "zod";
import {
  toTransactionFilters,
  transactionFilterQuerySchema,
} from "./transactionFilterQuery.js";

/**
 * The list's filters, except the dates (the month is measured instead), plus
 * the day to measure up to.
 */
export const getSpendingHabitsQuerySchema = transactionFilterQuerySchema
  .omit({ startDate: true, endDate: true })
  .extend({
    date: z.preprocess(
      (val) => (val === "" ? undefined : val),
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Must be YYYY-MM-DD" })
        .refine(
          (val) =>
            !Number.isNaN(Date.parse(val)) && toDay(new Date(val)) === val,
          {
            error: "Must be a valid date",
          }
        )
        .optional()
    ),
  });

/**
 * Each category's spending so far this month against its usual, flagged when
 * it is well above it
 * GET /api/transactions/spending-habits?date=2026-10-24&hideTransfers=true
 *
 * Query parameters are validated by validateQuery middleware
 */
export async function getSpendingHabitsController(
  req: Request,
  res: Response<SpendingHabitsResponse>
) {
  const session = getRequestSession(res);

  const query = getValidatedQuery<typeof getSpendingHabitsQuerySchema>(req);

  const data = await getSpendingHabits({
    userId: session.user.id,
    filters: toTransactionFilters({
      ...query,
      startDate: undefined,
      endDate: undefined,
    }),
    asOf: query.date ?? toDay(new Date()),
  });

  res.status(200).json({ data });
}
