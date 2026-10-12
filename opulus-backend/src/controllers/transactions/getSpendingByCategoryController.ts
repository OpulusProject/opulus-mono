import { getValidatedQuery } from "@/middleware/validation.js";
import { getRequestSession } from "@/middleware/session/requireSession.js";
import {
  SpendingByCategoryResponse,
  toSpendingByCategoryDTO,
  transactionRepository,
} from "@opulus/core";
import { NextFunction, Request, Response } from "express";
import {
  optionalInt,
  toTransactionFilters,
  transactionFilterQuerySchema,
} from "./transactionFilterQuery.js";

/** The same filters as the list, plus how many categories to list by name. */
export const getSpendingByCategoryQuerySchema =
  transactionFilterQuerySchema.extend({
    top: optionalInt(50),
  });

/**
 * Spending by category for the filtered transactions, each with its share of
 * the total
 * GET /api/transactions/spending-by-category?startDate=2026-09-01&hideTransfers=true&top=5
 *
 * Query parameters are validated by validateQuery middleware
 */
export async function getSpendingByCategoryController(
  req: Request,
  res: Response<SpendingByCategoryResponse>,
  next: NextFunction
) {
  try {
    const session = getRequestSession(res);

    const query =
      getValidatedQuery<typeof getSpendingByCategoryQuerySchema>(req);

    const rows = await transactionRepository.getCategorySpendByUserId(
      session.user.id,
      toTransactionFilters(query)
    );

    res.status(200).json({ data: toSpendingByCategoryDTO(rows, query.top) });
  } catch (error) {
    next(error);
  }
}
