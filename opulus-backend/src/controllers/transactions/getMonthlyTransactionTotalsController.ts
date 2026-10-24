import { getValidatedQuery } from "@/middleware/validation.js";
import { getRequestSession } from "@/middleware/session/requireSession.js";
import { getMonthlyTransactionTotals } from "@/services/transactions/getMonthlyTransactionTotals.js";
import { MonthlyTransactionTotalsResponse } from "@opulus/core";
import { Request, Response } from "express";
import {
  toTransactionFilters,
  transactionFilterQuerySchema,
} from "./transactionFilterQuery.js";

/** Takes the same filters as the list, so the months match what it shows. */
export const getMonthlyTransactionTotalsQuerySchema =
  transactionFilterQuerySchema;

/**
 * Spending by month (in the base currency) for the filtered transactions
 * GET /api/transactions/monthly-totals?startDate=2026-09-01&hideTransfers=true
 *
 * Query parameters are validated by validateQuery middleware
 */
export async function getMonthlyTransactionTotalsController(
  req: Request,
  res: Response<MonthlyTransactionTotalsResponse>
) {
  const session = getRequestSession(res);

  const query =
    getValidatedQuery<typeof getMonthlyTransactionTotalsQuerySchema>(req);

  const data = await getMonthlyTransactionTotals({
    userId: session.user.id,
    filters: toTransactionFilters(query),
  });

  res.status(200).json({ data });
}
