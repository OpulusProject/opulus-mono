import { getRequestSession } from "@/middleware/session/requireSession.js";
import { getValidatedBody } from "@/middleware/validation.js";
import { syncRecurring } from "@/services/recurring/syncRecurring.js";
import {
  SyncRecurringRequestSchema,
  SyncRecurringResponse,
} from "@opulus/core";
import { NextFunction, Request, Response } from "express";

/**
 * Request body schema for the sync recurring transactions endpoint
 */
export const syncRecurringBodySchema = SyncRecurringRequestSchema;

/**
 * Pull an item's recurring payments and income from Plaid
 * POST /api/recurring-transactions/sync
 */
export async function syncRecurringController(
  req: Request,
  res: Response<SyncRecurringResponse>,
  next: NextFunction
) {
  try {
    const session = getRequestSession(res);
    const { itemId } = getValidatedBody<typeof syncRecurringBodySchema>(req);

    const result = await syncRecurring({ userId: session.user.id, itemId });

    res.status(200).json({
      data:
        result.status === "synced"
          ? { status: "synced", streams: result.streams }
          : { status: "unavailable", reason: result.reason },
    });
  } catch (error) {
    next(error);
  }
}
