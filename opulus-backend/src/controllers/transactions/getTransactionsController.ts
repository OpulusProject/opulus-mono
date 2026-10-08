import { getValidatedQuery } from "@/middleware/validation.js";
import { getRequestSession } from "@/middleware/session/requireSession.js";
import {
  toTransactionDTO,
  transactionRepository,
  TransactionsResponse,
} from "@opulus/core";
import { NextFunction, Request, Response } from "express";
import { z } from "zod";

/** An absent or empty query value means "no filter"; anything else is parsed. */
const orUndefined = (val: unknown) =>
  val === undefined || val === null || val === "" ? undefined : val;

/**
 * Optional query values arrive as strings. A value that is present but not valid
 * (`?page=abc`, `?startDate=garbage`) is a 400, not silently ignored: the client
 * would otherwise get unfiltered or first-page data and not know.
 */
const optionalDate = z.preprocess(
  (val) => {
    const v = orUndefined(val);
    return typeof v === "string" ? new Date(v) : v;
  },
  z.date({ invalid_type_error: "Must be a valid date" }).optional()
);

const optionalInt = (max?: number) => {
  const positiveInt = z.number().int().positive();

  return z.preprocess(
    (val) => {
      const v = orUndefined(val);
      return typeof v === "string" ? Number(v) : v;
    },
    (max ? positiveInt.max(max) : positiveInt).optional()
  );
};

/**
 * Query parameter schema for transactions endpoint
 */
export const getTransactionsQuerySchema = z.object({
  itemId: z.string().optional(),
  accountId: z.string().optional(),
  startDate: optionalDate,
  endDate: optionalDate,
  page: optionalInt(),
  limit: optionalInt(10000),
});

/**
 * Get all transactions for the authenticated user
 * GET /api/transactions?itemId=xxx&accountId=yyy&page=1&limit=50
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

    const userId = session.user.id;

    // Query parameters are already validated by validateQuery middleware
    const { itemId, accountId, startDate, endDate, page, limit } =
      getValidatedQuery<typeof getTransactionsQuerySchema>(req);

    // Get transactions with filters and pagination
    const result = await transactionRepository.getAllByUserId(
      userId,
      {
        ...(itemId && { itemId }),
        ...(accountId && { accountId }),
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
      },
      {
        ...(page && { page }),
        ...(limit && { limit }),
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
