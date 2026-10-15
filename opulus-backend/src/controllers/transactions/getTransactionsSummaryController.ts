import { getValidatedQuery } from "@/middleware/validation.js";
import { getRequestSession } from "@/middleware/session/requireSession.js";
import { getTransactionsSummary } from "@/services/transactions/getTransactionsSummary.js";
import { TransactionsSummaryResponse } from "@opulus/core";
import { NextFunction, Request, Response } from "express";
import {
  toTransactionFilters,
  transactionFilterQuerySchema,
} from "./transactionFilterQuery.js";

/** Takes the same filters as the list, so the days match what it shows. */
export const getTransactionsSummaryQuerySchema = transactionFilterQuerySchema;

/**
 * Totals, spending by category and spending by day (in the base currency) for
 * the filtered transactions
 * GET /api/transactions/summary?startDate=2026-09-01&hideTransfers=true
 *
 * Query parameters are validated by validateQuery middleware
 */
export async function getTransactionsSummaryController(
  req: Request,
  res: Response<TransactionsSummaryResponse>,
  next: NextFunction
) {
  try {
    const session = getRequestSession(res);

    const query =
      getValidatedQuery<typeof getTransactionsSummaryQuerySchema>(req);

    const data = await getTransactionsSummary({
      userId: session.user.id,
      filters: toTransactionFilters(query),
    });

    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
}
