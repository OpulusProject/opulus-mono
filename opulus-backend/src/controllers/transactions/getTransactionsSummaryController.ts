import { getValidatedQuery } from "@/middleware/validation.js";
import { getRequestSession } from "@/middleware/session/requireSession.js";
import {
  toTransactionsSummaryDTO,
  transactionRepository,
  TransactionsSummaryResponse,
} from "@opulus/core";
import { NextFunction, Request, Response } from "express";
import {
  toTransactionFilters,
  transactionFilterQuerySchema,
} from "./transactionFilterQuery.js";

/** Takes the same filters as the list, so the totals match what it shows. */
export const getTransactionsSummaryQuerySchema = transactionFilterQuerySchema;

/**
 * Totals, spending by category and spending by day for the filtered
 * transactions
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

    const summary = await transactionRepository.getSummaryByUserId(
      session.user.id,
      toTransactionFilters(query)
    );

    res.status(200).json({ data: toTransactionsSummaryDTO(summary) });
  } catch (error) {
    next(error);
  }
}
