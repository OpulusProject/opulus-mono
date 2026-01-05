import { getSession } from "@/services/session/getSession.js";
import { transactionService, UnauthorizedError } from "@opulus/core";
import { NextFunction, Request, Response } from "express";
import { z } from "zod";

/**
 * Query parameter schema for transactions endpoint
 */
export const getTransactionsQuerySchema = z.object({
  itemId: z.string().optional(),
  accountId: z.string().optional(),
  page: z.preprocess((val) => {
    if (val === undefined || val === null || val === "") return undefined;
    if (typeof val === "string") {
      const parsed = parseInt(val, 10);
      return isNaN(parsed) ? undefined : parsed;
    }
    return val;
  }, z.number().int().positive().optional()),
  limit: z.preprocess((val) => {
    if (val === undefined || val === null || val === "") return undefined;
    if (typeof val === "string") {
      const parsed = parseInt(val, 10);
      return isNaN(parsed) ? undefined : parsed;
    }
    return val;
  }, z.number().int().positive().max(100).optional()),
});

/**
 * Get all transactions for the authenticated user
 * GET /api/transactions?itemId=xxx&accountId=yyy&page=1&limit=50
 *
 * Query parameters are validated by validateQuery middleware
 */
export async function getTransactionsController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Get authenticated user session
    const session = await getSession(req.headers);
    if (!session?.user) {
      throw new UnauthorizedError("Authentication required");
    }

    const userId = session.user.id;

    // Query parameters are already validated by validateQuery middleware
    const { itemId, accountId, page, limit } = req.validatedQuery as z.infer<
      typeof getTransactionsQuerySchema
    >;

    // Get transactions with filters and pagination
    const result = await transactionService.getAllByUserId(
      userId,
      {
        ...(itemId && { itemId }),
        ...(accountId && { accountId }),
      },
      {
        ...(page && { page }),
        ...(limit && { limit }),
      }
    );

    res.status(200).json({
      data: {
        transactions: result.transactions,
        pagination: result.pagination,
      },
    });
  } catch (error) {
    next(error);
  }
}
