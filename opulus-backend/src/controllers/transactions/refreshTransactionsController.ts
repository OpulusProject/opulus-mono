import { getRequestSession } from "@/middleware/session/requireSession.js";
import { getValidatedBody } from "@/middleware/validation.js";
import { refreshTransactions } from "@/services/transactions/refreshTransactions.js";
import {
  RefreshTransactionsRequestSchema,
  RefreshTransactionsResponse,
} from "@opulus/core";
import { NextFunction, Request, Response } from "express";

/**
 * Request body schema for refresh transactions endpoint
 */
export const refreshTransactionsBodySchema = RefreshTransactionsRequestSchema;

/**
 * Refresh transactions for a Plaid item
 * POST /api/transactions/refresh
 *
 * Triggers an on-demand extraction to fetch the newest transactions.
 * This endpoint may take 10-30 seconds to complete.
 * After refresh, Plaid will fire SYNC_UPDATES_AVAILABLE webhook.
 */
export async function refreshTransactionsController(
  req: Request,
  res: Response<RefreshTransactionsResponse>,
  next: NextFunction
) {
  try {
    const session = getRequestSession(res);

    // The body's itemId is Plaid's item id
    const { itemId: plaidItemId } =
      getValidatedBody<typeof refreshTransactionsBodySchema>(req);

    const { requestId } = await refreshTransactions({
      userId: session.user.id,
      plaidItemId,
    });

    res.status(200).json({
      data: {
        requestId,
        message:
          "Transaction refresh initiated. Plaid will fire SYNC_UPDATES_AVAILABLE webhook when refresh completes.",
      },
    });
  } catch (error) {
    next(error);
  }
}
