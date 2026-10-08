import { getValidatedQuery } from "@/middleware/validation.js";
import { getRequestSession } from "@/middleware/session/requireSession.js";
import {
  toTransactionDTO,
  transactionRepository,
  TransactionsResponse,
} from "@opulus/core";
import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import {
  optionalInt,
  toTransactionFilters,
  transactionFilterQuerySchema,
} from "./transactionFilterQuery.js";

/**
 * Query parameter schema for transactions endpoint
 */
export const getTransactionsQuerySchema = transactionFilterQuerySchema.extend({
  page: optionalInt(),
  limit: optionalInt(10000),
  sort: z.enum(["date", "amount"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
});

/**
 * Get the authenticated user's transactions
 * GET /api/transactions?itemId=a&itemId=b&category=FOOD_AND_DRINK&search=coffee&page=1&limit=50
 *
 * Query parameters are validated by validateQuery middleware
 */
export async function getTransactionsController(
  req: Request,
  res: Response<TransactionsResponse>,
  next: NextFunction
) {
  try {
    const session = getRequestSession(res);

    const query = getValidatedQuery<typeof getTransactionsQuerySchema>(req);
    const { page, limit, sort, order } = query;

    const result = await transactionRepository.getAllByUserId(
      session.user.id,
      toTransactionFilters(query),
      {
        ...(page && { page }),
        ...(limit && { limit }),
      },
      {
        by: sort ?? "date",
        order: order ?? "desc",
      }
    );

    res.status(200).json({
      data: {
        transactions: result.transactions.map(toTransactionDTO),
        pagination: result.pagination,
      },
    });
  } catch (error) {
    next(error);
  }
}
