import { getRequestSession } from "@/middleware/session/requireSession.js";
import { updateItemAccounts } from "@/services/items/updateItemAccounts.js";
import { UpdateItemAccountsResponse } from "@opulus/core";
import { NextFunction, Request, Response } from "express";

/**
 * Reconcile a persisted Item's accounts with Plaid's current view.
 * Called by the frontend after a Link update-mode session completes (Plaid
 * does not fire a webhook for that flow).
 *
 * POST /api/items/:id/update-accounts
 */
export async function updateItemAccountsController(
  req: Request,
  res: Response<UpdateItemAccountsResponse>,
  next: NextFunction
) {
  try {
    const session = getRequestSession(res);

    const result = await updateItemAccounts({
      userId: session.user.id,
      itemId: req.params.id,
    });

    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
}
