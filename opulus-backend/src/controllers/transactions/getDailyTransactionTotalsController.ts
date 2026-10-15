import { getValidatedQuery } from "@/middleware/validation.js";
import { getRequestSession } from "@/middleware/session/requireSession.js";
import { getDailyTransactionTotals } from "@/services/transactions/getDailyTransactionTotals.js";
import { DailyTransactionTotalsResponse } from "@opulus/core";
import { NextFunction, Request, Response } from "express";
import {
  toTransactionFilters,
  transactionFilterQuerySchema,
} from "./transactionFilterQuery.js";

/** Takes the same filters as the list, so the days match what it shows. */
export const getDailyTransactionTotalsQuerySchema = transactionFilterQuerySchema;

/**
 * Totals, spending by category and spending by day (in the base currency) for
 * the filtered transactions
 * GET /api/transactions/daily-totals?startDate=2026-09-01&hideTransfers=true
 *
 * Query parameters are validated by validateQuery middleware
 */
export async function getDailyTransactionTotalsController(
  req: Request,
  res: Response<DailyTransactionTotalsResponse>,
  next: NextFunction
) {
  try {
    const session = getRequestSession(res);

    const query =
      getValidatedQuery<typeof getDailyTransactionTotalsQuerySchema>(req);

    const data = await getDailyTransactionTotals({
      userId: session.user.id,
      filters: toTransactionFilters(query),
    });

    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
}
