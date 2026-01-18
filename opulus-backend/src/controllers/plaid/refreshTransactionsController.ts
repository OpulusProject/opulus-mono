import { getSession } from "@/services/session/getSession.js";
import {
  itemService,
  plaidService,
  UnauthorizedError,
} from "@opulus/core";
import { NextFunction, Request, Response } from "express";
import { z } from "zod";

/**
 * Request body schema for refresh transactions endpoint
 */
export const refreshTransactionsBodySchema = z.object({
  itemId: z.string().min(1, "itemId is required"),
});

/**
 * Refresh transactions for a Plaid item
 * POST /api/plaid/transactions/refresh
 *
 * Triggers an on-demand extraction to fetch the newest transactions.
 * This endpoint may take 10-30 seconds to complete.
 * After refresh, Plaid will fire SYNC_UPDATES_AVAILABLE webhook.
 */
export async function refreshTransactionsController(
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

    // Validate request body
    const { itemId } = refreshTransactionsBodySchema.parse(req.body);

    // Get the item and verify it belongs to the user
    const item = await itemService.getByPlaidItemId(itemId);
    if (item.userId !== userId) {
      throw new UnauthorizedError(
        "You do not have access to this item"
      );
    }

    // Call Plaid refresh endpoint
    // Note: This may take 10-30 seconds, but we return immediately
    // The webhook will fire when refresh completes
    const refreshResponse = await plaidService.transactionsRefresh(
      item.accessToken
    );

    res.status(200).json({
      data: {
        requestId: refreshResponse.request_id,
        message:
          "Transaction refresh initiated. Plaid will fire SYNC_UPDATES_AVAILABLE webhook when refresh completes.",
      },
    });
  } catch (error) {
    next(error);
  }
}

