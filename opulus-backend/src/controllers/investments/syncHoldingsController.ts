import { getRequestSession } from "@/middleware/session/requireSession.js";
import { getValidatedBody } from "@/middleware/validation.js";
import { syncHoldings } from "@/services/investments/syncHoldings.js";
import { SyncHoldingsRequestSchema, SyncHoldingsResponse } from "@opulus/core";
import { NextFunction, Request, Response } from "express";

/**
 * Request body schema for the sync holdings endpoint
 */
export const syncHoldingsBodySchema = SyncHoldingsRequestSchema;

/**
 * Pull an item's current holdings from Plaid
 * POST /api/investments/sync
 */
export async function syncHoldingsController(
  req: Request,
  res: Response<SyncHoldingsResponse>,
  next: NextFunction
) {
  try {
    const session = getRequestSession(res);
    const { itemId } = getValidatedBody<typeof syncHoldingsBodySchema>(req);

    const result = await syncHoldings({ userId: session.user.id, itemId });

    res.status(200).json({
      data:
        result.status === "synced"
          ? {
              status: "synced",
              holdings: result.holdings,
              securities: result.securities,
            }
          : { status: "unavailable", reason: result.reason },
    });
  } catch (error) {
    next(error);
  }
}
