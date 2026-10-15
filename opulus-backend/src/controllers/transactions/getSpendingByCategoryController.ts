import { getValidatedQuery } from "@/middleware/validation.js";
import { getRequestSession } from "@/middleware/session/requireSession.js";
import { getSpendingByCategory } from "@/services/transactions/getSpendingByCategory.js";
import { SpendingByCategoryResponse } from "@opulus/core";
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
 * Spending by category for the filtered transactions, converted to the base
 * currency, each with its share of the total
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

    const data = await getSpendingByCategory({
      userId: session.user.id,
      filters: toTransactionFilters(query),
      top: query.top,
    });

    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
}
